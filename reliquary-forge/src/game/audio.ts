import type { CombatEvent } from "./simulation/simulation";

type ToneOptions = {
  frequency: number;
  endFrequency: number;
  duration: number;
  gain: number;
  type: OscillatorType;
  pan?: number;
};

export class ForgeAudio {
  readonly errors: string[] = [];
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private effects: GainNode | null = null;
  private music: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private started = false;
  private muted = false;

  async unlock(): Promise<void> {
    if (!this.context) this.createGraph();
    if (!this.context) return;
    await this.context.resume();
    if (!this.started) {
      this.started = true;
      this.startMusic();
      this.tone({ frequency: 164, endFrequency: 328, duration: 0.38, gain: 0.1, type: "triangle" });
    }
  }

  handle(events: readonly CombatEvent[]): void {
    if (!this.context || this.context.state !== "running") return;
    for (const event of events) {
      if (event.type === "fire") {
        if (event.towerKind === "helios") {
          this.tone({ frequency: 880, endFrequency: 210, duration: 0.095, gain: 0.045, type: "sawtooth" });
          this.noise(0.055, 0.028, 3300);
        } else if (event.towerKind === "vortex") {
          this.tone({ frequency: 92, endFrequency: 43, duration: 0.42, gain: 0.12, type: "sine" });
          this.noise(0.24, 0.09, 420);
        } else {
          this.tone({ frequency: 1280, endFrequency: 520, duration: 0.18, gain: 0.035, type: "triangle" });
        }
      } else if (event.type === "hit") {
        if (event.critical) {
          this.tone({ frequency: 1160, endFrequency: 240, duration: 0.16, gain: 0.07, type: "square" });
          this.noise(0.13, 0.065, 1800);
        } else {
          this.noise(0.04, 0.018, 980);
        }
      } else if (event.type === "death") {
        const heavy = event.kind === "warden" || event.kind === "husk";
        this.tone({ frequency: heavy ? 82 : 190, endFrequency: heavy ? 31 : 72, duration: heavy ? 0.68 : 0.24, gain: heavy ? 0.14 : 0.055, type: "sawtooth" });
        this.noise(heavy ? 0.46 : 0.18, heavy ? 0.11 : 0.04, heavy ? 270 : 760);
      } else if (event.type === "build") {
        this.tone({ frequency: 246, endFrequency: 492, duration: 0.22, gain: 0.07, type: "triangle" });
        this.tone({ frequency: 369, endFrequency: 738, duration: 0.18, gain: 0.035, type: "sine", pan: 0.18 });
      } else if (event.type === "wave") {
        this.tone({ frequency: 58, endFrequency: 116, duration: 0.82, gain: 0.14, type: "sawtooth" });
        this.noise(0.62, 0.075, 260);
      } else if (event.type === "leak") {
        this.tone({ frequency: 120, endFrequency: 46, duration: 0.44, gain: 0.09, type: "square" });
      } else if (event.type === "victory") {
        this.chord([220, 277.18, 329.63, 440], 1.8, 0.055);
      } else if (event.type === "defeat") {
        this.chord([110, 116.54, 138.59], 2.2, 0.06);
      }
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.context && this.master) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.72, this.context.currentTime, 0.025);
    }
    return this.muted;
  }

  private createGraph(): void {
    try {
      const AudioContextClass = window.AudioContext;
      this.context = new AudioContextClass({ latencyHint: "interactive", sampleRate: 48000 });
      const master = this.context.createGain();
      master.gain.value = this.muted ? 0 : 0.72;
      const compressor = this.context.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 16;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.006;
      compressor.release.value = 0.22;
      const convolver = this.context.createConvolver();
      convolver.buffer = this.impulse(1.45, 2.6);
      const wet = this.context.createGain();
      wet.gain.value = 0.16;
      const effects = this.context.createGain();
      const music = this.context.createGain();
      music.gain.value = 0.12;
      effects.connect(master);
      effects.connect(convolver);
      convolver.connect(wet);
      wet.connect(master);
      music.connect(master);
      master.connect(compressor);
      compressor.connect(this.context.destination);
      this.master = master;
      this.effects = effects;
      this.music = music;
      this.noiseBuffer = this.makeNoiseBuffer(1.0);
    } catch (error) {
      this.errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  private startMusic(): void {
    if (!this.context || !this.music) return;
    const now = this.context.currentTime;
    const frequencies = [55, 82.41, 110];
    frequencies.forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      const filter = this.context!.createBiquadFilter();
      const lfo = this.context!.createOscillator();
      const lfoGain = this.context!.createGain();
      oscillator.type = index === 0 ? "sine" : "triangle";
      oscillator.frequency.value = frequency;
      gain.gain.value = index === 0 ? 0.055 : 0.018;
      filter.type = "lowpass";
      filter.frequency.value = 480 + index * 320;
      filter.Q.value = 0.8;
      lfo.frequency.value = 0.07 + index * 0.035;
      lfoGain.gain.value = 4 + index * 2;
      lfo.connect(lfoGain);
      lfoGain.connect(oscillator.detune);
      oscillator.connect(filter);
      filter.connect(gain);
      gain.connect(this.music!);
      oscillator.start(now);
      lfo.start(now);
    });
  }

  private tone(options: ToneOptions): void {
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const panner = this.context.createStereoPanner();
    oscillator.type = options.type;
    oscillator.frequency.setValueAtTime(options.frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, options.endFrequency), now + options.duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(options.gain, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + options.duration);
    panner.pan.value = options.pan ?? 0;
    oscillator.connect(gain);
    gain.connect(panner);
    panner.connect(this.effects);
    oscillator.start(now);
    oscillator.stop(now + options.duration + 0.03);
  }

  private noise(duration: number, gainValue: number, frequency: number): void {
    if (!this.context || !this.effects || !this.noiseBuffer) return;
    const now = this.context.currentTime;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    filter.Q.value = 0.65;
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.effects);
    source.start(now);
    source.stop(now + duration);
  }

  private chord(frequencies: number[], duration: number, gainValue: number): void {
    frequencies.forEach((frequency, index) => {
      this.tone({ frequency, endFrequency: frequency * (1 + index * 0.015), duration, gain: gainValue, type: index % 2 ? "triangle" : "sine", pan: (index - frequencies.length / 2) * 0.18 });
    });
  }

  private makeNoiseBuffer(seconds: number): AudioBuffer {
    if (!this.context) throw new Error("Audio context missing while creating noise buffer");
    const length = Math.floor(this.context.sampleRate * seconds);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    let value = 19471;
    for (let i = 0; i < length; i += 1) {
      value = (value * 48271) % 2147483647;
      data[i] = value / 1073741823.5 - 1;
    }
    return buffer;
  }

  private impulse(seconds: number, decay: number): AudioBuffer {
    if (!this.context) throw new Error("Audio context missing while creating impulse response");
    const length = Math.floor(this.context.sampleRate * seconds);
    const buffer = this.context.createBuffer(2, length, this.context.sampleRate);
    let value = 81233;
    for (let channel = 0; channel < 2; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i += 1) {
        value = (value * 16807) % 2147483647;
        const noise = value / 1073741823.5 - 1;
        data[i] = noise * Math.pow(1 - i / length, decay);
      }
    }
    return buffer;
  }
}
