/** 鍵盤 + 虛擬搖桿(滑鼠/觸控皆可) */
export class Input {
  readonly move = { x: 0, z: 0 };
  private keys = new Set<string>();
  private joy = { x: 0, z: 0 };
  private dropQueued = false;
  private startQueued = false;

  constructor(joyEl: HTMLElement, knobEl: HTMLElement, dropEl: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        this.dropQueued = true;
        this.startQueued = true;
      }
      if (e.code.startsWith('Arrow')) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    // 虛擬搖桿
    let activeId = -1;
    const R = 46;
    const setKnob = (dx: number, dz: number) => {
      knobEl.style.transform = `translate(${dx}px, ${dz}px)`;
    };
    const update = (e: PointerEvent) => {
      const r = joyEl.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2);
      let dz = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dz);
      if (d > R) {
        dx = (dx / d) * R;
        dz = (dz / d) * R;
      }
      setKnob(dx, dz);
      this.joy.x = dx / R;
      this.joy.z = dz / R;
    };
    joyEl.addEventListener('pointerdown', (e) => {
      activeId = e.pointerId;
      joyEl.setPointerCapture(e.pointerId);
      update(e);
    });
    joyEl.addEventListener('pointermove', (e) => {
      if (e.pointerId === activeId) update(e);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== activeId) return;
      activeId = -1;
      this.joy.x = this.joy.z = 0;
      setKnob(0, 0);
    };
    joyEl.addEventListener('pointerup', end);
    joyEl.addEventListener('pointercancel', end);

    dropEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.dropQueued = true;
    });
  }

  poll() {
    const k = this.keys;
    let x = this.joy.x;
    let z = this.joy.z;
    if (k.has('ArrowLeft') || k.has('KeyA')) x -= 1;
    if (k.has('ArrowRight') || k.has('KeyD')) x += 1;
    if (k.has('ArrowUp') || k.has('KeyW')) z -= 1;
    if (k.has('ArrowDown') || k.has('KeyS')) z += 1;
    const m = Math.hypot(x, z);
    if (m > 1) {
      x /= m;
      z /= m;
    }
    // 搖桿死區
    this.move.x = Math.abs(x) < 0.12 ? 0 : x;
    this.move.z = Math.abs(z) < 0.12 ? 0 : z;
  }

  consumeDrop() {
    const v = this.dropQueued;
    this.dropQueued = false;
    return v;
  }

  consumeStart() {
    const v = this.startQueued;
    this.startQueued = false;
    return v;
  }
}
