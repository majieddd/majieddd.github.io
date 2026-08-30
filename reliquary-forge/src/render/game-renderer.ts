import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { BUILD_SLOTS, ENEMIES, PATH_POINTS, TOWERS, pointAtDistance, tangentAtDistance, type EnemyKind, type TowerKind } from "../game/content/catalog";
import type { CombatEvent, EnemyState, SimulationSnapshot, TowerState } from "../game/simulation/simulation";
import { AssetLibrary, InstancedAssetBatch } from "./assets";
import { BattleCamera } from "./camera";
import { ForgeFx } from "./fx";
import { createWorld, planetSurfaceHeight, type WorldScene } from "./world";

type EnemyView = {
  object: THREE.Group;
  kind: EnemyKind;
  parts: Map<string, THREE.Object3D>;
  rest: Map<string, RigTransform>;
  dying: number;
  deathDuration: number;
  baseScale: number;
  batchSlot: number;
};

type TowerView = {
  object: THREE.Group;
  kind: TowerKind;
  parts: Map<string, THREE.Object3D>;
  rest: Map<string, RigTransform>;
  idleYaw: number;
  aimYaw: number;
  aimVelocity: number;
  batchSlot: number;
};

type RigTransform = {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
};

export type RenderStats = {
  frameMs: number;
  fps: number;
  p50: number;
  p95: number;
  drawCalls: number;
  triangles: number;
  points: number;
  textures: number;
  particles: number;
  pixelRatio: number;
  quality: QualityLevel;
};

export type VisualState = {
  camera: number[];
  direction: number[];
  originNdc: number[];
  worldBounds: number[];
  surfaceBounds: number[];
  visibleMeshes: number;
  frustumMeshes: number;
};

export type QualityLevel = "ultra" | "balanced" | "performance";

const positionScratch = new THREE.Vector3();
const sourceScratch = new THREE.Vector3();
const targetScratch = new THREE.Vector3();
const scaleScratch = new THREE.Vector3();
const matrixScratch = new THREE.Matrix4();
const quaternionScratch = new THREE.Quaternion();
const boxScratch = new THREE.Box3();
const centerScratch = new THREE.Vector3();
const pivotScratch = new THREE.Vector3();
const forwardScratch = new THREE.Vector3();
const probeScratch = new THREE.Vector3();

