const OPEN = 1;
const CONNECTING = 0;
const CLOSING = 2;
const CLOSED = 3;

function cleanCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}
function randomId(prefix = 'p') {
  try { return prefix + crypto.randomUUID().replace(/-/g, '').slice(0, 15); } catch {}
  return prefix + Math.random().toString(36).slice(2, 17);
}
function publicPlayer(client, hostId) {
  return {
    id: client.id,
    name: client.name || 'Operative',
    team: client.team === 't' ? 't' : 'ct',
    host: client.id === hostId,
    alive: client.alive !== false,
    characterId: client.characterId || 'vanguard',
    spectating: false,
    joinRound: null,
    waitingForRound: false,
    eligibleRound: null,
  };
}
function safeJson(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

let eventsScriptPromise = null;
function ensureEventsClient() {
  if (globalThis.hatchable?.events) return Promise.resolve(globalThis.hatchable.events);
  if (eventsScriptPromise) return eventsScriptPromise;
  eventsScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/__hatchable/events.js';
    script.async = true;
    script.onload = () => globalThis.hatchable?.events ? resolve(globalThis.hatchable.events) : reject(new Error('Realtime client unavailable.'));
    script.onerror = () => reject(new Error('Could not load realtime client.'));
    document.head.appendChild(script);
  });
  return eventsScriptPromise;
}

export default class P2PRoomSocket {
  constructor() {
    this.readyState = CONNECTING;
    this.peerId = randomId('peer_');
    this.roomCode = '';
    this.hostPeer = '';
    this.hostSecret = '';
    this.role = '';
    this._listeners = new Map();
    this._hello = null;
    this._eventConnection = null;
    this._eventChannel = null;
    this._peers = new Map();
    this._guestPc = null;
    this._guestChannel = null;
    this._hostRoom = null;
    this._heartbeat = null;
    setTimeout(() => {
      if (this.readyState !== CONNECTING) return;
      this.readyState = OPEN;
      this._emit('open', {});
    }, 0);
  }

  addEventListener(type, fn) {
    if (typeof fn !== 'function') return;
    let set = this._listeners.get(type);
    if (!set) this._listeners.set(type, set = new Set());
    set.add(fn);
  }

  removeEventListener(type, fn) {
    this._listeners.get(type)?.delete(fn);
  }

  _emit(type, event) {
    for (const fn of this._listeners.get(type) || []) {
      try { fn(event); } catch (error) { console.error('[p2p]', error); }
    }
  }

  _message(payload) {
    this._emit('message', { data: JSON.stringify(payload) });
  }

  async send(raw) {
    if (this.readyState !== OPEN) return;
    const msg = typeof raw === 'string' ? safeJson(raw) : raw;
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'hello' && !this._hello) {
      this._hello = msg;
      try {
        if (msg.action === 'create') await this._createRoom(msg);
        else if (msg.action === 'join') await this._joinRoom(msg);
        else this._message({ type: 'error', message: 'P2P reconnect is not available yet. Rejoin the room code.' });
      } catch (error) {
        console.error('[p2p] connect failed', error);
        this._message({ type: 'error', message: error?.message || 'Could not create or join the P2P room.' });
        this._emit('error', { error });
      }
      return;
    }

    if (this.role === 'host') {
      this._handleServerMessage(this._hostRoom?.clients.get(this.peerId), msg);
      return;
    }

