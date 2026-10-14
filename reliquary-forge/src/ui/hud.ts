import { ENEMIES, TOWERS, WAVES, type TowerKind } from "../game/content/catalog";
import type { SimulationSnapshot } from "../game/simulation/simulation";
import type { RenderStats } from "../render/game-renderer";

type HudCallbacks = {
  onSelect: (kind: TowerKind) => void;
  onWave: () => void;
};

function required<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Required HUD element missing: ${id}`);
  return element as T;
}

export class Hud {
  readonly root = required<HTMLDivElement>("hud");
  private readonly lives = required<HTMLElement>("lives-value");
  private readonly gold = required<HTMLElement>("gold-value");
  private readonly wave = required<HTMLElement>("wave-value");
  private readonly fps = required<HTMLElement>("fps-value");
  private readonly waveButton = required<HTMLButtonElement>("wave-button");
  private readonly towerButtons = required<HTMLDivElement>("tower-buttons");
  private readonly selectionLabel = required<HTMLElement>("selection-label");
  private readonly selectionDetail = required<HTMLElement>("selection-detail");
  private readonly bossPanel = required<HTMLDivElement>("boss-panel");
  private readonly bossHealthText = required<HTMLElement>("boss-health-text");
  private readonly bossHealthFill = required<HTMLElement>("boss-health-fill");
  private readonly codexButton = required<HTMLButtonElement>("codex-button");
  private readonly codex = required<HTMLElement>("codex");
  private readonly codexClose = required<HTMLButtonElement>("codex-close");
  private readonly codexContent = required<HTMLDivElement>("codex-content");
  private readonly toastElement = required<HTMLDivElement>("toast");
  private readonly buttons = new Map<TowerKind, HTMLButtonElement>();
  private selected: TowerKind = "helios";
  private toastTimer = 0;
  private codexOpen = false;

  constructor(private readonly callbacks: HudCallbacks) {
    this.buildTowerButtons();
    this.buildCodex();
    this.waveButton.addEventListener("click", callbacks.onWave);
    this.codexButton.addEventListener("click", () => this.setCodex(!this.codexOpen));
    this.codexClose.addEventListener("click", () => this.setCodex(false));
    this.select("helios");
  }

  show(): void {
    this.root.classList.remove("is-hidden");
  }

  select(kind: TowerKind): void {
    this.selected = kind;
    for (const [id, button] of this.buttons) button.setAttribute("aria-pressed", String(id === kind));
    const spec = TOWERS[kind];
    this.selectionLabel.textContent = spec.name;
    this.selectionDetail.textContent = `${spec.cost} lumen. ${spec.description}`;
    this.callbacks.onSelect(kind);
  }

  update(snapshot: SimulationSnapshot, stats: RenderStats): void {
    this.lives.textContent = String(snapshot.lives);
    this.gold.textContent = String(snapshot.gold);
    this.wave.textContent = `${snapshot.wave} / ${WAVES.length}`;
    this.fps.textContent = String(Math.round(Math.min(240, 1000 / Math.max(1, stats.p50 || stats.frameMs || 16.67))));
    this.waveButton.disabled = snapshot.waveActive || snapshot.victory || snapshot.defeat;
    this.waveButton.textContent = snapshot.victory ? "Field secured" : snapshot.defeat ? "Relic lost" : snapshot.wave === 0 ? "Begin wave" : "Call next wave";
    for (const [kind, button] of this.buttons) {
      button.disabled = snapshot.gold < TOWERS[kind].cost || snapshot.victory || snapshot.defeat;
    }
    const boss = snapshot.enemies.find((enemy) => enemy.kind === "warden");
    if (boss) {
      const ratio = Math.max(0, boss.hp / boss.maxHp);
      this.bossPanel.classList.remove("is-hidden");
      this.bossHealthText.textContent = `${Math.ceil(ratio * 100)}%`;
      this.bossHealthFill.style.setProperty("--boss-health", String(ratio));
    } else {
      this.bossPanel.classList.add("is-hidden");
    }
  }

  toast(message: string, duration = 1800): void {
    window.clearTimeout(this.toastTimer);
    this.toastElement.textContent = message;
    this.toastElement.classList.add("is-visible");
    this.toastTimer = window.setTimeout(() => this.toastElement.classList.remove("is-visible"), duration);
  }

  get selectedKind(): TowerKind {
    return this.selected;
  }

  private buildTowerButtons(): void {
    const keys: Record<TowerKind, string> = { helios: "1", vortex: "2", rime: "3" };
    for (const spec of Object.values(TOWERS)) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tower-button";
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", `${spec.name}, ${spec.cost} lumen`);
      const key = document.createElement("span");
      key.className = "tower-button__key";
      key.textContent = keys[spec.id];
      const copy = document.createElement("span");
      copy.className = "tower-button__copy";
      const name = document.createElement("strong");
      name.textContent = spec.name;
      const cost = document.createElement("small");
      cost.textContent = `${spec.cost} LUMEN`;
      copy.append(name, cost);
      button.append(key, copy);
      button.addEventListener("click", () => this.select(spec.id));
      this.towerButtons.append(button);
      this.buttons.set(spec.id, button);
    }
  }

  private buildCodex(): void {
    const fragment = document.createDocumentFragment();
    for (const spec of [...Object.values(TOWERS), ...Object.values(ENEMIES)]) {
      const entry = document.createElement("article");
      entry.className = "codex-entry";
      const title = document.createElement("h3");
      title.textContent = spec.name;
      const mechanic = document.createElement("p");
      mechanic.textContent = spec.description;
      const flavor = document.createElement("p");
      const emphasis = document.createElement("em");
      emphasis.textContent = spec.flavor;
      flavor.append(emphasis);
      entry.append(title, mechanic, flavor);
      fragment.append(entry);
    }
    this.codexContent.append(fragment);
  }

  private setCodex(open: boolean): void {
    this.codexOpen = open;
    this.codexButton.setAttribute("aria-expanded", String(open));
    this.codex.classList.toggle("is-hidden", !open);
    if (open) this.codexClose.focus();
  }
}