const PigmentShader = {
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uStrength: { value: 0.82 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform float uStrength;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

    void main() {
      vec2 px = 1.0 / uResolution;
      float bristle = sin(vUv.y * uResolution.y * 0.31 + sin(vUv.x * 23.0) * 2.2) * 0.34;
      vec2 warp = vec2(bristle * px.x, sin(vUv.x * uResolution.x * 0.08) * px.y * 0.18) * uStrength;
      vec3 center = texture2D(tDiffuse, vUv + warp).rgb;
      vec3 left = texture2D(tDiffuse, vUv - vec2(px.x * 1.6, 0.0)).rgb;
      vec3 right = texture2D(tDiffuse, vUv + vec2(px.x * 1.6, 0.0)).rgb;
      vec3 up = texture2D(tDiffuse, vUv + vec2(0.0, px.y * 1.4)).rgb;
      vec3 down = texture2D(tDiffuse, vUv - vec2(0.0, px.y * 1.4)).rgb;
      float edge = abs(luma(left) - luma(right)) + abs(luma(up) - luma(down));
      float grain = hash(floor(vUv * uResolution * 0.47)) - 0.5;
      vec3 pigment = center * (1.0 + grain * 0.035 * uStrength);
      pigment = mix(pigment, floor(pigment * 18.0 + 0.5) / 18.0, 0.11 * uStrength);
      pigment -= edge * vec3(0.13, 0.10, 0.08) * uStrength;
      float vignette = smoothstep(0.92, 0.25, distance(vUv, vec2(0.5)));
      pigment *= mix(0.74, 1.0, vignette);
      gl_FragColor = vec4(pigment, 1.0);
    }
  `,
};

function collectParts(root: THREE.Object3D): Map<string, THREE.Object3D> {
  const parts = new Map<string, THREE.Object3D>();
  root.traverse((node) => parts.set(node.name, node));
  return parts;
}

function collectRest(root: THREE.Object3D): Map<string, RigTransform> {
  const rest = new Map<string, RigTransform>();
  root.traverse((node) => {
    rest.set(node.name, {
      position: node.position.clone(),
      rotation: node.rotation.clone(),
      scale: node.scale.clone(),
    });
  });
  return rest;
}

function wrappedAngle(value: number): number {
  return Math.atan2(Math.sin(value), Math.cos(value));
}

export class ForgeRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly cameraController: BattleCamera;
  readonly assets: AssetLibrary;
  readonly world: WorldScene;
  readonly fx: ForgeFx;
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly pigment: ShaderPass;
  private readonly enemyViews = new Map<number, EnemyView>();
  private readonly towerViews = new Map<number, TowerView>();
  private readonly enemyBatches = new Map<EnemyKind, InstancedAssetBatch>();
  private readonly towerBatches = new Map<TowerKind, InstancedAssetBatch>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly frameSamples = new Float32Array(180);
  private readonly rangePreview: THREE.Mesh;
  private readonly blobShadows: THREE.InstancedMesh;
  private frameCursor = 0;
  private frameCount = 0;
  private lastFrameMs = 16.67;
  private quality: QualityLevel = "balanced";
  private qualityLocked = false;
  private pixelRatio = 1;
  private autoQualityCooldown = 0;
  private selectedKind: TowerKind = "helios";
  private hoveredSlot = -1;
  private readonly reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance", stencil: false, depth: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.94;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.info.autoReset = false;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x101a28);
    this.scene.fog = new THREE.FogExp2(0x152238, 0.015);
    this.cameraController = new BattleCamera(canvas);
    this.assets = new AssetLibrary(this.renderer);
    this.world = createWorld(this.scene, this.renderer);
    this.fx = new ForgeFx(this.scene, 1);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.cameraController.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.78, 0.62, 0.76);
    this.composer.addPass(this.bloom);
    this.pigment = new ShaderPass(PigmentShader);
    this.composer.addPass(this.pigment);
    this.composer.addPass(new OutputPass());

    const rangeMaterial = new THREE.MeshBasicMaterial({ color: TOWERS.helios.color, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    this.rangePreview = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 96), rangeMaterial);
    this.rangePreview.rotation.x = -Math.PI / 2;
    this.rangePreview.position.y = 0.09;
    this.rangePreview.visible = false;
    this.scene.add(this.rangePreview);

    const blobGeometry = new THREE.CircleGeometry(1, 24);
    blobGeometry.rotateX(-Math.PI / 2);
    const blobMaterial = new THREE.MeshBasicMaterial({ color: 0x080b11, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
    this.blobShadows = new THREE.InstancedMesh(blobGeometry, blobMaterial, 160);
    this.blobShadows.name = "Enemy_Blob_Shadows";
    this.blobShadows.count = 0;
    this.blobShadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.blobShadows.frustumCulled = false;
    this.scene.add(this.blobShadows);

    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("webglcontextlost", this.onContextLost);
    canvas.addEventListener("webglcontextrestored", this.onContextRestored);
    this.setQuality("balanced", false);
    this.resize();
  }

  async load(onProgress: (progress: number, label: string) => void): Promise<void> {
    await this.assets.loadAll(onProgress);
  }

  setSelectedKind(kind: TowerKind): void {
    this.selectedKind = kind;
    const material = this.rangePreview.material as THREE.MeshBasicMaterial;
    material.color.setHex(TOWERS[kind].color);
    this.updateRangePreview();
  }

  setQuality(level: QualityLevel, lock = true): void {
    this.quality = level;
    this.qualityLocked = lock;
    const device = window.devicePixelRatio || 1;
    const cap = level === "ultra" ? 0.9 : level === "balanced" ? 0.82 : 0.52;
    this.pixelRatio = Math.min(device, cap);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.composer.setPixelRatio(this.pixelRatio);
    this.renderer.shadowMap.enabled = level !== "performance";
    this.world.sun.castShadow = level !== "performance";
    this.bloom.enabled = level === "ultra";
    // Ultra keeps bloom as a specular accent. Broad bloom erases silhouette separation in a dense firing line.
    this.bloom.strength = level === "ultra" ? 0.085 : 0.2;
    this.bloom.radius = level === "ultra" ? 0.10 : 0.18;
    this.bloom.threshold = level === "ultra" ? 1.25 : 0.94;
    this.pigment.enabled = level !== "performance";
    this.pigment.uniforms.uStrength!.value = level === "ultra" ? 0.82 : level === "balanced" ? 0.66 : 0;
    const shadowSize = level === "ultra" ? 2048 : level === "balanced" ? 1024 : 512;
    this.world.sun.shadow.mapSize.set(shadowSize, shadowSize);
    this.fx.setPixelRatio(this.pixelRatio);
    this.resize();
  }

  noteFrameInterval(milliseconds: number): void {
    this.lastFrameMs = Math.max(0, milliseconds);
    this.frameSamples[this.frameCursor] = this.lastFrameMs;
    this.frameCursor = (this.frameCursor + 1) % this.frameSamples.length;
    this.frameCount = Math.min(this.frameSamples.length, this.frameCount + 1);
  }

  pickSlot(clientX: number, clientY: number): number {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set((clientX - rect.left) / rect.width * 2 - 1, -((clientY - rect.top) / rect.height * 2 - 1));
    this.raycaster.setFromCamera(this.pointer, this.cameraController.camera);
    const hit = this.raycaster.intersectObjects(this.world.buildTargets, false)[0];
    return typeof hit?.object.userData.slot === "number" ? hit.object.userData.slot : -1;
  }

  handleEvents(events: readonly CombatEvent[]): void {
    for (const event of events) {
      if (event.type === "fire") {
        const enemy = this.enemyViews.get(event.targetId);
        this.enemyCenter(enemy, event.target.x, event.target.z, targetScratch);
        const tower = this.towerViews.get(event.towerId);
        if (event.towerKind === "helios") {
          this.towerSocket(tower, "Helios_MuzzleSocket_L", event.source.x, 1.95, event.source.z, sourceScratch);
          this.fx.beam(sourceScratch, targetScratch, event.color, 1.0);
          this.towerSocket(tower, "Helios_MuzzleSocket_R", event.source.x, 1.95, event.source.z, sourceScratch);
          this.fx.beam(sourceScratch, targetScratch, event.color, 0.72);
        } else if (event.towerKind === "vortex") {
          this.towerSocket(tower, "Vortex_ApertureSocket", event.source.x, 1.74, event.source.z, sourceScratch);
          this.fx.ring(sourceScratch, event.color, 1.18, 0.25);
          this.fx.burst(sourceScratch, event.color, 16, 0.82);
          targetScratch.y = planetSurfaceHeight(targetScratch.x, targetScratch.z) + 0.22;
          this.fx.ring(targetScratch, event.color, TOWERS.vortex.splash * 1.05, 0.42);
          this.fx.burst(targetScratch, event.color, 30, 1.35);
          this.cameraController.addShake(0.34);
        } else {
          this.towerSocket(tower, "Rime_MuzzleSocket", event.source.x, 2.03, event.source.z, sourceScratch);
          this.fx.beam(sourceScratch, targetScratch, event.color, 0.62);
        }
      } else if (event.type === "hit") {
        const view = this.enemyViews.get(event.enemyId);
        this.enemyCenter(view, event.at.x, event.at.z, positionScratch);
        this.fx.burst(positionScratch, event.color, event.critical ? 34 : 10, event.critical ? 1.5 : 0.75);
        if (event.critical) {
          this.fx.ring(positionScratch, event.color, 1.25, 0.36);
          this.cameraController.addShake(0.18);
        }
      } else if (event.type === "death" || event.type === "leak") {
        const view = this.enemyViews.get(event.enemyId);
        if (view) {
          view.dying = event.type === "death" ? 0.56 : 0.28;
          view.deathDuration = view.dying;
        }
        const color = event.type === "death" ? (event.kind === "warden" ? 0xff4a28 : 0xff873d) : 0xff342d;
        positionScratch.set(event.at.x, view ? view.object.position.y + 0.55 : 0.45, event.at.z);
        this.fx.burst(positionScratch, color, event.kind === "warden" ? 160 : 42, event.kind === "warden" ? 2.4 : 1.15);
        this.fx.ring(positionScratch, color, event.kind === "warden" ? 5.8 : 1.8, event.kind === "warden" ? 0.92 : 0.48);
        this.cameraController.addShake(event.kind === "warden" ? 1.2 : 0.28);
      } else if (event.type === "build") {
        positionScratch.set(event.at.x, planetSurfaceHeight(event.at.x, event.at.z) + 0.42, event.at.z);
        this.fx.ring(positionScratch, TOWERS[event.towerKind].color, 1.55, 0.42);
        this.fx.burst(positionScratch, TOWERS[event.towerKind].color, 24, 0.9);
      } else if (event.type === "wave") {
        positionScratch.copy(this.world.entry.position).add(new THREE.Vector3(0, 1.2, 0));
        this.fx.ring(positionScratch, 0xff572d, 3.5, 0.82);
        this.fx.burst(positionScratch, 0xff572d, 72, 1.8);
        this.cameraController.addShake(0.55);
      }
    }
  }

  render(snapshot: SimulationSnapshot, alpha: number, dt: number): void {
    this.renderer.info.reset();
    this.syncEnemies(snapshot.enemies);
    this.syncTowers(snapshot.towers);
    this.animateEnemies(snapshot.enemies, alpha, snapshot.time, dt);
    this.animateTowers(snapshot.towers, snapshot.time, dt);
    this.animateWorld(snapshot.time);
    this.fx.update(dt);
    this.cameraController.update(dt);
    this.composer.render(dt);
    this.autoQualityCooldown -= dt;
    if (!this.qualityLocked && this.autoQualityCooldown <= 0 && this.frameCount >= 30) this.adaptQuality();
  }

  resize(): void {
    const width = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.cameraController.resize(width, height);
    this.pigment.uniforms.uResolution!.value.set(width * this.pixelRatio, height * this.pixelRatio);
  }

  stats(): RenderStats {
    const sorted = Array.from(this.frameSamples.slice(0, this.frameCount)).sort((a, b) => a - b);
    const p50 = sorted.length ? sorted[Math.floor(sorted.length * 0.5)]! : 0;
    const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]! : 0;
    return {
      frameMs: this.lastFrameMs,
      fps: this.lastFrameMs > 0 ? Math.min(999, 1000 / this.lastFrameMs) : 0,
      p50,
      p95,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      points: this.renderer.info.render.points,
      textures: this.renderer.info.memory.textures,
      particles: this.fx.activeParticles(),
      pixelRatio: this.pixelRatio,
      quality: this.quality,
    };
  }

  shadowState(): { matrix: number[]; left: number; right: number; top: number; bottom: number } {
    const camera = this.world.sun.shadow.camera as THREE.OrthographicCamera;
    camera.updateMatrixWorld(true);
    const matrix = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    return { matrix: matrix.toArray(), left: camera.left, right: camera.right, top: camera.top, bottom: camera.bottom };
  }

  animationState(enemyId: number): Record<string, number[]> {
    const view = this.enemyViews.get(enemyId);
    if (!view) return {};
    const output: Record<string, number[]> = {};
    const pattern = /Gait|Wing|Orbit|Ring|Arm|Crown|Tendril|Shell|Jaw|Head|Halo/;
    for (const [name, part] of view.parts) {
      if (!pattern.test(name)) continue;
      output[name] = [
        Number(part.rotation.x.toFixed(5)),
        Number(part.rotation.y.toFixed(5)),
        Number(part.rotation.z.toFixed(5)),
        Number(part.position.y.toFixed(5)),
      ];
    }
    return output;
  }

  groundingState(): Array<{ type: "enemy" | "tower"; id: number; kind: EnemyKind | TowerKind; minY: number; maxY: number; groundY: number }> {
    const output: Array<{ type: "enemy" | "tower"; id: number; kind: EnemyKind | TowerKind; minY: number; maxY: number; groundY: number }> = [];
    for (const [id, view] of this.enemyViews) {
      view.object.updateMatrixWorld(true);
      boxScratch.setFromObject(view.object);
      output.push({ type: "enemy", id, kind: view.kind, minY: Number(boxScratch.min.y.toFixed(4)), maxY: Number(boxScratch.max.y.toFixed(4)), groundY: Number(planetSurfaceHeight(view.object.position.x, view.object.position.z).toFixed(4)) });
    }
    for (const [id, view] of this.towerViews) {
      view.object.updateMatrixWorld(true);
      boxScratch.setFromObject(view.object);
      output.push({ type: "tower", id, kind: view.kind, minY: Number(boxScratch.min.y.toFixed(4)), maxY: Number(boxScratch.max.y.toFixed(4)), groundY: Number(planetSurfaceHeight(view.object.position.x, view.object.position.z).toFixed(4)) });
    }
    return output;
  }

  facingState(snapshot: SimulationSnapshot): Array<{ type: "enemy" | "tower"; id: number; kind: EnemyKind | TowerKind; dot: number; cross?: number; distance?: number }> {
    const output: Array<{ type: "enemy" | "tower"; id: number; kind: EnemyKind | TowerKind; dot: number; cross?: number; distance?: number }> = [];
    for (const state of snapshot.enemies) {
      const view = this.enemyViews.get(state.id);
      if (!view) continue;
      const tangent = tangentAtDistance(state.distance);
      positionScratch.set(0, 0, -1).applyQuaternion(view.object.quaternion).normalize();
      targetScratch.set(tangent.x, 0, tangent.z).normalize();
      output.push({ type: "enemy", id: state.id, kind: state.kind, dot: Number(positionScratch.dot(targetScratch).toFixed(4)) });
    }
    for (const state of snapshot.towers) {
      if (state.targetId == null || state.kind === "vortex") continue;
      const view = this.towerViews.get(state.id);
      const target = this.enemyViews.get(state.targetId);
      if (!view || !target) continue;
      const pivotName = state.kind === "helios" ? "Helios_Yaw" : "Rime_Yaw";
      const pivot = view.parts.get(pivotName);
      if (!pivot) continue;
      const sockets = state.kind === "helios" ? ["Helios_MuzzleSocket_L", "Helios_MuzzleSocket_R"] : ["Rime_MuzzleSocket"];
      const heading = this.weaponHeading(view, pivot, sockets);
      positionScratch.set(Math.sin(heading), 0, Math.cos(heading));
      centerScratch.copy(target.object.position).sub(view.object.position).setY(0);
      const distance = centerScratch.length();
      if (distance < 0.35) continue;
      centerScratch.multiplyScalar(1 / distance);
      output.push({
        type: "tower",
        id: state.id,
        kind: state.kind,
        dot: Number(positionScratch.dot(centerScratch).toFixed(4)),
        cross: Number((positionScratch.x * centerScratch.z - positionScratch.z * centerScratch.x).toFixed(4)),
        distance: Number(distance.toFixed(4)),
      });
    }
    return output;
  }

  visualState(): VisualState {
    this.scene.updateMatrixWorld(true);
    this.cameraController.camera.updateMatrixWorld(true);
    const camera = this.cameraController.camera;
    const direction = camera.getWorldDirection(new THREE.Vector3());
    const originNdc = new THREE.Vector3(0, 0, 0).project(camera);
    const worldBounds = new THREE.Box3().setFromObject(this.world.root);
    const surface = this.world.root.getObjectByName("Painted_Planetary_Surface");
    const surfaceBounds = surface ? new THREE.Box3().setFromObject(surface) : new THREE.Box3();
    const projection = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const frustum = new THREE.Frustum().setFromProjectionMatrix(projection);
    let visibleMeshes = 0;
    let frustumMeshes = 0;
    this.scene.traverse((node) => {
      if (!(node instanceof THREE.Mesh) || !node.visible) return;
      visibleMeshes += 1;
      if (!node.frustumCulled || frustum.intersectsObject(node)) frustumMeshes += 1;
    });
    return {
      camera: camera.position.toArray().map((value) => Number(value.toFixed(4))),
      direction: direction.toArray().map((value) => Number(value.toFixed(4))),
      originNdc: originNdc.toArray().map((value) => Number(value.toFixed(4))),
      worldBounds: [...worldBounds.min.toArray(), ...worldBounds.max.toArray()].map((value) => Number(value.toFixed(4))),
      surfaceBounds: [...surfaceBounds.min.toArray(), ...surfaceBounds.max.toArray()].map((value) => Number(value.toFixed(4))),
      visibleMeshes,
      frustumMeshes,
    };
  }

  dispose(): void {
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    this.canvas.removeEventListener("webglcontextrestored", this.onContextRestored);
    this.cameraController.dispose();
    this.fx.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }

  private syncEnemies(enemies: readonly EnemyState[]): void {
    for (const state of enemies) {
      if (this.enemyViews.has(state.id)) continue;
      const object = this.assets.clone(state.kind);
      const baseScale = ENEMIES[state.kind].scale;
      object.scale.setScalar(baseScale);
      object.position.y = this.enemyBaseY(state.kind);
      const batch = this.getEnemyBatch(state.kind);
      const batchSlot = batch.acquire();
      this.enemyViews.set(state.id, {
        object,
        kind: state.kind,
        parts: collectParts(object),
        rest: collectRest(object),
        dying: 0,
        deathDuration: 0.5,
        baseScale,
        batchSlot,
      });
    }
    for (const [id, view] of this.enemyViews) {
      if (enemies.some((enemy) => enemy.id === id)) continue;
      if (view.dying > 0) continue;
      this.getEnemyBatch(view.kind).release(view.batchSlot);
      this.enemyViews.delete(id);
    }
  }

  private syncTowers(towers: readonly TowerState[]): void {
    for (const state of towers) {
      if (this.towerViews.has(state.id)) continue;
      const object = this.assets.clone(state.kind);
      const slot = BUILD_SLOTS[state.slot]!;
      object.position.set(slot.x, planetSurfaceHeight(slot.x, slot.z) + 0.42, slot.z);
      object.scale.setScalar(1.02);
      const batch = this.getTowerBatch(state.kind);
      const batchSlot = batch.acquire();
      this.towerViews.set(state.id, {
        object,
        kind: state.kind,
        parts: collectParts(object),
        rest: collectRest(object),
        idleYaw: 0,
        aimYaw: 0,
        aimVelocity: 0,
        batchSlot,
      });
    }
    for (let i = 0; i < this.world.buildRings.length; i += 1) {
      this.world.buildRings[i]!.visible = !towers.some((tower) => tower.slot === i);
    }
    this.updateRangePreview();
  }

  private animateEnemies(enemies: readonly EnemyState[], alpha: number, time: number, dt: number): void {
    let shadowCount = 0;
    for (const state of enemies) {
      const view = this.enemyViews.get(state.id);
      if (!view) continue;
      const distance = state.previousDistance + (state.distance - state.previousDistance) * alpha;
      const point = pointAtDistance(distance);
      const tangent = tangentAtDistance(distance);
      const phase = time * state.speed * 2.25 + state.phase;
      const flying = ENEMIES[state.kind].flying;
      const bob = flying
        ? Math.sin(phase * 2) * (state.kind === "manta" ? 0.18 : 0.12)
        : (1 - Math.cos(phase * 2)) * 0.018;
      const groundY = planetSurfaceHeight(point.x, point.z);
      view.object.position.set(point.x, groundY + this.enemyBaseY(state.kind) + bob, point.z);
      view.object.rotation.y = Math.atan2(-tangent.x, -tangent.z);
      view.object.rotation.z = state.kind === "manta" ? Math.sin(phase * 0.6) * 0.065 : 0;
      this.animateEnemyParts(view, phase, time, state);
      this.getEnemyBatch(view.kind).update(view.batchSlot, view.object);
      if (shadowCount < this.blobShadows.instanceMatrix.count) {
        const radius = ENEMIES[state.kind].radius * (ENEMIES[state.kind].flying ? 1.25 : 1.0);
        positionScratch.set(point.x, groundY + 0.035, point.z);
        scaleScratch.set(radius, radius, radius);
        matrixScratch.compose(positionScratch, quaternionScratch.identity(), scaleScratch);
        this.blobShadows.setMatrixAt(shadowCount, matrixScratch);
        shadowCount += 1;
      }
    }

    for (const [id, view] of this.enemyViews) {
      if (view.dying <= 0) continue;
      view.dying = Math.max(0, view.dying - dt);
      const t = 1 - view.dying / view.deathDuration;
      const scale = view.baseScale * Math.max(0.05, 1 - t * t);
      view.object.scale.setScalar(scale);
      view.object.rotation.y += dt * (view.kind === "warden" ? 0.8 : 3.2);
      view.object.position.y += dt * (view.kind === "warden" ? -0.6 : 0.9);
      this.getEnemyBatch(view.kind).update(view.batchSlot, view.object);
      if (view.dying === 0) {
        this.getEnemyBatch(view.kind).release(view.batchSlot);
        this.enemyViews.delete(id);
      }
    }
    this.blobShadows.count = shadowCount;
    this.blobShadows.instanceMatrix.needsUpdate = true;
    for (const batch of this.enemyBatches.values()) batch.flush();
  }

  private animateEnemyParts(view: EnemyView, phase: number, time: number, state: EnemyState): void {
    const sin = Math.sin(phase);
    const cos = Math.cos(phase);
    if (view.kind === "scarab") {
      const left = view.parts.get("Scarab_Gait_L");
      const right = view.parts.get("Scarab_Gait_R");
      if (left) left.rotation.x = this.rest(view, left).rotation.x + sin * 0.16;
      if (right) right.rotation.x = this.rest(view, right).rotation.x - sin * 0.16;
      const shellL = view.parts.get("Scarab_Shell_L");
      const shellR = view.parts.get("Scarab_Shell_R");
      if (shellL) shellL.rotation.z = this.rest(view, shellL).rotation.z - 0.08 - Math.abs(sin) * 0.06;
      if (shellR) shellR.rotation.z = this.rest(view, shellR).rotation.z + 0.08 + Math.abs(sin) * 0.06;
      const jawL = view.parts.get("Scarab_Jaw_L");
      const jawR = view.parts.get("Scarab_Jaw_R");
      if (jawL) jawL.rotation.y = this.rest(view, jawL).rotation.y + Math.abs(cos) * 0.18;
      if (jawR) jawR.rotation.y = this.rest(view, jawR).rotation.y - Math.abs(cos) * 0.18;
    } else if (view.kind === "manta") {
      const left = view.parts.get("Manta_Wing_L");
      const right = view.parts.get("Manta_Wing_R");
      if (left) left.rotation.z = this.rest(view, left).rotation.z + 0.12 + sin * 0.23;
      if (right) right.rotation.z = this.rest(view, right).rotation.z - 0.12 - sin * 0.23;
      const halo = view.parts.get("Manta_Halo");
      if (halo) halo.rotation.z = this.rest(view, halo).rotation.z + time * 1.8;
    } else if (view.kind === "husk") {
      const left = view.parts.get("Husk_Gait_L");
      const right = view.parts.get("Husk_Gait_R");
      if (left) left.rotation.x = this.rest(view, left).rotation.x + sin * 0.12;
      if (right) right.rotation.x = this.rest(view, right).rotation.x - sin * 0.12;
      const head = view.parts.get("Husk_Head");
      if (head) head.rotation.y = this.rest(view, head).rotation.y + Math.sin(time * 1.1 + state.phase) * 0.08;
    } else if (view.kind === "choir") {
      const orbit = view.parts.get("Choir_Orbit");
      const ringA = view.parts.get("Choir_Ring_A");
      const ringB = view.parts.get("Choir_Ring_B");
      if (orbit) orbit.rotation.y = this.rest(view, orbit).rotation.y + time * 1.6 + state.phase;
      if (ringA) ringA.rotation.z = this.rest(view, ringA).rotation.z + time * 0.9;
      if (ringB) ringB.rotation.x = this.rest(view, ringB).rotation.x - time * 1.1;
    } else {
      const armL = view.parts.get("Warden_Arm_L");
      const armR = view.parts.get("Warden_Arm_R");
      const crown = view.parts.get("Warden_Crown");
      const cape = view.parts.get("Warden_Cape");
      const tendrils = view.parts.get("Warden_Tendrils");
      if (armL) armL.rotation.z = this.rest(view, armL).rotation.z + 0.08 + sin * 0.055;
      if (armR) armR.rotation.z = this.rest(view, armR).rotation.z - 0.08 - sin * 0.055;
      const gaitL = view.parts.get("Warden_Gait_L");
      const gaitR = view.parts.get("Warden_Gait_R");
      if (gaitL) gaitL.rotation.x = this.rest(view, gaitL).rotation.x + sin * 0.10;
      if (gaitR) gaitR.rotation.x = this.rest(view, gaitR).rotation.x - sin * 0.10;
      if (crown) crown.rotation.y = this.rest(view, crown).rotation.y + Math.sin(time * 0.6) * 0.045;
      if (cape) cape.rotation.y = this.rest(view, cape).rotation.y + Math.sin(time * 0.72 + state.phase) * 0.085;
      if (tendrils) tendrils.rotation.y = this.rest(view, tendrils).rotation.y + Math.sin(time * 0.8) * 0.12;
    }
  }

  private animateTowers(towers: readonly TowerState[], time: number, dt: number): void {
    for (const state of towers) {
      const view = this.towerViews.get(state.id);
      if (!view) continue;
      const target = state.targetId == null ? undefined : this.enemyViews.get(state.targetId);
      if (view.kind === "helios") {
        const yaw = view.parts.get("Helios_Yaw");
        const pitch = view.parts.get("Helios_Pitch");
        if (pitch) pitch.position.z = this.rest(view, pitch).position.z + state.recoil * 0.18;
        if (yaw) this.aimWeapon(view, yaw, ["Helios_MuzzleSocket_L", "Helios_MuzzleSocket_R"], target, dt);
      } else if (view.kind === "vortex") {
        const rotor = view.parts.get("Vortex_Rotor");
        if (rotor) {
          const rest = this.rest(view, rotor);
          rotor.rotation.y = rest.rotation.y;
          rotor.rotation.z = rest.rotation.z + time * (state.recoil > 0 ? 5.2 : 1.35);
          rotor.scale.copy(rest.scale).multiplyScalar(1 + state.recoil * 0.09);
        }
      } else {
        const yaw = view.parts.get("Rime_Yaw");
        const halo = view.parts.get("Rime_Halo");
        if (yaw) this.aimWeapon(view, yaw, ["Rime_MuzzleSocket"], target, dt);
        if (halo) {
          const rest = this.rest(view, halo);
          halo.rotation.y = rest.rotation.y + time * 1.8;
          halo.position.y = rest.position.y + Math.sin(time * 2.4 + state.id) * 0.08;
        }
      }
      this.getTowerBatch(view.kind).update(view.batchSlot, view.object);
    }
    for (const batch of this.towerBatches.values()) batch.flush();
  }

  private animateWorld(time: number): void {
    const gateRing = this.world.entry.children[0];
    if (gateRing) {
      gateRing.rotation.z = time * 0.44;
      gateRing.scale.setScalar(1 + Math.sin(time * 1.7) * 0.035);
    }
    const heart = this.world.relic.getObjectByName("Relic_Crystal");
    const halo = this.world.relic.getObjectByName("Relic_Halo");
    if (heart) heart.rotation.y = time * 0.72;
    if (halo) halo.rotation.z = time * 0.62;
    this.pigment.uniforms.uTime!.value = time;
  }

  private updateRangePreview(): void {
    if (this.hoveredSlot < 0 || !this.world.buildRings[this.hoveredSlot]?.visible) {
      this.rangePreview.visible = false;
      return;
    }
    const slot = BUILD_SLOTS[this.hoveredSlot]!;
    const range = TOWERS[this.selectedKind].range;
    this.rangePreview.position.set(slot.x, planetSurfaceHeight(slot.x, slot.z) + 0.09, slot.z);
    this.rangePreview.scale.setScalar(range);
    this.rangePreview.visible = true;
  }

  private adaptQuality(): void {
    const stats = this.stats();
    if (stats.p95 > 21 && this.quality === "ultra") this.setQuality("balanced", false);
    else if (stats.p95 > 28 && this.quality === "balanced") this.setQuality("performance", false);
    this.autoQualityCooldown = 2;
  }

  private getEnemyBatch(kind: EnemyKind): InstancedAssetBatch {
    let batch = this.enemyBatches.get(kind);
    if (!batch) {
      batch = this.assets.createBatch(kind, kind === "warden" ? 6 : 72, this.scene);
      this.enemyBatches.set(kind, batch);
    }
    return batch;
  }

  private getTowerBatch(kind: TowerKind): InstancedAssetBatch {
    let batch = this.towerBatches.get(kind);
    if (!batch) {
      batch = this.assets.createBatch(kind, 20, this.scene);
      this.towerBatches.set(kind, batch);
    }
    return batch;
  }

  private enemyBaseY(kind: EnemyKind): number {
    const spec = ENEMIES[kind];
    return spec.clearance - this.assets.minimumY(kind) * spec.scale;
  }

  private nearestPathPoint(x: number, z: number): { x: number; z: number } {
    let nearest = PATH_POINTS[0]!;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const point of PATH_POINTS) {
      const distance = (point.x - x) ** 2 + (point.z - z) ** 2;
      if (distance < nearestDistance) {
        nearest = point;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  private aimWeapon(
    view: TowerView,
    yaw: THREE.Object3D,
    sockets: readonly string[],
    target: EnemyView | undefined,
    dt: number,
  ): void {
    const rest = this.rest(view, yaw);
    yaw.rotation.copy(rest.rotation);
    const destination = target?.object.position ?? this.nearestPathPoint(view.object.position.x, view.object.position.z);
    const baseHeading = this.weaponHeading(view, yaw, sockets);
    yaw.rotation.z = rest.rotation.z + 0.025;
    const probeHeading = this.weaponHeading(view, yaw, sockets);
    const turnDirection = Math.sign(wrappedAngle(probeHeading - baseHeading)) || 1;
    const targetHeading = Math.atan2(destination.x - view.object.position.x, destination.z - view.object.position.z);
    const desiredLocalYaw = wrappedAngle(targetHeading - baseHeading) / turnDirection;
    const yawError = wrappedAngle(desiredLocalYaw - view.aimYaw);
    const aimDt = Math.min(dt, 0.1);
    const aimBlend = 1 - Math.exp(-aimDt * 18);
    view.aimVelocity = yawError * aimBlend / Math.max(0.001, aimDt);
    view.aimYaw = wrappedAngle(view.aimYaw + yawError * aimBlend);
    yaw.rotation.copy(rest.rotation);
    yaw.rotation.z = rest.rotation.z + view.aimYaw;
  }

  private weaponHeading(view: TowerView, pivot: THREE.Object3D, sockets: readonly string[]): number {
    view.object.updateMatrixWorld(true);
    pivot.getWorldPosition(pivotScratch);
    forwardScratch.set(0, 0, 0);
    let count = 0;
    for (const name of sockets) {
      const socket = view.parts.get(name);
      if (!socket) continue;
      socket.getWorldPosition(probeScratch);
      forwardScratch.add(probeScratch);
      count += 1;
    }
    if (count === 0) return 0;
    forwardScratch.multiplyScalar(1 / count).sub(pivotScratch);
    return Math.atan2(forwardScratch.x, forwardScratch.z);
  }

  private rest(view: EnemyView | TowerView, node: THREE.Object3D): RigTransform {
    const transform = view.rest.get(node.name);
    if (!transform) throw new Error(`Missing rest transform for ${node.name}`);
    return transform;
  }

  private enemyCenter(view: EnemyView | undefined, fallbackX: number, fallbackZ: number, out: THREE.Vector3): THREE.Vector3 {
    if (!view) return out.set(fallbackX, planetSurfaceHeight(fallbackX, fallbackZ) + 0.82, fallbackZ);
    view.object.updateMatrixWorld(true);
    boxScratch.setFromObject(view.object).getCenter(out);
    return out;
  }

  private towerSocket(
    view: TowerView | undefined,
    name: string,
    fallbackX: number,
    fallbackY: number,
    fallbackZ: number,
    out: THREE.Vector3,
  ): THREE.Vector3 {
    const socket = view?.parts.get(name);
    if (!socket || !view) return out.set(fallbackX, fallbackY, fallbackZ);
    view.object.updateMatrixWorld(true);
    return socket.getWorldPosition(out);
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    this.hoveredSlot = this.pickSlot(event.clientX, event.clientY);
    this.updateRangePreview();
  };

  private readonly onContextLost = (event: Event): void => {
    event.preventDefault();
    document.getElementById("context-lost")?.classList.remove("is-hidden");
  };

  private readonly onContextRestored = (): void => {
    document.getElementById("context-lost")?.classList.add("is-hidden");
  };
}
