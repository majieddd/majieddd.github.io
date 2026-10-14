import "./ui/style.css";
import { ForgeAudio } from "./game/audio";
import { Simulation } from "./game/simulation/simulation";
import { ForgeRenderer, type QualityLevel, type RenderStats } from "./render/game-renderer";
import { Hud } from "./ui/hud";

const FIXED_STEP = 1 / 60;
const MAX_FRAME_DT = 0.25;
const MAX_STEPS = 15;

type BenchmarkResult = {
  samples: number;
  p50: number;
  p95: number;
  p99: number;
  worst: number;
  drawCalls: number;
  triangles: number;
  particles: number;
  pixelRatio: number;
  quality: QualityLevel;
  enemies: number;
  towers: number;
  errors: number;
};

type ForgeProbe = {
  ready: Promise<void>;
  start: () => void;
  beginWave: () => boolean;
  buildAll: () => void;
  spawnStress: (count?: number) => void;
  benchmark: (frames?: number) => Promise<BenchmarkResult>;
  stats: () => RenderStats;
  state: () => ReturnType<Simulation["snapshot"]>;
  errors: () => readonly string[];
  setQuality: (quality: QualityLevel) => void;
  resetCamera: () => void;
  orbitCamera: (yaw: number, pitch: number, distance: number) => void;
  shadowState: () => ReturnType<ForgeRenderer["shadowState"]>;
  animationState: (enemyId: number) => Record<string, number[]>;
  groundingState: () => ReturnType<ForgeRenderer["groundingState"]>;
  facingState: () => ReturnType<ForgeRenderer["facingState"]>;
  visualState: () => ReturnType<ForgeRenderer["visualState"]>;
  buildAt: (kind: "helios" | "vortex" | "rime", slot: number) => boolean;
  spawnLineup: () => number[];
};

declare global {
  interface Window {
    __FORGE: ForgeProbe;
  }
}