    if (this.role === 'guest' && this._guestChannel?.readyState === 'open') {
      this._guestChannel.send(JSON.stringify(msg));
    }
  }

  async _api(path, body = null, method = 'POST') {
    const response = await fetch(path, {
      method,
      headers: body == null ? { Accept: 'application/json' } : { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body == null ? undefined : JSON.stringify(body),
      cache: 'no-store',
      credentials: 'same-origin',
    });
    let payload = null;
    try { payload = await response.json(); } catch {}
    if (!response.ok) throw new Error(payload?.error || payload?.message || ('Request failed: ' + response.status));
    return payload || {};
  }

  async _subscribe(code) {
    const eventsApi = await ensureEventsClient();
    const authUrl = '/api/events-token?room=' + encodeURIComponent(code);
    this._eventConnection = eventsApi.connect({ authUrl });
    this._eventChannel = this._eventConnection.channel('room:' + code);
    this._eventChannel.on('signal', (event) => this._onSignal(event?.data || {}));
    this._eventChannel.on('$reset', () => {});
    // The realtime client establishes its held connection asynchronously.
    // Give the channel a short moment before the first SDP signal so the
    // initial offer cannot race the subscription on fast local joins.
    await new Promise((resolve) => setTimeout(resolve, 450));
  }

  _waitIceComplete(pc, timeoutMs = 3200) {
    if (!pc || pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        pc.removeEventListener?.('icegatheringstatechange', check);
        resolve();
      };
      const check = () => {
        if (pc.iceGatheringState === 'complete') finish();
      };
      pc.addEventListener?.('icegatheringstatechange', check);
      setTimeout(finish, timeoutMs);
    });
  }

  async _signal(toPeer, kind, payload) {
    if (!this.roomCode) return;
    await this._api('/api/p2p/signal', {
      code: this.roomCode,
      fromPeer: this.peerId,
      toPeer,
      kind,
      payload,
    });
  }

  _rtc() {
    return new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });
  }

  async _createRoom(hello) {
    if (typeof RTCPeerConnection !== 'function') throw new Error('This browser does not support WebRTC.');
    const created = await this._api('/api/p2p/room', {
      action: 'create',
      hostPeer: this.peerId,
      mapId: hello.mapId,
    });
    const room = created.room || {};
    this.role = 'host';
    this.roomCode = cleanCode(room.code);
    this.hostPeer = this.peerId;
    this.hostSecret = String(created.hostSecret || '');
    await this._subscribe(this.roomCode);

    const hostClient = {
      id: this.peerId,
      peerId: this.peerId,
      name: String(hello.name || 'Operative').slice(0, 20),
      characterId: String(hello.characterId || 'vanguard'),
      team: 'ct',
      alive: true,
      channel: null,
    };
    this._hostRoom = {
      code: this.roomCode,
      mode: 'humans',
      mapId: String(hello.mapId || room.map_id || 'dustyard'),
      hostId: this.peerId,
      started: false,
      matchId: null,
      authorityEpoch: 1,
      snapshotSeq: 0,
      clients: new Map([[this.peerId, hostClient]]),
    };

    this._message(this._welcome(hostClient));
    this._broadcastLobby();
    this._heartbeatRoom();
    this._heartbeat = setInterval(() => this._heartbeatRoom(), 10000);
  }

  async _joinRoom(hello) {
    if (typeof RTCPeerConnection !== 'function') throw new Error('This browser does not support WebRTC.');
    const code = cleanCode(hello.room);
    if (!code) throw new Error('Enter a room code.');
    const lookup = await this._api('/api/p2p/room?code=' + encodeURIComponent(code), null, 'GET');
    const room = lookup.room || {};
    this.role = 'guest';
    this.roomCode = code;
    this.hostPeer = String(room.host_peer || '');
    if (!this.hostPeer) throw new Error('Room host is unavailable.');
    await this._subscribe(code);

    const pc = this._guestPc = this._rtc();
    const channel = this._guestChannel = pc.createDataChannel('contra-room', { ordered: true });
    this._bindGuestChannel(channel);
    pc.onicecandidate = () => {};
    pc.onconnectionstatechange = () => {
      if (['failed','disconnected','closed'].includes(pc.connectionState)) {
        this._emit('close', { code: 1006, reason: 'P2P host disconnected' });
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await this._waitIceComplete(pc);
    const offerPayload = {
      type: pc.localDescription?.type || offer.type,
      sdp: pc.localDescription?.sdp || offer.sdp,
    };
    await this._signal(this.hostPeer, 'offer', offerPayload);

    let retries = 0;
    const retryOffer = async () => {
      if (this.readyState !== OPEN || pc.remoteDescription || channel.readyState === 'open') return;
      if (retries++ >= 3) return;
      await this._signal(this.hostPeer, 'offer', offerPayload).catch(() => {});
      this._offerRetryTimer = setTimeout(retryOffer, 1800);
    };
    this._offerRetryTimer = setTimeout(retryOffer, 1800);
  }

  _bindGuestChannel(channel) {
    channel.onopen = () => {
      if (this._hello && channel.readyState === 'open') channel.send(JSON.stringify(this._hello));
    };
    channel.onmessage = (event) => {
      if (typeof event.data === 'string') this._emit('message', { data: event.data });
    };
    channel.onclose = () => this._emit('close', { code: 1006, reason: 'Host connection closed' });
    channel.onerror = (error) => this._emit('error', { error });
  }

  async _onSignal(signal) {
    if (!signal || signal.toPeer !== this.peerId || signal.fromPeer === this.peerId) return;
    const fromPeer = String(signal.fromPeer || '');
    try {
      if (this.role === 'host') {
        if (signal.kind === 'offer') {
          let entry = this._peers.get(fromPeer);
          if (!entry) {
            const pc = this._rtc();
            entry = { pc, channel: null, peerId: fromPeer };
            this._peers.set(fromPeer, entry);
            pc.ondatachannel = (event) => {
              entry.channel = event.channel;
              this._bindHostChannel(fromPeer, event.channel);
            };
            pc.onicecandidate = () => {};
            pc.onconnectionstatechange = () => {
              if (['failed','disconnected','closed'].includes(pc.connectionState)) this._dropGuest(fromPeer);
            };
          }
          if (entry.pc.remoteDescription?.sdp === signal.payload?.sdp && entry.pc.localDescription) {
            await this._signal(fromPeer, 'answer', {
              type: entry.pc.localDescription.type,
              sdp: entry.pc.localDescription.sdp,
            });
            return;
          }
          await entry.pc.setRemoteDescription(signal.payload);
          const answer = await entry.pc.createAnswer();
          await entry.pc.setLocalDescription(answer);
          await this._waitIceComplete(entry.pc);
          await this._signal(fromPeer, 'answer', {
            type: entry.pc.localDescription?.type || answer.type,
            sdp: entry.pc.localDescription?.sdp || answer.sdp,
          });
          return;
        }
        if (signal.kind === 'candidate') {
          const entry = this._peers.get(fromPeer);
          if (entry?.pc && signal.payload) await entry.pc.addIceCandidate(signal.payload).catch(() => {});
          return;
        }
      }

      if (this.role === 'guest' && fromPeer === this.hostPeer) {
        if (signal.kind === 'answer' && this._guestPc) {
          if (this._offerRetryTimer) {
            clearTimeout(this._offerRetryTimer);
            this._offerRetryTimer = null;
          }
          if (!this._guestPc.remoteDescription) {
            await this._guestPc.setRemoteDescription(signal.payload);
          }
        } else if (signal.kind === 'candidate' && this._guestPc && signal.payload) {
          await this._guestPc.addIceCandidate(signal.payload).catch(() => {});
        } else if (signal.kind === 'leave') {
          this.close(1000, 'Host closed room');
        }
      }
    } catch (error) {
      console.error('[p2p] signal error', error);
      this._emit('error', { error });
    }
  }

  _bindHostChannel(peerId, channel) {
    channel.onmessage = (event) => {
      const msg = typeof event.data === 'string' ? safeJson(event.data) : null;
      if (!msg) return;
      const room = this._hostRoom;
      let client = room?.clients.get(peerId);
      if (msg.type === 'hello' && !client) {
        client = {
          id: peerId,
          peerId,
          name: String(msg.name || 'Operative').slice(0, 20),
          characterId: String(msg.characterId || 'vanguard'),
          team: this._chooseTeam(),
          alive: !room.started,
          channel,
        };
        room.clients.set(peerId, client);
        this._sendTo(client, this._welcome(client));
        this._broadcastLobby();
        this._heartbeatRoom();
        if (room.started) {
          this._sendTo(client, {
            type: 'error',
            message: 'This P2P match is already running. Join before the host starts.',
          });
        }
        return;
      }
      if (client) this._handleServerMessage(client, msg);
    };
    channel.onclose = () => this._dropGuest(peerId);
    channel.onerror = () => {};
  }

  _chooseTeam() {
    const room = this._hostRoom;
    let ct = 0, t = 0;
    for (const client of room?.clients.values() || []) {
      if (client.team === 't') t++; else ct++;
    }
    return ct <= t ? 'ct' : 't';
  }

  _players() {
    const room = this._hostRoom;
    if (!room) return [];
    return [...room.clients.values()].map((client) => publicPlayer(client, room.hostId));
  }

  _welcome(client) {
    const room = this._hostRoom;
    return {
      type: 'welcome',
      id: client.id,
      room: room.code,
      mode: 'humans',
      mapId: room.mapId,
      hostId: room.hostId,
      ranked: false,
      reconnectToken: '',
      authorityEpoch: room.authorityEpoch,
      snapshotSeq: room.snapshotSeq,
      serverTime: Date.now(),
    };
  }

  _lobby() {
    const room = this._hostRoom;
    return {
      type: 'lobby',
      room: room.code,
      mode: 'humans',
      mapId: room.mapId,
      started: room.started,
      hostId: room.hostId,
      authorityEpoch: room.authorityEpoch,
      snapshotSeq: room.snapshotSeq,
      serverTime: Date.now(),
      players: this._players(),
    };
  }

  _sendTo(client, payload) {
    if (!client) return;
    if (client.id === this.peerId) {
      this._message(payload);
      return;
    }
    if (client.channel?.readyState === 'open') client.channel.send(JSON.stringify(payload));
  }

  _broadcast(payload, exceptId = null) {
    for (const client of this._hostRoom?.clients.values() || []) {
      if (client.id === exceptId) continue;
      this._sendTo(client, payload);
    }
  }

  _broadcastLobby() {
    if (!this._hostRoom) return;
    this._broadcast(this._lobby());
  }

  _handleServerMessage(client, msg) {
    const room = this._hostRoom;
    if (!room || !client || !msg) return;

    switch (msg.type) {
      case 'set_team': {
        if (room.started) return;
        client.team = msg.team === 't' ? 't' : 'ct';
        this._broadcastLobby();
        this._heartbeatRoom();
        break;
      }
      case 'set_profile':
        if (!room.started) {
          client.name = String(msg.name || client.name || 'Operative').slice(0, 20);
          client.characterId = String(msg.characterId || client.characterId || 'vanguard');
          this._broadcastLobby();
        }
        break;
      case 'set_mode':
        room.mode = 'humans';
        this._broadcastLobby();
        break;
      case 'set_map':
        if (client.id === room.hostId && !room.started) {
          room.mapId = String(msg.mapId || room.mapId);
          this._broadcastLobby();
          this._heartbeatRoom();
        }
        break;
      case 'start_match': {
        if (client.id !== room.hostId) return;
        if (room.clients.size < 2) {
          this._sendTo(client, { type: 'error', message: 'Humans-only needs at least two players.' });
          return;
        }
        let ct = 0, t = 0;
        for (const player of room.clients.values()) player.team === 't' ? t++ : ct++;
        if (!ct || !t) {
          this._sendTo(client, { type: 'error', message: 'Put at least one player on each team.' });
          return;
        }
        room.started = true;
        room.matchId = randomId('match_');
        room.authorityEpoch = 1;
        room.snapshotSeq = 0;
        for (const player of room.clients.values()) player.alive = true;
        this._broadcast({
          type: 'match_start',
          room: room.code,
          matchId: room.matchId,
          mapId: room.mapId,
          mode: 'humans',
          hostId: room.hostId,
          authorityEpoch: room.authorityEpoch,
          snapshotSeq: room.snapshotSeq,
          serverTime: Date.now(),
          snapshot: null,
          players: this._players(),
        });
        this._heartbeatRoom();
        break;
      }
      case 'player_state':
        if (!room.started || !msg.state) return;
        client.alive = msg.state.alive !== false;
        this._broadcast({ type: 'player_state', id: client.id, state: msg.state }, client.id);
        break;
      case 'snapshot':
        if (!room.started || client.id !== room.hostId || !msg.snapshot) return;
        room.snapshotSeq++;
        this._broadcast({
          type: 'snapshot',
          hostId: room.hostId,
          authorityEpoch: room.authorityEpoch,
          snapshotSeq: room.snapshotSeq,
          serverTime: Date.now(),
          snapshot: msg.snapshot,
        }, room.hostId);
        break;
      case 'fire':
      case 'grenade':
        if (!room.started || client.id === room.hostId) return;
        this._message({ ...msg, shooterId: client.id });
        break;
      case 'damage':
        if (!room.started || client.id !== room.hostId) return;
        this._broadcast(msg, room.hostId);
        break;
      case 'event':
        if (!room.started || client.id !== room.hostId) return;
        this._broadcast(msg, room.hostId);
        break;
      case 'sync_request':
        this._sendTo(client, this._lobby());
        break;
      case 'yield_authority':
        break;
      case 'leave_room':
        if (client.id === room.hostId) this.close(1000, 'Host left room');
        else this._dropGuest(client.peerId || client.id);
        break;
      default:
        break;
    }
  }

  _dropGuest(peerId) {
    if (this.role !== 'host' || !this._hostRoom) return;
    const client = this._hostRoom.clients.get(peerId);
    if (!client) return;
    this._hostRoom.clients.delete(peerId);
    const entry = this._peers.get(peerId);
    this._peers.delete(peerId);
    try { entry?.channel?.close(); } catch {}
    try { entry?.pc?.close(); } catch {}
    this._broadcast({ type: 'player_left', id: client.id, name: client.name });
    this._broadcastLobby();
    this._heartbeatRoom();
  }

  _heartbeatRoom() {
    const room = this._hostRoom;
    if (!room || !this.hostSecret) return;
    this._api('/api/p2p/room', {
      action: 'heartbeat',
      code: room.code,
      hostSecret: this.hostSecret,
      playerCount: room.clients.size,
      started: room.started,
      mapId: room.mapId,
    }).catch(() => {});
  }

  close(code = 1000, reason = '') {
    if (this.readyState >= CLOSING) return;
    this.readyState = CLOSING;
    if (this._heartbeat) clearInterval(this._heartbeat);
    if (this._offerRetryTimer) clearTimeout(this._offerRetryTimer);

    if (this.role === 'host') {
      for (const [peerId, entry] of this._peers) {
        this._signal(peerId, 'leave', null).catch(() => {});
        try { entry.channel?.close(); } catch {}
        try { entry.pc?.close(); } catch {}
      }
      if (this.roomCode && this.hostSecret) {
        this._api('/api/p2p/room', {
          action: 'close',
          code: this.roomCode,
          hostSecret: this.hostSecret,
        }).catch(() => {});
      }
    } else if (this.role === 'guest') {
      if (this.hostPeer) this._signal(this.hostPeer, 'leave', null).catch(() => {});
      try { this._guestChannel?.close(); } catch {}
      try { this._guestPc?.close(); } catch {}
    }

    this.readyState = CLOSED;
    this._emit('close', { code, reason });
  }
}

P2PRoomSocket.CONNECTING = CONNECTING;
P2PRoomSocket.OPEN = OPEN;
P2PRoomSocket.CLOSING = CLOSING;
P2PRoomSocket.CLOSED = CLOSED;

// Standalone hosting: use the public PeerJS signaling service for WebRTC
// when the game is served outside its original Hatchable room API.
// It preserves the existing room protocol, host authority and data channels.
if (typeof location !== 'undefined' && !location.hostname.endsWith('.hatchable.site')) {
  const peerServer = { host: '0.peerjs.com', port: 443, path: '/', secure: true, debug: 0 };
  const roomPeerId = (roomCode) => 'contra-strike-x-room-' + cleanCode(roomCode);
  const roomAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let peerjsLoader = null;

  const loadPeerJs = () => {
    if (globalThis.Peer || globalThis.peerjs?.Peer) return Promise.resolve(globalThis.Peer || globalThis.peerjs.Peer);
    if (peerjsLoader) return peerjsLoader;
    peerjsLoader = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js';
      script.async = true;
      script.onload = () => {
        const Peer = globalThis.Peer || globalThis.peerjs?.Peer;
        if (typeof Peer === 'function') resolve(Peer);
        else reject(new Error('PeerJS could not initialize.'));
      };
      script.onerror = () => reject(new Error('Could not load the room connection library.'));
      document.head.appendChild(script);
    }).catch(error => { peerjsLoader = null; throw error; });
    return peerjsLoader;
  };

  function roomCode() {
    let text = '';
    for (let i = 0; i < 6; i++) text += roomAlphabet[Math.floor(Math.random() * roomAlphabet.length)];
    return text;
  }

  // PeerJS DataConnection to the small WebRTCDataChannel API the game's
  // existing multiplayer message protocol already expects.
  function peerChannel(connection) {
    const channel = {
      onopen: null, onclose: null, onerror: null, onmessage: null,
      get readyState() { return connection.open ? 'open' : 'connecting'; },
      send(data) { if (connection.open) connection.send(data); },
      close() { connection.close(); },
    };
    connection.on('open', () => channel.onopen?.());
    connection.on('data', (data) => channel.onmessage?.({
      data: typeof data === 'string' ? data : JSON.stringify(data),
    }));
    connection.on('close', () => channel.onclose?.());
    connection.on('error', (error) => channel.onerror?.(error));
    return channel;
  }

  P2PRoomSocket.prototype._api = async function (path, body = null, method = 'POST') {
    if (method === 'GET') {
      const url = new URL(path, location.origin);
      const code = cleanCode(url.searchParams.get('code'));
      if (!code) throw new Error('Enter a room code.');
      return { room: { code, host_peer: roomPeerId(code), mode: 'humans' } };
    }
    if (body?.action === 'create') {
      const code = roomCode();
      return {
        room: { code, host_peer: roomPeerId(code), map_id: body.mapId || 'dustyard', mode: 'humans' },
        hostSecret: 'peerjs-host',
      };
    }
    return { ok: true };
  };

  P2PRoomSocket.prototype._subscribe = async function (code) {
    const Peer = await loadPeerJs();
    const host = this.role === 'host';
    const localId = host ? roomPeerId(code) : undefined;
    const peer = this._peer = localId ? new Peer(localId, peerServer) : new Peer(peerServer);

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Could not connect to room service. Try again.')), 12000);
      peer.once('open', id => {
        clearTimeout(timer);
        this.peerId = id;
        resolve();
      });
      peer.once('error', error => {
        clearTimeout(timer);
        reject(new Error(
          error?.type === 'unavailable-id'
            ? 'Room code already in use. Try creating another room.'
            : 'Room service error: ' + (error?.message || error?.type || error)
        ));
      });
    });

    peer.on('error', error => {
      if (this.readyState === OPEN)
        this._message({ type: 'error', message: 'Online connection: ' + (error?.message || error?.type || 'unavailable') });
    });

    if (host) peer.on('connection', conn => {
      if (this.readyState !== OPEN) { conn.close(); return; }
      const id = conn.peer;
      const channel = peerChannel(conn);
      this._peers.set(id, { peerId: id, pc: null, channel });
      this._bindHostChannel(id, channel);
    });
  };

  // PeerJS handles the offer/answer/candidate exchange internally. The game's
  // host-authoritative packet protocol and WebRTC data channels remain intact.
  P2PRoomSocket.prototype._joinRoom = async function (hello) {
    if (typeof RTCPeerConnection !== 'function') throw new Error('This browser does not support WebRTC.');
    const code = cleanCode(hello.room);
    if (!code) throw new Error('Enter a room code.');
    this.role = 'guest';
    this.roomCode = code;
    this.hostPeer = roomPeerId(code);
    await this._subscribe(code);
    const conn = this._peer.connect(this.hostPeer, { reliable: true, serialization: 'json' });
    const channel = this._guestChannel = peerChannel(conn);
    this._bindGuestChannel(channel);
    const timer = setTimeout(() => {
      if (this.readyState === OPEN && !conn.open)
        this._message({ type: 'error', message: 'Room not found. Check the code and ask the host to keep the room open.' });
    }, 12000);
    conn.on('open', () => clearTimeout(timer));
    conn.on('error', () => clearTimeout(timer));
    conn.on('close', () => clearTimeout(timer));
  };

  P2PRoomSocket.prototype._signal = async function () {};
  const originalClose = P2PRoomSocket.prototype.close;
  P2PRoomSocket.prototype.close = function (...args) {
    originalClose.apply(this, args);
    try { this._peer?.destroy(); } catch {}
  };
}
