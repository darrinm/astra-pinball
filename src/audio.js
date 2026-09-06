export class AudioEngine {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.last = 0;
  }
  unlock() {
    if (!this.ctx) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      this.ctx = new Audio();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }
  tone(freq, duration = 0.12, type = "sine", volume = 0.4, delay = 0, end) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime + delay,
      o = this.ctx.createOscillator(),
      g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, now);
    if (end) o.frequency.exponentialRampToValueAtTime(end, now + duration);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(volume, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    o.connect(g);
    g.connect(this.master);
    o.start(now);
    o.stop(now + duration + 0.01);
  }
  play(type) {
    if (type === "bumper") {
      this.tone(700 + Math.random() * 250, 0.14, "sine", 0.6);
      this.tone(170, 0.08, "triangle", 0.25);
    } else if (type === "flipper" || type === "sling") {
      this.tone(135, 0.07, "triangle", 0.45, 0, 45);
    } else if (type === "wall") {
      if (performance.now() - this.last < 70) return;
      this.last = performance.now();
      this.tone(270, 0.035, "triangle", 0.1);
    } else if (type === "launch") this.tone(90, 0.3, "sawtooth", 0.18, 0, 650);
    else if (["target", "lock", "castle", "swirl"].includes(type)) {
      [523, 659, 784].forEach((n, i) =>
        this.tone(n, 0.2, "sine", 0.4, i * 0.055),
      );
    } else if (
      [
        "ramp",
        "combo",
        "rush",
        "multiball",
        "jackpot",
        "start",
        "save",
      ].includes(type)
    ) {
      [523, 659, 784, 1047, 1319].forEach((n, i) =>
        this.tone(n, 0.28, "triangle", 0.3, i * 0.075),
      );
    } else if (type === "tilt") {
      this.tone(110, 0.7, "sawtooth", 0.3, 0, 45);
    } else if (type === "drain" || type === "gameover") {
      [392, 330, 262, 196].forEach((n, i) =>
        this.tone(n, 0.3, "sine", 0.3, i * 0.1),
      );
    } else if (type === "nudge") this.tone(65, 0.1, "triangle", 0.5);
  }
}
