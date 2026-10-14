import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { ENEMIES, TOWERS, type EnemyKind, type TowerKind } from "../game/content/catalog";

export type ModelKey = EnemyKind | TowerKind;

type ModelBounds = {
  minY: number;
  maxY: number;
};

const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

export class InstancedAssetBatch {
  private readonly meshes = new Map<string, THREE.InstancedMesh>();
  private readonly used: boolean[];
  private highestSlot = -1;

  constructor(template: THREE.Group, maxInstances: number, scene: THREE.Scene, castShadow: boolean) {
    this.used = new Array<boolean>(maxInstances).fill(false);
    template.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const mesh = new THREE.InstancedMesh(node.geometry, node.material, maxInstances);
      mesh.name = `Batch_${template.name}_${node.name}`;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.meshes.set(node.name, mesh);
    });
  }

  acquire(): number {
    const slot = this.used.findIndex((value) => !value);
    if (slot < 0) throw new Error("Instanced model batch exhausted");
    this.used[slot] = true;
    this.highestSlot = Math.max(this.highestSlot, slot);
    for (const mesh of this.meshes.values()) mesh.count = this.highestSlot + 1;
    return slot;
  }

  release(slot: number): void {
    this.used[slot] = false;
    for (const mesh of this.meshes.values()) mesh.setMatrixAt(slot, zeroMatrix);
    while (this.highestSlot >= 0 && !this.used[this.highestSlot]) this.highestSlot -= 1;
    for (const mesh of this.meshes.values()) {
      mesh.count = this.highestSlot + 1;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  update(slot: number, clone: THREE.Group): void {
    clone.updateMatrixWorld(true);
    clone.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      this.meshes.get(node.name)?.setMatrixAt(slot, node.matrixWorld);
    });
  }

  flush(): void {
    for (const mesh of this.meshes.values()) mesh.instanceMatrix.needsUpdate = true;
  }
}

export class AssetLibrary {
  private readonly templates = new Map<ModelKey, THREE.Group>();
  private readonly bounds = new Map<ModelKey, ModelBounds>();
  private readonly loader: GLTFLoader;

  constructor(private readonly renderer: THREE.WebGLRenderer) {
    this.loader = new GLTFLoader();
    this.loader.setMeshoptDecoder(MeshoptDecoder);
  }

  async loadAll(onProgress: (progress: number, label: string) => void): Promise<void> {
    const entries: Array<[ModelKey, string]> = [
      ...Object.values(ENEMIES).map((entry) => [entry.id, entry.asset] as [ModelKey, string]),
      ...Object.values(TOWERS).map((entry) => [entry.id, entry.asset] as [ModelKey, string]),
    ];
    let complete = 0;
    await Promise.all(entries.map(async ([key, url]) => {
      const gltf = await this.loader.loadAsync(url);
      const root = gltf.scene;
      root.name = `Template_${key}`;
      this.prepare(root);
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      this.bounds.set(key, { minY: box.min.y, maxY: box.max.y });
      this.templates.set(key, root);
      complete += 1;
      onProgress(complete / entries.length, `Tempered ${root.name.replace("Template_", "")}`);
    }));
  }

  clone(key: ModelKey): THREE.Group {
    const template = this.templates.get(key);
    if (!template) throw new Error(`Missing GLB template: ${key}`);
    const clone = template.clone(true);
    clone.name = `Forge_${key}`;
    return clone;
  }

  createBatch(key: ModelKey, maxInstances: number, scene: THREE.Scene): InstancedAssetBatch {
    const template = this.templates.get(key);
    if (!template) throw new Error(`Missing GLB template for batch: ${key}`);
    return new InstancedAssetBatch(template, maxInstances, scene, key === "warden" || key === "helios" || key === "vortex" || key === "rime");
  }

  minimumY(key: ModelKey): number {
    const bounds = this.bounds.get(key);
    if (!bounds) throw new Error(`Missing GLB bounds for ${key}`);
    return bounds.minY;
  }

  maximumY(key: ModelKey): number {
    const bounds = this.bounds.get(key);
    if (!bounds) throw new Error(`Missing GLB bounds for ${key}`);
    return bounds.maxY;
  }

  private prepare(root: THREE.Object3D): void {
    const maxAnisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      node.castShadow = false;
      node.receiveShadow = true;
      node.frustumCulled = true;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        material.envMapIntensity = 0.72;
        material.dithering = true;
        material.precision = "highp";
        if (material.map) {
          material.map.colorSpace = THREE.SRGBColorSpace;
          material.map.anisotropy = maxAnisotropy;
          material.map.wrapS = THREE.RepeatWrapping;
          material.map.wrapT = THREE.RepeatWrapping;
        }
      }
    });
  }
}
