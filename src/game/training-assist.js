import * as THREE from 'three';

const DEFAULTS = Object.freeze({
  enabled: true,
  fovDeg: 20,
  smooth: 18,
  target: 'head',
  showFov: true,
  sticky: true,
  triggerbot: false,
  noRecoil: true,
  perfectShot: true,
  esp: true,
  espNames: true,
  priority: 'crosshair',
  snap: false,
});

const STORAGE_KEY = 'contra-strike-training-assist-v3';
const _eye = new THREE.Vector3();
const _target = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _feet = new THREE.Vector3();
const _head = new THREE.Vector3();

function wrapAngle(value) {
  let angle = value % (Math.PI * 2);
  if (angle > Math.PI) angle -= Math.PI * 2;
  if (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

function clampNum(value, min, max, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? THREE.MathUtils.clamp(n, min, max) : fallback;
}

export default class TrainingAssist {
  constructor(game) {
    this.game = game;
    this.target = null;
    this.menuOpen = false;
    this._espNodes = new Map();

    const saved = this._loadSettings();
    Object.assign(this, saved);
    this.fov = THREE.MathUtils.degToRad(this.fovDeg);

    this._ui = this._buildUi();
    this._hitTimer = 0;
    this.game.events?.on?.('hud:hitmarker', (detail) => this._showHitFeedback(detail));

    this._onKeyDown = (event) => {
      if (event.repeat) return;

      if (event.code === 'F6') {
        event.preventDefault();
        this.enabled = !this.enabled;
        this._saveSettings();
        this._syncUi();
        return;
      }
      if (event.code === 'F7') {
        event.preventDefault();
        this.triggerbot = !this.triggerbot;
        this._saveSettings();
        this._syncUi();
        return;
      }
      if (event.code === 'F8') {
        event.preventDefault();
        this.esp = !this.esp;
        this._saveSettings();
        this._syncUi();
        return;
      }
      if (event.code === 'Insert') {
        event.preventDefault();
        if (!this._soloOnly()) return;
        this._setMenuOpen(!this.menuOpen);
        return;
      }
      if (event.code === 'Escape' && this.menuOpen) {
        this._setMenuOpen(false);
      }
    };

    window.addEventListener('keydown', this._onKeyDown, true);
    this._syncUi();
  }

  _loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULTS };
      const p = JSON.parse(raw);
      return {
        enabled: p.enabled !== false,
        fovDeg: clampNum(p.fovDeg, 3, 50, DEFAULTS.fovDeg),
        smooth: clampNum(p.smooth, 2, 40, DEFAULTS.smooth),
        target: p.target === 'body' ? 'body' : 'head',
        showFov: p.showFov !== false,
        sticky: p.sticky !== false,
        triggerbot: !!p.triggerbot,
        noRecoil: p.noRecoil !== false,
        perfectShot: p.perfectShot !== false,
        esp: p.esp !== false,
        espNames: p.espNames !== false,
        priority: ['crosshair', 'distance', 'health'].includes(p.priority) ? p.priority : 'crosshair',
        snap: !!p.snap,
      };
    } catch {
      return { ...DEFAULTS };
    }
  }

  _saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        enabled: this.enabled,
        fovDeg: this.fovDeg,
        smooth: this.smooth,
        target: this.targetZone,
        showFov: this.showFov,
        sticky: this.sticky,
        triggerbot: this.triggerbot,
        noRecoil: this.noRecoil,
        perfectShot: this.perfectShot,
        esp: this.esp,
        espNames: this.espNames,
        priority: this.priority,
        snap: this.snap,
      }));
    } catch {}
  }

  _buildUi() {
    const root = this.game.hudRoot || document.body;
    const style = document.createElement('style');
    style.textContent = `
      #contra-aim-chip {
        position:absolute; right:18px; bottom:18px; z-index:90;
        padding:9px 12px; border:1px solid rgba(189,224,115,.55);
        background:rgba(4,8,6,.84); color:#e8f6c7;
        font:800 11px/1.15 Arial,sans-serif; letter-spacing:.085em;
        text-transform:uppercase; box-shadow:0 10px 30px rgba(0,0,0,.38);
        backdrop-filter:blur(10px); pointer-events:none;
      }
      #contra-aim-panel {
        position:absolute; top:50%; left:50%; z-index:240;
        width:min(430px,calc(100vw - 24px)); max-height:min(720px,calc(100vh - 24px));
        overflow:auto; transform:translate(-50%,-50%) scale(.96);
        opacity:0; pointer-events:none;
        background:linear-gradient(180deg,rgba(14,18,15,.985),rgba(5,8,6,.985));
        border:1px solid rgba(189,224,115,.42); border-radius:15px;
        color:#edf5da; font:600 13px/1.35 Arial,sans-serif;
        box-shadow:0 28px 100px rgba(0,0,0,.68);
        transition:opacity .12s ease,transform .12s ease;
      }
      #contra-aim-panel.open { opacity:1; transform:translate(-50%,-50%) scale(1); pointer-events:auto; }
      #contra-aim-panel * { box-sizing:border-box; }
      .ca-head { display:flex; align-items:center; justify-content:space-between; padding:16px 17px 13px; border-bottom:1px solid rgba(255,255,255,.08); }
      .ca-title { font-size:16px; font-weight:900; letter-spacing:.13em; }
      .ca-sub { color:rgba(237,245,218,.5); font-size:10px; margin-top:3px; }
      .ca-close { border:0; background:rgba(255,255,255,.07); color:#eef6da; border-radius:8px; width:32px; height:32px; font-size:18px; cursor:pointer; }
      .ca-body { padding:14px 17px 17px; display:grid; gap:13px; }
      .ca-section { color:#b7cd86; font-size:10px; font-weight:900; letter-spacing:.16em; margin-top:3px; }
      .ca-row { display:grid; gap:7px; }
      .ca-line { display:flex; align-items:center; justify-content:space-between; gap:12px; min-height:30px; }
      .ca-label { font-weight:850; letter-spacing:.035em; }
      .ca-value { color:#cfe49d; font-variant-numeric:tabular-nums; }
      #contra-aim-panel input[type="range"] { width:100%; accent-color:#badf72; }
      .ca-toggle { width:46px; height:25px; border-radius:999px; border:0; cursor:pointer; background:#343b31; padding:3px; transition:.15s; flex:0 0 auto; }
      .ca-toggle::after { content:""; display:block; width:19px; height:19px; border-radius:50%; background:#fff; transition:.15s; }
      .ca-toggle.on { background:#8ebd43; }
      .ca-toggle.on::after { transform:translateX(21px); }
      .ca-tabs { display:grid; grid-template-columns:repeat(3,1fr); gap:7px; }
      .ca-tabs.two { grid-template-columns:repeat(2,1fr); }
      .ca-tab { border:1px solid rgba(255,255,255,.10); border-radius:9px; padding:9px 8px; background:rgba(255,255,255,.045); color:#dce7c7; cursor:pointer; font-weight:850; font-size:11px; }
      .ca-tab.active { border-color:rgba(189,224,115,.65); background:rgba(189,224,115,.14); color:#efffd2; }
      .ca-note { border-top:1px solid rgba(255,255,255,.07); padding-top:11px; color:rgba(237,245,218,.48); font-size:10px; line-height:1.45; }
      #contra-fov-ring { position:fixed; z-index:68; left:50%; top:50%; transform:translate(-50%,-50%); border:1px solid rgba(196,235,119,.36); border-radius:50%; pointer-events:none; box-shadow:0 0 18px rgba(196,235,119,.06) inset; }
      #contra-target-dot { position:fixed; z-index:72; width:8px; height:8px; margin:-4px 0 0 -4px; border-radius:50%; border:1px solid rgba(255,255,255,.9); background:rgba(189,224,115,.7); pointer-events:none; display:none; }
      #contra-hit-feedback { position:fixed; z-index:95; left:50%; top:56%; transform:translate(-50%,-50%) scale(.92); opacity:0; pointer-events:none; padding:5px 9px; border-radius:7px; background:rgba(0,0,0,.48); color:#fff; font:900 13px/1 Arial,sans-serif; letter-spacing:.08em; text-shadow:0 1px 4px #000; transition:opacity .08s ease, transform .08s ease; }
      #contra-hit-feedback.show { opacity:1; transform:translate(-50%,-50%) scale(1); }
      #contra-hit-feedback.head { color:#ffe899; }
      #contra-hit-feedback.kill { color:#dfffa2; font-size:15px; }
      #contra-esp-layer { position:fixed; inset:0; z-index:66; pointer-events:none; overflow:hidden; }
      .contra-esp-box { position:fixed; border:1px solid rgba(255,90,90,.78); box-shadow:0 0 8px rgba(0,0,0,.7); }
      .contra-esp-label { position:absolute; left:50%; bottom:100%; transform:translateX(-50%); white-space:nowrap; margin-bottom:3px; padding:2px 5px; border-radius:4px; background:rgba(0,0,0,.62); color:#fff; font:800 10px/1.2 Arial,sans-serif; letter-spacing:.03em; }
      .contra-esp-hp { position:absolute; left:-5px; bottom:0; width:2px; background:rgba(150,235,95,.9); }
      .contra-esp-box.locked { border-width:2px; box-shadow:0 0 12px rgba(226,255,148,.45); }
    `;
    document.head.appendChild(style);

    const chip = document.createElement('div');
    chip.id = 'contra-aim-chip';
    root.appendChild(chip);

    const ring = document.createElement('div');
    ring.id = 'contra-fov-ring';
    document.body.appendChild(ring);

    const dot = document.createElement('div');
    dot.id = 'contra-target-dot';
    document.body.appendChild(dot);

    const hit = document.createElement('div');
    hit.id = 'contra-hit-feedback';
    document.body.appendChild(hit);

    const espLayer = document.createElement('div');
    espLayer.id = 'contra-esp-layer';
    document.body.appendChild(espLayer);

    const panel = document.createElement('div');
    panel.id = 'contra-aim-panel';
    panel.innerHTML = `
      <div class="ca-head">
        <div>
          <div class="ca-title">CONTRA TRAINER</div>
          <div class="ca-sub">SOLO BOTS ONLY · INSERT MENU</div>
        </div>
        <button class="ca-close" type="button">×</button>
      </div>
      <div class="ca-body">
        <div class="ca-section">AIM</div>
        <div class="ca-line"><div><div class="ca-label">AIM LOCK</div><div class="ca-sub">F6 QUICK TOGGLE</div></div><button class="ca-toggle" data-role="enabled"></button></div>
        <div class="ca-line"><div class="ca-label">STICKY TARGET</div><button class="ca-toggle" data-role="sticky"></button></div>
        <div class="ca-line"><div class="ca-label">SNAP MODE</div><button class="ca-toggle" data-role="snap"></button></div>

        <div class="ca-row"><div class="ca-line"><span class="ca-label">FOV</span><span class="ca-value" data-role="fov-value"></span></div><input data-role="fov" type="range" min="3" max="50" step="1"></div>
        <div class="ca-row"><div class="ca-line"><span class="ca-label">SMOOTH</span><span class="ca-value" data-role="smooth-value"></span></div><input data-role="smooth" type="range" min="2" max="40" step="1"></div>

        <div class="ca-row"><div class="ca-label">TARGET ZONE</div><div class="ca-tabs two"><button class="ca-tab" data-target="head">HEAD</button><button class="ca-tab" data-target="body">BODY</button></div></div>
        <div class="ca-row"><div class="ca-label">TARGET PRIORITY</div><div class="ca-tabs"><button class="ca-tab" data-priority="crosshair">CROSSHAIR</button><button class="ca-tab" data-priority="distance">DISTANCE</button><button class="ca-tab" data-priority="health">LOW HP</button></div></div>

        <div class="ca-section">COMBAT</div>
        <div class="ca-line"><div><div class="ca-label">TRIGGERBOT</div><div class="ca-sub">F7 QUICK TOGGLE</div></div><button class="ca-toggle" data-role="triggerbot"></button></div>
        <div class="ca-line"><div class="ca-label">PERFECT SHOT</div><button class="ca-toggle" data-role="perfect-shot"></button></div>
        <div class="ca-line"><div class="ca-label">NO RECOIL</div><button class="ca-toggle" data-role="no-recoil"></button></div>

        <div class="ca-section">VISUALS</div>
        <div class="ca-line"><div><div class="ca-label">ESP</div><div class="ca-sub">F8 QUICK TOGGLE</div></div><button class="ca-toggle" data-role="esp"></button></div>
        <div class="ca-line"><div class="ca-label">ESP NAMES / HP / DISTANCE</div><button class="ca-toggle" data-role="esp-names"></button></div>
        <div class="ca-line"><div class="ca-label">SHOW FOV CIRCLE</div><button class="ca-toggle" data-role="show-fov"></button></div>

        <div class="ca-note">Hard-limited to Solo + AI bots. Multiplayer disables Aim Lock, Triggerbot, No Recoil and ESP automatically.</div>
      </div>
    `;
    root.appendChild(panel);

    const q = (selector) => panel.querySelector(selector);
    const ui = {
      chip, ring, dot, hit, espLayer, panel,
      close: q('.ca-close'),
      enabled: q('[data-role="enabled"]'),
      sticky: q('[data-role="sticky"]'),
      snap: q('[data-role="snap"]'),
      triggerbot: q('[data-role="triggerbot"]'),
      perfectShot: q('[data-role="perfect-shot"]'),
      noRecoil: q('[data-role="no-recoil"]'),
      esp: q('[data-role="esp"]'),
      espNames: q('[data-role="esp-names"]'),
      showFov: q('[data-role="show-fov"]'),
      fov: q('[data-role="fov"]'),
      fovValue: q('[data-role="fov-value"]'),
      smooth: q('[data-role="smooth"]'),
      smoothValue: q('[data-role="smooth-value"]'),
      targetButtons: [...panel.querySelectorAll('[data-target]')],
      priorityButtons: [...panel.querySelectorAll('[data-priority]')],
    };

    const bindToggle = (el, prop) => el.addEventListener('click', () => {
      this[prop] = !this[prop];
      this._saveSettings();
      this._syncUi();
    });

    ui.close.addEventListener('click', () => this._setMenuOpen(false));
    bindToggle(ui.enabled, 'enabled');
    bindToggle(ui.sticky, 'sticky');
    bindToggle(ui.snap, 'snap');
    bindToggle(ui.triggerbot, 'triggerbot');
    bindToggle(ui.perfectShot, 'perfectShot');
    bindToggle(ui.noRecoil, 'noRecoil');
    bindToggle(ui.esp, 'esp');
    bindToggle(ui.espNames, 'espNames');
    bindToggle(ui.showFov, 'showFov');

    ui.fov.addEventListener('input', () => {
      this.fovDeg = clampNum(ui.fov.value, 3, 50, DEFAULTS.fovDeg);
      this.fov = THREE.MathUtils.degToRad(this.fovDeg);
      this._saveSettings();
      this._syncUi();
    });
    ui.smooth.addEventListener('input', () => {
      this.smooth = clampNum(ui.smooth.value, 2, 40, DEFAULTS.smooth);
      this._saveSettings();
      this._syncUi();
    });

    for (const button of ui.targetButtons) button.addEventListener('click', () => {
      this.targetZone = button.dataset.target === 'body' ? 'body' : 'head';
      this._saveSettings();
      this._syncUi();
    });
    for (const button of ui.priorityButtons) button.addEventListener('click', () => {
      this.priority = button.dataset.priority;
      this._saveSettings();
      this._syncUi();
    });

    panel.addEventListener('mousedown', (event) => event.stopPropagation());
    panel.addEventListener('click', (event) => event.stopPropagation());

    return ui;
  }

  _setMenuOpen(open) {
    this.menuOpen = !!open && this._soloOnly();
    this._ui?.panel?.classList.toggle('open', this.menuOpen);
    if (this.menuOpen && document.pointerLockElement) {
      document.exitPointerLock?.();
    } else if (!this.menuOpen && this._soloOnly() && this.game.state.phase !== 'menu') {
      this.game.input?.requestLock?.();
    }
    this._syncUi();
  }

  _soloOnly() {
    const g = this.game;
    return g.sessionMode === 'solo' && !(g.multiplayer && g.multiplayer.active);
  }

  _isEnemy(bot) {
    const p = this.game.player;
    return !!bot && bot.alive && bot.pos && p && bot.team !== p.team;
  }

  _visible(eye, target, distance) {
    const world = this.game.world;
    if (!world || typeof world.raycast !== 'function') return true;
    _dir.copy(target).sub(eye);
    const len = _dir.length();
    if (len < 0.001) return true;
    _dir.multiplyScalar(1 / len);
    const hit = world.raycast(eye, _dir, Math.max(0.01, distance - 0.25));
    return !hit;
  }

  _solution(bot) {
    const p = this.game.player;
    if (!this._isEnemy(bot) || !p) return null;

    _eye.set(p.position.x, p.position.y + p.eyeHeight, p.position.z);
    const height = Number(bot.height) || 1.83;
    const ratio = this.targetZone === 'body' ? 0.62 : 0.90;
    _target.set(bot.pos.x, bot.pos.y + height * ratio, bot.pos.z);

    const dx = _target.x - _eye.x;
    const dy = _target.y - _eye.y;
    const dz = _target.z - _eye.z;
    const horizontal = Math.hypot(dx, dz);
    const distance = Math.hypot(horizontal, dy);
    if (distance < 0.01) return null;

    const targetYaw = Math.atan2(-dx, -dz);
    const targetPitch = Math.atan2(dy, Math.max(horizontal, 0.0001));
    const yawDiff = wrapAngle(targetYaw - p.yaw);
    const pitchDiff = targetPitch - p.pitch;
    const angle = Math.hypot(yawDiff, pitchDiff);
    const visible = this._visible(_eye, _target, distance);

    return { bot, targetYaw, targetPitch, yawDiff, pitchDiff, angle, distance, visible };
  }

  _score(sol) {
    if (this.priority === 'distance') return sol.distance + sol.angle * 5;
    if (this.priority === 'health') return (Number(sol.bot.health) || 100) * 0.15 + sol.angle * 10;
    return sol.angle + sol.distance * 0.0005;
  }

  _pickTarget() {
    const bots = this.game.bots?.all;
    if (!Array.isArray(bots)) return null;

    if (this.sticky && this.target) {
      const sticky = this._solution(this.target);
      if (sticky && sticky.visible && sticky.angle <= this.fov * 1.35) return sticky;
    }

    let best = null;
    let bestScore = Infinity;
    for (const bot of bots) {
      const sol = this._solution(bot);
      if (!sol || !sol.visible || sol.angle > this.fov) continue;
      const score = this._score(sol);
      if (score < bestScore) {
        bestScore = score;
        best = sol;
      }
    }
    return best;
  }

  _applyNoRecoil() {
    if (!this.noRecoil || !this._soloOnly()) return;
    const w = this.game.weapons;
    if (w) {
      if ('_driftP' in w) w._driftP = 0;
      if ('_driftY' in w) w._driftY = 0;
      if ('_bloom' in w) w._bloom = 0;
    }
    const p = this.game.player;
    if (p) {
      if ('_punchPitch' in p) p._punchPitch = 0;
      if ('_punchYaw' in p) p._punchYaw = 0;
    }
  }

  _tryTrigger(sol) {
    if (!this.triggerbot || !sol || !sol.visible) return;
    if (!['live', 'planted'].includes(this.game.state.phase)) return;
    const threshold = this.targetZone === 'head' ? 0.010 : 0.014;
    if (sol.angle > threshold) return;

    const w = this.game.weapons;
    const p = this.game.player;
    if (!w || !p || typeof w._tryFire !== 'function') return;
    const def = w.current?.();
    if (!def || def.slot === 4) return;
    w._tryFire(def, p);
  }

  _projectPoint(vec) {
    const cam = this.game.camera;
    if (!cam) return null;
    const v = vec.clone().project(cam);
    if (v.z < -1 || v.z > 1) return null;
    return {
      x: (v.x * 0.5 + 0.5) * window.innerWidth,
      y: (-v.y * 0.5 + 0.5) * window.innerHeight,
      ndcX: v.x,
      ndcY: v.y,
    };
  }

  _espNode(bot) {
    let node = this._espNodes.get(bot);
    if (node) return node;
    node = document.createElement('div');
    node.className = 'contra-esp-box';
    node.innerHTML = '<div class="contra-esp-label"></div><div class="contra-esp-hp"></div>';
    this._ui.espLayer.appendChild(node);
    this._espNodes.set(bot, node);
    return node;
  }

  _updateEsp() {
    const allowed = this._soloOnly() && this.esp && this.game.state.phase !== 'menu';
    const bots = this.game.bots?.all || [];
    const active = new Set();

    if (allowed) {
      const player = this.game.player;
      for (const bot of bots) {
        if (!this._isEnemy(bot)) continue;
        active.add(bot);
        const h = Number(bot.height) || 1.83;
        _feet.set(bot.pos.x, bot.pos.y + 0.03, bot.pos.z);
        _head.set(bot.pos.x, bot.pos.y + h, bot.pos.z);
        const a = this._projectPoint(_feet);
        const b = this._projectPoint(_head);
        const node = this._espNode(bot);
        if (!a || !b || Math.abs(a.ndcX) > 1.25 || Math.abs(b.ndcX) > 1.25) {
          node.style.display = 'none';
          continue;
        }

        const height = Math.max(18, Math.abs(a.y - b.y));
        const width = Math.max(10, height * 0.42);
        node.style.display = 'block';
        node.style.left = (b.x - width / 2) + 'px';
        node.style.top = b.y + 'px';
        node.style.width = width + 'px';
        node.style.height = height + 'px';
        node.classList.toggle('locked', bot === this.target);

        const label = node.querySelector('.contra-esp-label');
        const hp = Math.max(0, Math.round(Number(bot.health) || 0));
        const dist = player?.position ? Math.round(player.position.distanceTo(bot.pos)) : 0;
        label.style.display = this.espNames ? 'block' : 'none';
        if (this.espNames) label.textContent = bot.name + ' · ' + hp + 'HP · ' + dist + 'm';

        const hpBar = node.querySelector('.contra-esp-hp');
        hpBar.style.height = Math.max(0, Math.min(100, hp)) + '%';
      }
    }

    for (const [bot, node] of this._espNodes) {
      if (!active.has(bot)) node.style.display = 'none';
    }
  }

  _syncUi() {
    const ui = this._ui;
    if (!ui) return;
    const allowed = this._soloOnly();
    const visible = allowed && this.game.state.phase !== 'menu';

    ui.chip.style.display = visible ? 'block' : 'none';
    ui.chip.textContent =
      'AIM ' + (this.enabled ? 'ON' : 'OFF') +
      ' · TRG ' + (this.triggerbot ? 'ON' : 'OFF') +
      ' · ESP ' + (this.esp ? 'ON' : 'OFF') +
      ' · INSERT';
    ui.chip.style.opacity = this.enabled || this.triggerbot || this.esp ? '1' : '.5';

    if (!allowed && this.menuOpen) this.menuOpen = false;
    ui.panel.classList.toggle('open', this.menuOpen && allowed);

    const toggles = [
      [ui.enabled, this.enabled],
      [ui.sticky, this.sticky],
      [ui.snap, this.snap],
      [ui.triggerbot, this.triggerbot],
      [ui.perfectShot, this.perfectShot],
      [ui.noRecoil, this.noRecoil],
      [ui.esp, this.esp],
      [ui.espNames, this.espNames],
      [ui.showFov, this.showFov],
    ];
    for (const [el, on] of toggles) el.classList.toggle('on', !!on);

    ui.fov.value = String(Math.round(this.fovDeg));
    ui.fovValue.textContent = Math.round(this.fovDeg) + '°';
    ui.smooth.value = String(Math.round(this.smooth));
    ui.smoothValue.textContent = String(Math.round(this.smooth));

    for (const button of ui.targetButtons) button.classList.toggle('active', button.dataset.target === this.targetZone);
    for (const button of ui.priorityButtons) button.classList.toggle('active', button.dataset.priority === this.priority);

    const ringVisible = visible && this.enabled && this.showFov && !this.menuOpen;
    ui.ring.style.display = ringVisible ? 'block' : 'none';
    if (ringVisible) {
      const cameraFov = THREE.MathUtils.degToRad(this.game.camera?.fov || 74);
      const diameter = Math.max(36, Math.min(window.innerHeight * 0.95,
        2 * Math.tan(this.fov / 2) / Math.tan(cameraFov / 2) * window.innerHeight));
      ui.ring.style.width = diameter + 'px';
      ui.ring.style.height = diameter + 'px';
    }

    ui.dot.style.display = 'none';
  }

  _showHitFeedback(detail = {}) {
    if (!this._soloOnly() || !this._ui?.hit) return;
    const damage = Math.max(0, Math.round(Number(detail.damage) || 0));
    const head = !!detail.headshot;
    const kill = !!detail.kill;
    const text = kill
      ? (head ? 'HEADSHOT · KILL' : 'KILL')
      : (head ? ('HEAD +' + damage) : ('HIT +' + damage));
    const el = this._ui.hit;
    el.textContent = text;
    el.classList.toggle('head', head && !kill);
    el.classList.toggle('kill', kill);
    el.classList.add('show');
    this._hitTimer = 0.22;
  }

  update(dt) {
    if (this._hitTimer > 0) {
      this._hitTimer -= Math.max(0, Number(dt) || 0);
      if (this._hitTimer <= 0) this._ui?.hit?.classList.remove('show');
    }
    this._syncUi();
    this._updateEsp();

    if (!this._soloOnly()) {
      this.target = null;
      return;
    }

    this._applyNoRecoil();

    const p = this.game.player;
    if (this.menuOpen || !p?.alive || !['freeze', 'live', 'planted'].includes(this.game.state.phase)) {
      this.target = null;
      return;
    }

    let sol = null;
    if (this.enabled || this.triggerbot) sol = this._pickTarget();
    this.target = sol?.bot || null;

    if (this.enabled && sol) {
      const t = this.snap ? 1 : (1 - Math.exp(-this.smooth * Math.max(0, dt || 0)));
      const yawStep = wrapAngle(sol.targetYaw - p.yaw) * t;
      const pitchStep = (sol.targetPitch - p.pitch) * t;
      p.yaw += yawStep;
      p.pitch = THREE.MathUtils.clamp(p.pitch + pitchStep, -1.45, 1.45);
      if (this.game.camera) {
        this.game.camera.rotation.y += yawStep;
        this.game.camera.rotation.x += pitchStep;
      }
      sol = this._solution(sol.bot) || sol;
    }

    if (sol) {
      const h = Number(sol.bot.height) || 1.83;
      const ratio = this.targetZone === 'body' ? 0.62 : 0.90;
      _target.set(sol.bot.pos.x, sol.bot.pos.y + h * ratio, sol.bot.pos.z);
      const screen = this._projectPoint(_target);
      if (screen && this.enabled) {
        this._ui.dot.style.display = 'block';
        this._ui.dot.style.left = screen.x + 'px';
        this._ui.dot.style.top = screen.y + 'px';
      }
    }

    this._tryTrigger(sol);
  }
}