/** 以 WebAudio 合成的簡單音效,不依賴任何音檔 */
export class Sfx {
  private ctx?: AudioContext;
  private master?: GainNode;
  private motor?: { osc: OscillatorNode; gain: GainNode; filter: BiquadFilterNode };
  muted = false;

  /** 必須在使用者操作後呼叫 */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    osc.connect(filter).connect(gain).connect(this.master);
    osc.start();
    this.motor = { osc, gain, filter };
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  /** level: 0~1 馬達運轉程度 */
  setMotor(level: number) {
    if (!this.ctx || !this.motor) return;
    const t = this.ctx.currentTime;
    this.motor.gain.gain.setTargetAtTime(level * 0.08, t, 0.06);
    this.motor.osc.frequency.setTargetAtTime(48 + level * 26, t, 0.1);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, slideTo?: number) {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  coin() {
    this.tone(988, 0.08, 'square', 0.12);
    this.tone(1319, 0.25, 'square', 0.12, 0.08);
  }
  click() {
    this.tone(660, 0.05, 'triangle', 0.1);
  }
  clack() {
    this.tone(180, 0.09, 'square', 0.14, 0, 90);
  }
  win(rare = false) {
    const notes = rare ? [523, 659, 784, 1047, 1319, 1568] : [523, 659, 784, 1047];
    notes.forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.16, i * 0.09));
  }
  fail() {
    this.tone(330, 0.3, 'sawtooth', 0.1, 0, 110);
  }
  drop() {
    this.tone(440, 0.4, 'sine', 0.1, 0, 120);
  }
}
