// Contra Strike - optional third-person shoulder camera.
// Works only at the render stage, so weapon spread, muzzle physics,
// headshots, network snapshots and first-person aiming stay unchanged.
import * as THREE from 'three';
import { getCharacterPalette } from './profile.js';

const _back = new THREE.Vector3();
const _right = new THREE.Vector3();
const _focus = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _delta = new THREE.Vector3();
const _origin = new THREE.Vector3();

export default class ThirdPerson {
  constructor(game) {
    this.game = game;
    const params = new URLSearchParams(globalThis.location?.search || '');
    this.enabled = params.has('thirdperson') && params.get('thirdperson') !== '0';
    this.distance = 3.35;
    this.shoulder = 0.58;
    this.height = 0.42;
    this._initialized = false;
    this._savedPosition = new THREE.Vector3();
    this._smoothPosition = new THREE.Vector3();
    this._viewModelVisibility = false;
    this._isRenderingThirdPerson = false;
    this.actor = {
      team: game.player.team,
      pos: new THREE.Vector3(),
      yaw: 0,
      pitch: 0,
      alive: true,
      crouching: false,
      moveSpeed: 0,
      moveSpeed2D: 0,
      weaponId: 'm4a1',
      blindUntil: 0,
      fireAnim: 0,
      burstLeft: 0,
    };
    this.actor.mesh = game.bots.createOperativeVisual(
      this.actor,
      getCharacterPalette(game.player.characterId, game.player.team)
    );
    this.actor.mesh.name = 'local-third-person-operative';
    this.actor.mesh.visible = false;
    game.scene.add(this.actor.mesh);

    this.badge = document.createElement('button');
    this.badge.type = 'button';
    this.badge.id = 'perspective-toggle';
    this.badge.textContent = '';
    this.badge.title = 'Switch first-person / third-person camera (V)';
    this.badge.style.cssText =
      'position:fixed;right:14px;top:14px;z-index:1021;' +
      'background:rgba(8,13,18,.82);border:1px solid rgba(199,226,158,.42);' +
      'border-radius:7px;padding:9px 13px;color:#d7ecc0;font:800 11px system-ui,Arial;' +
      'letter-spacing:.08em;cursor:pointer;box-shadow:0 7px 26px #0007;';
    document.body.appendChild(this.badge);
    this.badge.addEventListener('click', () => this.toggle());
    this._keyListener = event => {
      if (event.code !== 'KeyV' || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (target && (target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(target.tagName || ''))) return;
      event.preventDefault();
      this.toggle();
    };
    window.addEventListener('keydown', this._keyListener, true);
    game.events.on('weapon:fire', event => {
      if (event?.byPlayer || event?.shooter === 'player') this.actor.fireAnim = 0.8;
    });
    game.events.on('profile:changed', () => this._rebuildAvatar());
    this._showMode();
  }

  _rebuildAvatar() {
    const p = this.game.player;
    if (!p) return;
    this.actor.team = p.team;
    this.game.bots.rebuildOperativeVisual(
      this.actor, getCharacterPalette(p.characterId, p.team)
    );
  }

  toggle(next = !this.enabled) {
    this.enabled = !!next;
    this._initialized = false;
    this._showMode();
    if (!this.enabled && this.actor.mesh) this.actor.mesh.visible = false;
    return this.enabled;
  }

  _showMode() {
    this.badge.textContent = this.enabled ? '◉ THIRD PERSON  ·  V' : '◎ FIRST PERSON  ·  V';
    this.badge.style.borderColor = this.enabled ? 'rgba(199,226,158,.6)' : 'rgba(170,185,200,.35)';
    this.badge.style.color = this.enabled ? '#d7ecc0' : '#aebdcc';
  }

  _syncAvatar(dt) {
    const g = this.game, p = g.player;
    if (this.actor.team !== p.team || this._characterId !== p.characterId) {
      this._characterId = p.characterId;
      this._rebuildAvatar();
    }
    this.actor.pos.copy(p.position);
    this.actor.yaw = p.yaw;
    this.actor.pitch = p.pitch;
    this.actor.alive = p.alive;
    this.actor.crouching = p.crouching;
    this.actor.moveSpeed2D = Number(p.moveSpeed2D) || 0;
    this.actor.weaponId = g.weapons?.currentId || 'm4a1';
    this.actor.mesh.visible = this.enabled && p.alive && g.state.phase !== 'menu';
    if (this.actor.mesh.visible) {
      g.bots.updateOperativeVisual(this.actor, dt);
    }
  }

  // Only the camera used for drawing moves. Combat and aiming still work
  // from the actual player eye position. Model is hidden for AWP scope.
  beforeRender(dt) {
    const g = this.game, cam = g.camera, p = g.player;
    this._isRenderingThirdPerson = false;
    this._syncAvatar(dt);
    if (!this.enabled || !p.alive || g.state.phase === 'menu' || g.weapons?.isScoped?.()) {
      if (this.actor.mesh) this.actor.mesh.visible = false;
      return;
    }

    this._savedPosition.copy(cam.position);
    this._viewModelVisibility = !!g.viewmodel?.rig?.visible;

    _back.set(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));
    _right.set(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
    _origin.copy(this._savedPosition);
    _origin.y = p.position.y + Math.max(1.1, p.eyeHeight) - 0.06;
    _desired.copy(_origin)
      .addScaledVector(_back, -this.distance)
      .addScaledVector(_right, this.shoulder);
    _desired.y += this.height;

    // Stop 0.2m before a wall along the shoulder-camera line.
    _delta.copy(_desired).sub(_origin);
    const len = _delta.length();
    const ray = len > 0.01
      ? g.world?.raycast?.(_origin, _delta.multiplyScalar(1 / len), len)
      : null;
    if (ray && Number.isFinite(ray.distance)) {
      _desired.copy(_origin).addScaledVector(_delta, Math.max(0.25, ray.distance - 0.2));
    }

    if (!this._initialized || this._smoothPosition.distanceToSquared(_desired) > 100) {
      this._smoothPosition.copy(_desired);
      this._initialized = true;
    } else {
      this._smoothPosition.lerp(_desired, 1 - Math.exp(-13 * Math.max(0.001, dt)));
    }

    cam.position.copy(this._smoothPosition);
    if (g.viewmodel?.rig) g.viewmodel.rig.visible = false;
    this._isRenderingThirdPerson = true;
  }

  afterRender() {
    if (!this._isRenderingThirdPerson) return;
    this.game.camera.position.copy(this._savedPosition);
    if (this.game.viewmodel?.rig)
      this.game.viewmodel.rig.visible = this._viewModelVisibility;
    this._isRenderingThirdPerson = false;
  }

  dispose() {
    window.removeEventListener('keydown', this._keyListener, true);
    this.badge?.remove();
    if (this.actor) this.game.bots.destroyOperativeVisual(this.actor);
  }
}
