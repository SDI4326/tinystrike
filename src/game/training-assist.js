import * as THREE from 'three';

const DEFAULT_FOV_DEG = 18;
const DEFAULT_SMOOTH = 14;
const HEAD_HEIGHT_RATIO = 0.90;
const STORAGE_KEY = 'contra-strike-training-assist';

const _eye = new THREE.Vector3();
const _target = new THREE.Vector3();
const _dir = new THREE.Vector3();

function wrapAngle(value) {
  let angle = value % (Math.PI * 2);
  if (angle > Math.PI) angle -= Math.PI * 2;
  if (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

export default class TrainingAssist {
  constructor(game) {
    this.game = game;
    this.fov = THREE.MathUtils.degToRad(DEFAULT_FOV_DEG);
    this.smooth = DEFAULT_SMOOTH;
    this.target = null;
    this.enabled = this._loadEnabled();
    this._badge = this._buildBadge();
    this._onKeyDown = (event) => {
      if (event.repeat || event.code !== 'F6') return;
      event.preventDefault();
      this.enabled = !this.enabled;
      this._saveEnabled();
      this._syncBadge();
    };
    window.addEventListener('keydown', this._onKeyDown);
    this._syncBadge();
  }

  _loadEnabled() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved == null ? true : saved === '1';
    } catch {
      return true;
    }
  }

  _saveEnabled() {
    try { localStorage.setItem(STORAGE_KEY, this.enabled ? '1' : '0'); } catch {}
  }

  _buildBadge() {
    const root = this.game.hudRoot || document.body;
    const el = document.createElement('div');
    el.id = 'contra-training-assist';
    Object.assign(el.style, {
      position: 'absolute',
      right: '18px',
      bottom: '18px',
      zIndex: '60',
      padding: '8px 11px',
      border: '1px solid rgba(183,210,120,.55)',
      background: 'rgba(4,8,6,.76)',
      color: '#dce9be',
      font: '800 11px/1.15 Arial, sans-serif',
      letterSpacing: '.11em',
      pointerEvents: 'none',
      backdropFilter: 'blur(8px)',
      textTransform: 'uppercase',
      boxShadow: '0 8px 22px rgba(0,0,0,.25)',
    });
    root.appendChild(el);
    return el;
  }

  _soloOnly() {
    const game = this.game;
    return game.sessionMode === 'solo' && !(game.multiplayer && game.multiplayer.active);
  }

  _syncBadge() {
    if (!this._badge) return;
    const allowed = this._soloOnly();
    this._badge.style.display = allowed && this.game.state.phase !== 'menu' ? 'block' : 'none';
    this._badge.textContent = 'Aim trainer ' + (this.enabled ? 'ON' : 'OFF') + ' · F6';
    this._badge.style.opacity = this.enabled ? '1' : '.55';
  }

  _visible(bot, eye, target, distance) {
    const world = this.game.world;
    if (!world || typeof world.raycast !== 'function') return true;
    _dir.copy(target).sub(eye);
    const len = _dir.length();
    if (len < 0.001) return true;
    _dir.multiplyScalar(1 / len);
    const hit = world.raycast(eye, _dir, Math.max(0.01, distance - 0.25));
    return !hit;
  }

  _pickTarget() {
    const game = this.game;
    const player = game.player;
    const bots = game.bots?.all;
    if (!player || !Array.isArray(bots)) return null;

    _eye.set(player.position.x, player.position.y + player.eyeHeight, player.position.z);
    let best = null;
    let bestScore = Infinity;

    for (const bot of bots) {
      if (!bot || !bot.alive || !bot.pos || bot.team === player.team) continue;

      const height = Number(bot.height) || 1.83;
      _target.set(bot.pos.x, bot.pos.y + height * HEAD_HEIGHT_RATIO, bot.pos.z);

      const dx = _target.x - _eye.x;
      const dy = _target.y - _eye.y;
      const dz = _target.z - _eye.z;
      const horizontal = Math.hypot(dx, dz);
      const distance = Math.hypot(horizontal, dy);
      if (distance < 0.01) continue;

      const targetYaw = Math.atan2(-dx, -dz);
      const targetPitch = Math.atan2(dy, Math.max(horizontal, 0.0001));
      const yawDiff = wrapAngle(targetYaw - player.yaw);
      const pitchDiff = targetPitch - player.pitch;
      const angle = Math.hypot(yawDiff, pitchDiff);
      if (angle > this.fov) continue;
      if (!this._visible(bot, _eye, _target, distance)) continue;

      const score = angle + distance * 0.0007;
      if (score < bestScore) {
        bestScore = score;
        best = { bot, targetYaw, targetPitch };
      }
    }
    return best;
  }

  update(dt) {
    this._syncBadge();

    const game = this.game;
    const player = game.player;
    if (!this.enabled || !this._soloOnly() || !player?.alive) {
      this.target = null;
      return;
    }
    if (!['freeze', 'live', 'planted'].includes(game.state.phase)) {
      this.target = null;
      return;
    }

    const picked = this._pickTarget();
    this.target = picked?.bot || null;
    if (!picked) return;

    const t = 1 - Math.exp(-this.smooth * Math.max(0, dt || 0));
    const yawStep = wrapAngle(picked.targetYaw - player.yaw) * t;
    const pitchStep = (picked.targetPitch - player.pitch) * t;

    player.yaw += yawStep;
    player.pitch = THREE.MathUtils.clamp(player.pitch + pitchStep, -1.45, 1.45);

    // Player already composed bob/recoil/shake into the camera earlier in this frame.
    // Apply only the aim delta so those effects remain intact.
    if (game.camera) {
      game.camera.rotation.y += yawStep;
      game.camera.rotation.x += pitchStep;
    }
  }
}