function required<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Required app element missing: ${id}`);
  return element as T;
}

class GameApp {
  readonly simulation = new Simulation();
  readonly audio = new ForgeAudio();
  readonly renderer: ForgeRenderer;
  readonly hud: Hud;
  readonly errors: string[] = [];
  readonly ready: Promise<void>;
  private running = false;
  private accumulator = 0;
  private lastTime = 0;
  private hudTimer = 0;

  constructor() {
    const canvas = required<HTMLCanvasElement>("game-canvas");
    this.renderer = new ForgeRenderer(canvas);
    this.hud = new Hud({
      onSelect: (kind) => this.renderer.setSelectedKind(kind),
      onWave: () => {
        if (this.simulation.startWave()) this.hud.toast(`Wave ${this.simulation.wave} entering the Coil.`);
      },
    });
    const enterButton = required<HTMLButtonElement>("enter-button");
    const bootStatus = required<HTMLElement>("boot-status");
    const bootProgress = required<HTMLElement>("boot-progress");
    this.ready = this.renderer.load((progress, label) => {
      bootStatus.textContent = label;
      bootProgress.style.setProperty("--boot-progress", String(progress));
    }).then(() => {
      bootStatus.textContent = "Eight painted warforms tempered. The field is ready.";
      enterButton.disabled = false;
    }).catch((error: unknown) => {
      this.recordError(error);
      bootStatus.textContent = "A warform failed to temper. See the diagnostics log.";
      throw error;
    });
    enterButton.addEventListener("click", () => {
      void this.audio.unlock().catch((error: unknown) => this.recordError(error));
      this.start();
    });
    canvas.addEventListener("pointerup", (event) => {
      if (!this.running || this.renderer.cameraController.wasDrag()) return;
      const slot = this.renderer.pickSlot(event.clientX, event.clientY);
      if (slot < 0) return;
      if (this.simulation.buildTower(this.hud.selectedKind, slot)) {
        this.hud.toast(`${this.hud.selectedKind === "helios" ? "Helios Lance" : this.hud.selectedKind === "vortex" ? "Vortex Foundry" : "Rime Choir"} forged.`);
      } else {
        this.hud.toast("That plinth is occupied or the forge lacks lumen.");
      }
    });
    window.addEventListener("resize", () => this.renderer.resize());
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("error", (event) => this.recordError(event.error ?? event.message));
    window.addEventListener("unhandledrejection", (event) => this.recordError(event.reason));
    this.renderer.renderer.setAnimationLoop(this.frame);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    required<HTMLElement>("boot").classList.add("is-hidden");
    this.hud.show();
    this.lastTime = performance.now();
    this.hud.toast("Choose a warform, then click an illuminated plinth.", 2400);
  }

  private readonly frame = (now: number): void => {
    if (!this.running) {
      this.renderer.cameraController.update(MAX_FRAME_DT);
      this.renderer.render(this.simulation.snapshot(), 0, MAX_FRAME_DT);
      return;
    }
    const raw = this.lastTime ? (now - this.lastTime) / 1000 : FIXED_STEP;
    this.lastTime = now;
    this.renderer.noteFrameInterval(Math.min(1000, Math.max(0, raw * 1000)));
    const dt = Math.min(MAX_FRAME_DT, Math.max(0, raw));
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= FIXED_STEP && steps < MAX_STEPS) {
      this.simulation.step(FIXED_STEP);
      this.accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (steps === MAX_STEPS && this.accumulator >= FIXED_STEP) this.accumulator = 0;
    const events = this.simulation.consumeEvents();
    this.renderer.handleEvents(events);
    this.audio.handle(events);
    this.renderer.render(this.simulation.snapshot(), this.accumulator / FIXED_STEP, dt);
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hud.update(this.simulation.snapshot(), this.renderer.stats());
      this.hudTimer = 0.22;
    }
    for (const event of events) {
      if (event.type === "victory") this.hud.toast("The celestial breach is sealed.", 4200);
      else if (event.type === "defeat") this.hud.toast("The relic is broken. Reload to reforge the line.", 4200);
      else if (event.type === "leak") this.hud.toast(`${event.kind === "warden" ? "The Crown Warden" : "A warform"} struck the relic.`, 1600);
    }
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "1") this.hud.select("helios");
    else if (event.key === "2") this.hud.select("vortex");
    else if (event.key === "3") this.hud.select("rime");
    else if (event.code === "Space") {
      event.preventDefault();
      this.simulation.startWave();
    } else if (event.key.toLowerCase() === "r") {
      this.renderer.cameraController.reset();
    } else if (event.key.toLowerCase() === "m") {
      const muted = this.audio.toggleMute();
      this.hud.toast(muted ? "Audio muted." : "Audio restored.");
    }
  };

  private recordError(error: unknown): void {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    this.errors.push(message);
    console.error("RELIQUARY_FORGE", error);
  }
}

const app = new GameApp();

function spawnLineup(): number[] {
  const kinds = ["scarab", "manta", "husk", "choir", "warden"] as const;
  return kinds.map((kind, index) => {
    const enemy = app.simulation.spawn(kind, 8 + index * 4.8, 18);
    enemy.speed *= 0.08;
    return enemy.id;
  });
}

function benchmark(frames = 120): Promise<BenchmarkResult> {
  const sampleCount = Math.max(30, Math.min(600, Math.floor(frames)));
  return new Promise((resolve) => {
    const samples = new Float32Array(sampleCount);
    let count = 0;
    let previous = performance.now();
    const tick = (now: number): void => {
      samples[count] = now - previous;
      previous = now;
      count += 1;
      if (count < sampleCount) {
        requestAnimationFrame(tick);
        return;
      }
      const sorted = Array.from(samples).sort((a, b) => a - b);
      const render = app.renderer.stats();
      resolve({
        samples: sampleCount,
        p50: Number(sorted[Math.floor(sampleCount * 0.5)]!.toFixed(2)),
        p95: Number(sorted[Math.min(sampleCount - 1, Math.floor(sampleCount * 0.95))]!.toFixed(2)),
        p99: Number(sorted[Math.min(sampleCount - 1, Math.floor(sampleCount * 0.99))]!.toFixed(2)),
        worst: Number(sorted[sampleCount - 1]!.toFixed(2)),
        drawCalls: render.drawCalls,
        triangles: render.triangles,
        particles: render.particles,
        pixelRatio: render.pixelRatio,
        quality: render.quality,
        enemies: app.simulation.enemies.length,
        towers: app.simulation.towers.length,
        errors: app.errors.length + app.audio.errors.length,
      });
    };
    requestAnimationFrame(tick);
  });
}

window.__FORGE = {
  ready: app.ready,
  start: () => app.start(),
  beginWave: () => app.simulation.startWave(),
  buildAll: () => app.simulation.buildAll(true),
  spawnStress: (count = 36) => app.simulation.spawnStress(count),
  benchmark,
  stats: () => app.renderer.stats(),
  state: () => app.simulation.snapshot(),
  errors: () => [...app.errors, ...app.audio.errors],
  setQuality: (quality) => app.renderer.setQuality(quality),
  resetCamera: () => app.renderer.cameraController.reset(),
  orbitCamera: (yaw, pitch, distance) => Object.assign(app.renderer.cameraController.target, { yaw, pitch, distance }),
  shadowState: () => app.renderer.shadowState(),
  animationState: (enemyId) => app.renderer.animationState(enemyId),
  groundingState: () => app.renderer.groundingState(),
  facingState: () => app.renderer.facingState(app.simulation.snapshot()),
  visualState: () => app.renderer.visualState(),
  buildAt: (kind, slot) => app.simulation.buildTower(kind, slot, true),
  spawnLineup,
};

const params = new URLSearchParams(location.search);
const requestedQuality = params.get("quality");
if (requestedQuality === "ultra" || requestedQuality === "balanced" || requestedQuality === "performance") {
  void app.ready.then(() => app.renderer.setQuality(requestedQuality));
}
if (params.has("autoplay")) {
  void app.ready.then(() => {
    app.start();
    app.simulation.buildAll(true);
    app.simulation.startWave();
  });
}
if (params.has("lineup")) {
  void app.ready.then(() => {
    app.start();
    spawnLineup();
  });
}
if (params.has("showcase")) {
  void app.ready.then(() => {
    app.start();
    app.simulation.buildTower("helios", 1, true);
    app.simulation.buildTower("vortex", 5, true);
    app.simulation.buildTower("rime", 8, true);
    spawnLineup();
  });
}
