import * as THREE from "three";

const MAX_PARTICLES = 1800;
const MAX_BEAMS = 48;
const MAX_RINGS = 36;

type Beam = { mesh: THREE.Mesh; life: number; maxLife: number };
type Ring = { mesh: THREE.Mesh; life: number; maxLife: number; growth: number };

const colorScratch = new THREE.Color();
const directionScratch = new THREE.Vector3();
const midpointScratch = new THREE.Vector3();
const yAxis = new THREE.Vector3(0, 1, 0);

export class ForgeFx {
  readonly group = new THREE.Group();
  private readonly particlePosition = new Float32Array(MAX_PARTICLES * 3);
  private readonly particleVelocity = new Float32Array(MAX_PARTICLES * 3);
  private readonly particleColor = new Float32Array(MAX_PARTICLES * 3);
  private readonly particleLife = new Float32Array(MAX_PARTICLES);
  private readonly particleMaxLife = new Float32Array(MAX_PARTICLES);
  private readonly particleSize = new Float32Array(MAX_PARTICLES);
  private readonly particleGeometry = new THREE.BufferGeometry();
  private readonly particles: THREE.Points;
  private readonly beams: Beam[] = [];
  private readonly rings: Ring[] = [];
  private particleCursor = 0;
  private reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  constructor(scene: THREE.Scene, pixelRatio: number) {
    this.group.name = "Forge_FX";
    scene.add(this.group);
    this.particleGeometry.setAttribute("position", new THREE.BufferAttribute(this.particlePosition, 3));
    this.particleGeometry.setAttribute("aColor", new THREE.BufferAttribute(this.particleColor, 3));
    this.particleGeometry.setAttribute("aLife", new THREE.BufferAttribute(this.particleLife, 1));
    this.particleGeometry.setAttribute("aSize", new THREE.BufferAttribute(this.particleSize, 1));
    this.particleGeometry.setDrawRange(0, MAX_PARTICLES);
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uPixelRatio: { value: pixelRatio } },
      vertexShader: `
        attribute vec3 aColor;
        attribute float aLife;
        attribute float aSize;
        varying vec3 vColor;
        varying float vLife;
        uniform float uPixelRatio;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = max(0.0, aSize * uPixelRatio * (10.0 / max(2.0, -mv.z)) * aLife);
          vColor = aColor;
          vLife = aLife;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vLife;
        void main() {
          vec2 q = gl_PointCoord * 2.0 - 1.0;
          float d = dot(q, q);
          if (d > 1.0 || vLife <= 0.0) discard;
          float alpha = smoothstep(1.0, 0.12, d) * min(1.0, vLife * 1.6);
          gl_FragColor = vec4(vColor * (1.2 + alpha * 1.4), alpha);
        }
      `,
    });
    this.particles = new THREE.Points(this.particleGeometry, material);
    this.particles.frustumCulled = false;
    this.particles.renderOrder = 8;
    this.group.add(this.particles);

    const beamGeometry = new THREE.CylinderGeometry(0.028, 0.058, 1, 8, 1, true);
    for (let i = 0; i < MAX_BEAMS; i += 1) {
      const mesh = new THREE.Mesh(beamGeometry, new THREE.MeshBasicMaterial({ color: 0xffb15c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      mesh.visible = false;
      mesh.renderOrder = 7;
      this.group.add(mesh);
      this.beams.push({ mesh, life: 0, maxLife: 0.1 });
    }

    const ringGeometry = new THREE.RingGeometry(0.82, 1, 40);
    ringGeometry.rotateX(-Math.PI / 2);
    for (let i = 0; i < MAX_RINGS; i += 1) {
      const mesh = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({ color: 0xff713c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      mesh.visible = false;
      mesh.renderOrder = 6;
      this.group.add(mesh);
      this.rings.push({ mesh, life: 0, maxLife: 0.45, growth: 3 });
    }
  }

  setPixelRatio(value: number): void {
    const material = this.particles.material as THREE.ShaderMaterial;
    material.uniforms.uPixelRatio!.value = value;
  }

  burst(position: THREE.Vector3, color: number, count: number, energy = 1): void {
    const amount = this.reduceMotion ? Math.min(8, count) : count;
    colorScratch.setHex(color);
    for (let i = 0; i < amount; i += 1) {
      const index = this.acquireParticle();
      const i3 = index * 3;
      const theta = (i * 2.3999632297 + position.x * 0.37 + position.z * 0.21) % (Math.PI * 2);
      const lift = 0.25 + ((i * 37) % 11) / 11;
      const spread = (0.65 + ((i * 17) % 13) / 13) * energy;
      this.particlePosition[i3] = position.x;
      this.particlePosition[i3 + 1] = position.y;
      this.particlePosition[i3 + 2] = position.z;
      this.particleVelocity[i3] = Math.cos(theta) * spread;
      this.particleVelocity[i3 + 1] = (1.1 + lift * 2.4) * energy;
      this.particleVelocity[i3 + 2] = Math.sin(theta) * spread;
      this.particleColor[i3] = colorScratch.r;
      this.particleColor[i3 + 1] = colorScratch.g;
      this.particleColor[i3 + 2] = colorScratch.b;
      this.particleMaxLife[index] = 0.38 + ((i * 19) % 17) / 42;
      this.particleLife[index] = 1;
      this.particleSize[index] = 4.2 + ((i * 23) % 9) * 0.7;
    }
    this.markParticleAttributes();
  }

  beam(source: THREE.Vector3, target: THREE.Vector3, color: number, width = 1): void {
    const beam = this.beams.find((entry) => entry.life <= 0) ?? this.beams[0]!;
    directionScratch.subVectors(target, source);
    const length = directionScratch.length();
    midpointScratch.copy(source).add(target).multiplyScalar(0.5);
    beam.mesh.position.copy(midpointScratch);
    beam.mesh.quaternion.setFromUnitVectors(yAxis, directionScratch.normalize());
    beam.mesh.scale.set(width, length, width);
    const material = beam.mesh.material as THREE.MeshBasicMaterial;
    material.color.setHex(color);
    material.opacity = 0.95;
    beam.life = beam.maxLife = 0.11;
    beam.mesh.visible = true;
  }

  ring(position: THREE.Vector3, color: number, radius: number, duration = 0.52): void {
    const ring = this.rings.find((entry) => entry.life <= 0) ?? this.rings[0]!;
    ring.mesh.position.copy(position);
    ring.mesh.position.y += 0.05;
    ring.mesh.scale.setScalar(Math.max(0.15, radius * 0.2));
    const material = ring.mesh.material as THREE.MeshBasicMaterial;
    material.color.setHex(color);
    material.opacity = 0.82;
    ring.life = ring.maxLife = duration;
    ring.growth = radius;
    ring.mesh.visible = true;
  }

  update(dt: number): void {
    let changed = false;
    for (let i = 0; i < MAX_PARTICLES; i += 1) {
      if (this.particleLife[i]! <= 0) continue;
      changed = true;
      const i3 = i * 3;
      const normalized = this.particleLife[i]!;
      const maxLife = this.particleMaxLife[i]!;
      this.particleLife[i] = Math.max(0, normalized - dt / maxLife);
      this.particleVelocity[i3 + 1] = this.particleVelocity[i3 + 1]! - dt * 3.8;
      this.particleVelocity[i3] = this.particleVelocity[i3]! * Math.exp(-dt * 1.8);
      this.particleVelocity[i3 + 2] = this.particleVelocity[i3 + 2]! * Math.exp(-dt * 1.8);
      this.particlePosition[i3] = this.particlePosition[i3]! + this.particleVelocity[i3]! * dt;
      this.particlePosition[i3 + 1] = this.particlePosition[i3 + 1]! + this.particleVelocity[i3 + 1]! * dt;
      this.particlePosition[i3 + 2] = this.particlePosition[i3 + 2]! + this.particleVelocity[i3 + 2]! * dt;
    }
    if (changed) this.markParticleAttributes();

    for (const beam of this.beams) {
      if (beam.life <= 0) continue;
      beam.life = Math.max(0, beam.life - dt);
      const material = beam.mesh.material as THREE.MeshBasicMaterial;
      material.opacity = Math.pow(beam.life / beam.maxLife, 1.8);
      beam.mesh.scale.x *= Math.exp(-dt * 8);
      beam.mesh.scale.z = beam.mesh.scale.x;
      if (beam.life === 0) beam.mesh.visible = false;
    }

    for (const ring of this.rings) {
      if (ring.life <= 0) continue;
      ring.life = Math.max(0, ring.life - dt);
      const t = 1 - ring.life / ring.maxLife;
      const scale = 0.2 + (1 - Math.pow(1 - t, 3)) * ring.growth;
      ring.mesh.scale.setScalar(scale);
      (ring.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.38;
      if (ring.life === 0) ring.mesh.visible = false;
    }
  }

  activeParticles(): number {
    let active = 0;
    for (let i = 0; i < MAX_PARTICLES; i += 1) if (this.particleLife[i]! > 0) active += 1;
    return active;
  }

  dispose(): void {
    this.particleGeometry.dispose();
    (this.particles.material as THREE.Material).dispose();
    const beamGeometry = this.beams[0]?.mesh.geometry;
    const ringGeometry = this.rings[0]?.mesh.geometry;
    for (const beam of this.beams) (beam.mesh.material as THREE.Material).dispose();
    for (const ring of this.rings) (ring.mesh.material as THREE.Material).dispose();
    beamGeometry?.dispose();
    ringGeometry?.dispose();
  }

  private acquireParticle(): number {
    for (let attempt = 0; attempt < MAX_PARTICLES; attempt += 1) {
      const index = (this.particleCursor + attempt) % MAX_PARTICLES;
      if (this.particleLife[index]! <= 0) {
        this.particleCursor = (index + 1) % MAX_PARTICLES;
        return index;
      }
    }
    const index = this.particleCursor;
    this.particleCursor = (this.particleCursor + 1) % MAX_PARTICLES;
    return index;
  }

  private markParticleAttributes(): void {
    (this.particleGeometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    (this.particleGeometry.getAttribute("aColor") as THREE.BufferAttribute).needsUpdate = true;
    (this.particleGeometry.getAttribute("aLife") as THREE.BufferAttribute).needsUpdate = true;
    (this.particleGeometry.getAttribute("aSize") as THREE.BufferAttribute).needsUpdate = true;
  }
}
