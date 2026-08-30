import * as THREE from "three";
import { BUILD_SLOTS, PATH_POINTS } from "../game/content/catalog";

export type WorldScene = {
  root: THREE.Group;
  buildTargets: THREE.Object3D[];
  buildRings: THREE.Mesh[];
  entry: THREE.Object3D;
  relic: THREE.Object3D;
  sun: THREE.DirectionalLight;
};

// Rendering follows a real spherical cap while the deterministic simulation remains in its existing XZ space.
export const PLANET_RADIUS = 42;
export const PLANET_CAP_RADIUS = 20.4;

export function planetSurfaceHeight(x: number, z: number): number {
  const radialSquared = Math.min(x * x + z * z, PLANET_RADIUS * PLANET_RADIUS - 0.001);
  return Math.sqrt(PLANET_RADIUS * PLANET_RADIUS - radialSquared) - PLANET_RADIUS;
}

function pigmentTexture(renderer: THREE.WebGLRenderer, base: string, light: string, seed: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D unavailable for pigment texture");
  context.fillStyle = base;
  context.fillRect(0, 0, canvas.width, canvas.height);
  let value = seed >>> 0;
  const random = (): number => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
  context.globalCompositeOperation = "screen";
  context.lineCap = "round";
  for (let i = 0; i < 420; i += 1) {
    const y = random() * canvas.height;
    const x = random() * canvas.width;
    const length = 30 + random() * 170;
    context.strokeStyle = light;
    context.globalAlpha = 0.032 + random() * 0.095;
    context.lineWidth = 1 + random() * 11;
    context.beginPath();
    context.moveTo(x, y);
    context.bezierCurveTo(x + length * 0.32, y - 9 + random() * 18, x + length * 0.68, y - 12 + random() * 24, x + length, y + random() * 8 - 4);
    context.stroke();
  }
  context.globalCompositeOperation = "multiply";
  for (let i = 0; i < 110; i += 1) {
    context.globalAlpha = 0.025 + random() * 0.045;
    context.fillStyle = base;
    context.beginPath();
    context.ellipse(random() * 512, random() * 512, 8 + random() * 32, 2 + random() * 9, random() * Math.PI, 0, Math.PI * 2);
    context.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3.2, 2.2);
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function createPlanetCapGeometry(): THREE.BufferGeometry {
  const radialSegments = 30;
  const angularSegments = 128;
  const row = angularSegments + 1;
  const vertices = new Float32Array((radialSegments + 1) * row * 3);
  const uv = new Float32Array((radialSegments + 1) * row * 2);
  const indices: number[] = [];
  let cursor = 0;
  for (let ring = 0; ring <= radialSegments; ring += 1) {
    const radius = PLANET_CAP_RADIUS * ring / radialSegments;
    for (let segment = 0; segment <= angularSegments; segment += 1) {
      const angle = segment / angularSegments * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      vertices[cursor * 3] = x;
      vertices[cursor * 3 + 1] = planetSurfaceHeight(x, z);
      vertices[cursor * 3 + 2] = z;
      uv[cursor * 2] = 0.5 + x / (PLANET_CAP_RADIUS * 2);
      uv[cursor * 2 + 1] = 0.5 + z / (PLANET_CAP_RADIUS * 2);
      cursor += 1;
    }
  }
  for (let ring = 0; ring < radialSegments; ring += 1) {
    for (let segment = 0; segment < angularSegments; segment += 1) {
      const a = ring * row + segment;
      const b = a + row;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createPathRibbon(): THREE.BufferGeometry {
  const width = 1.18;
  const vertices = new Float32Array(PATH_POINTS.length * 2 * 3);
  const uv = new Float32Array(PATH_POINTS.length * 2 * 2);
  const indices: number[] = [];
  for (let i = 0; i < PATH_POINTS.length; i += 1) {
    const current = PATH_POINTS[i]!;
    const previous = PATH_POINTS[Math.max(0, i - 1)]!;
    const next = PATH_POINTS[Math.min(PATH_POINTS.length - 1, i + 1)]!;
    const dx = next.x - previous.x;
    const dz = next.z - previous.z;
    const length = Math.max(0.001, Math.hypot(dx, dz));
    const nx = -dz / length;
    const nz = dx / length;
    const vertex = i * 6;
    const leftX = current.x + nx * width;
    const leftZ = current.z + nz * width;
    const rightX = current.x - nx * width;
    const rightZ = current.z - nz * width;
    vertices[vertex] = leftX;
    vertices[vertex + 1] = planetSurfaceHeight(leftX, leftZ) + 0.13;
    vertices[vertex + 2] = leftZ;
    vertices[vertex + 3] = rightX;
    vertices[vertex + 4] = planetSurfaceHeight(rightX, rightZ) + 0.13;
    vertices[vertex + 5] = rightZ;
    const tex = i * 4;
    uv[tex] = 0;
    uv[tex + 1] = i / 4;
    uv[tex + 2] = 1;
    uv[tex + 3] = i / 4;
    if (i < PATH_POINTS.length - 1) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createRelic(material: THREE.Material, glow: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.name = "Relic_Heart";
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.16, 0.58, 48), material);
  pedestal.position.y = 0.29;
  pedestal.castShadow = pedestal.receiveShadow = true;
  group.add(pedestal);
  const heart = new THREE.Mesh(new THREE.OctahedronGeometry(0.58, 2), glow);
  heart.name = "Relic_Crystal";
  heart.position.y = 1.18;
  heart.rotation.z = 0.3;
  heart.castShadow = true;
  group.add(heart);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.055, 12, 64), glow);
  halo.name = "Relic_Halo";
  halo.position.y = 1.18;
  halo.rotation.x = Math.PI / 2;
  group.add(halo);
  return group;
}

export function createWorld(scene: THREE.Scene, renderer: THREE.WebGLRenderer): WorldScene {
  const root = new THREE.Group();
  root.name = "Forge_World";
  scene.add(root);

  const groundTexture = pigmentTexture(renderer, "#27364a", "#b07860", 4312);
  const roadTexture = pigmentTexture(renderer, "#592d31", "#ed9a50", 8127);
  const stoneMaterial = new THREE.MeshStandardMaterial({ map: groundTexture, color: 0x9ac2bc, roughness: 0.52, metalness: 0.14 });
  const roadMaterial = new THREE.MeshStandardMaterial({ map: roadTexture, color: 0xd3a07d, roughness: 0.40, metalness: 0.08 });
  const ironMaterial = new THREE.MeshStandardMaterial({ color: 0x27323e, roughness: 0.34, metalness: 0.72 });
  const emberMaterial = new THREE.MeshStandardMaterial({ color: 0xff8d38, emissive: 0xff4b17, emissiveIntensity: 3.2, roughness: 0.23, metalness: 0.18 });
  const cyanMaterial = new THREE.MeshStandardMaterial({ color: 0x4cdae0, emissive: 0x1199aa, emissiveIntensity: 2.4, roughness: 0.24, metalness: 0.22 });
  const buildMaterial = new THREE.MeshStandardMaterial({ color: 0x4aa8ad, emissive: 0x0f636c, emissiveIntensity: 0.82, roughness: 0.32, metalness: 0.36 });
  const crustMaterial = new THREE.MeshStandardMaterial({ map: groundTexture, color: 0x31566a, roughness: 0.68, metalness: 0.08 });
  const atmosphereMaterial = new THREE.MeshBasicMaterial({ color: 0x54d8df, transparent: true, opacity: 0.20, blending: THREE.AdditiveBlending, depthWrite: false });

  // This shell joins the curved cap below its rim. Gameplay remains XZ-based, while every rendered surface object
  // is placed against the same spherical height function.
  const planetEdgeY = planetSurfaceHeight(PLANET_CAP_RADIUS, 0);
  const planet = new THREE.Mesh(new THREE.CylinderGeometry(PLANET_CAP_RADIUS, 14.3, 6.4, 128, 7), crustMaterial);
  planet.name = "Coil_Crown_Planet";
  planet.position.y = planetEdgeY - 3.2;
  planet.castShadow = true;
  planet.receiveShadow = true;
  root.add(planet);

  const lowerAtmosphere = new THREE.Mesh(new THREE.TorusGeometry(14.36, 0.13, 12, 128), atmosphereMaterial);
  lowerAtmosphere.name = "Planetary_Lower_Limb";
  lowerAtmosphere.position.y = planetEdgeY - 6.38;
  lowerAtmosphere.rotation.x = Math.PI / 2;
  root.add(lowerAtmosphere);

  const planetSurface = new THREE.Mesh(createPlanetCapGeometry(), stoneMaterial);
  planetSurface.name = "Painted_Planetary_Surface";
  planetSurface.receiveShadow = true;
  root.add(planetSurface);

  const atmosphere = new THREE.Mesh(new THREE.TorusGeometry(PLANET_CAP_RADIUS + 0.18, 0.115, 12, 128), atmosphereMaterial);
  atmosphere.name = "Planetary_Atmosphere_Limb";
  atmosphere.position.y = planetEdgeY + 0.02;
  atmosphere.rotation.x = Math.PI / 2;
  root.add(atmosphere);

  const road = new THREE.Mesh(createPathRibbon(), roadMaterial);
  road.name = "Coil_Road";
  road.receiveShadow = true;
  root.add(road);

  const roadGlow = new THREE.LineBasicMaterial({ color: 0xff9f55, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending });
  const roadPoints = PATH_POINTS.map((point) => new THREE.Vector3(point.x, planetSurfaceHeight(point.x, point.z) + 0.18, point.z));
  const roadLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(roadPoints), roadGlow);
  roadLine.name = "Coil_Flow";
  root.add(roadLine);

  const buildTargets: THREE.Object3D[] = [];
  const buildRings: THREE.Mesh[] = [];
  for (let i = 0; i < BUILD_SLOTS.length; i += 1) {
    const slot = BUILD_SLOTS[i]!;
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.28, 0.42, 32), ironMaterial);
    plinth.name = `Build_Plinth_${i}`;
    const groundY = planetSurfaceHeight(slot.x, slot.z);
    plinth.position.set(slot.x, groundY + 0.2, slot.z);
    plinth.userData.slot = i;
    plinth.castShadow = plinth.receiveShadow = true;
    root.add(plinth);
    buildTargets.push(plinth);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.038, 10, 48), buildMaterial);
    ring.name = `Build_Ring_${i}`;
    ring.position.set(slot.x, groundY + 0.44, slot.z);
    ring.rotation.x = Math.PI / 2;
    ring.userData.slot = i;
    root.add(ring);
    buildTargets.push(ring);
    buildRings.push(ring);
  }

  const entry = new THREE.Group();
  entry.name = "Breach_Gate";
  const gatePoint = PATH_POINTS[0]!;
  entry.position.set(gatePoint.x, planetSurfaceHeight(gatePoint.x, gatePoint.z), gatePoint.z);
  const gateRing = new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.16, 16, 72), emberMaterial);
  gateRing.rotation.y = Math.PI / 2;
  gateRing.position.y = 1.52;
  entry.add(gateRing);
  for (const sign of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.42, 2.8, 8), ironMaterial);
    pillar.position.set(0, 1.25, sign * 1.35);
    pillar.castShadow = pillar.receiveShadow = true;
    entry.add(pillar);
  }
  root.add(entry);

  const endPoint = PATH_POINTS[PATH_POINTS.length - 1]!;
  const relic = createRelic(ironMaterial, cyanMaterial);
  relic.position.set(endPoint.x, planetSurfaceHeight(endPoint.x, endPoint.z), endPoint.z);
  root.add(relic);

  let randomState = 92821;
  const random = (): number => {
    randomState = (randomState * 1103515245 + 12345) & 0x7fffffff;
    return randomState / 0x80000000;
  };
  const rockGeometry = new THREE.DodecahedronGeometry(0.58, 1);
  const shardGeometry = new THREE.ConeGeometry(0.26, 1.4, 5);
  const rockInstances = new THREE.InstancedMesh(rockGeometry, stoneMaterial, 46);
  const shardInstances = new THREE.InstancedMesh(shardGeometry, cyanMaterial, 16);
  rockInstances.name = "Instanced_Edge_Rocks";
  shardInstances.name = "Instanced_Edge_Shards";
  rockInstances.castShadow = rockInstances.receiveShadow = true;
  shardInstances.castShadow = shardInstances.receiveShadow = true;
  const placement = new THREE.Object3D();
  let rockCount = 0;
  let shardCount = 0;
  for (let i = 0; i < 46; i += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 8.8 + random() * 8.1;
    const x = Math.cos(angle) * radius * 1.08;
    const z = Math.sin(angle) * radius * 0.64;
    if (Math.hypot(x - gatePoint.x, z - gatePoint.z) < 2.2 || Math.hypot(x - endPoint.x, z - endPoint.z) < 2.5) continue;
    const isShard = i % 5 === 0;
    placement.position.set(x, planetSurfaceHeight(x, z) + (isShard ? 0.52 : 0.25), z);
    placement.scale.setScalar(0.45 + random() * 0.72);
    placement.rotation.set(random() * 0.3, random() * Math.PI, random() * 0.25);
    placement.updateMatrix();
    if (isShard) shardInstances.setMatrixAt(shardCount++, placement.matrix);
    else rockInstances.setMatrixAt(rockCount++, placement.matrix);
  }
  rockInstances.count = rockCount;
  shardInstances.count = shardCount;
  rockInstances.instanceMatrix.needsUpdate = true;
  shardInstances.instanceMatrix.needsUpdate = true;
  root.add(rockInstances, shardInstances);

  const starGeometry = new THREE.BufferGeometry();
  const starPositions = new Float32Array(700 * 3);
  const starColors = new Float32Array(700 * 3);
  const starColor = new THREE.Color();
  for (let i = 0; i < 700; i += 1) {
    const radius = 48 + random() * 78;
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    starPositions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius;
    starPositions[i * 3 + 1] = Math.abs(Math.cos(phi) * radius) * 0.8 + 8;
    starPositions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
    starColor.setHSL(0.08 + random() * 0.48, 0.24 + random() * 0.32, 0.56 + random() * 0.32);
    starColors[i * 3] = starColor.r;
    starColors[i * 3 + 1] = starColor.g;
    starColors[i * 3 + 2] = starColor.b;
  }
  starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  starGeometry.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
  const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ size: 0.17, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.82, depthWrite: false }));
  stars.name = "Pigment_Stars";
  scene.add(stars);

  const hemisphere = new THREE.HemisphereLight(0xa9d0dd, 0x241719, 2.35);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight(0xffd5a2, 4.85);
  sun.name = "Anchored_Sun";
  sun.position.set(-18, 28, 16);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -23;
  sun.shadow.camera.right = 23;
  sun.shadow.camera.top = 18;
  sun.shadow.camera.bottom = -18;
  sun.shadow.camera.near = 5;
  sun.shadow.camera.far = 65;
  sun.shadow.bias = -0.00022;
  sun.shadow.normalBias = 0.035;
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight(0x3bcbd5, 2.15);
  rim.position.set(20, 9, -18);
  scene.add(rim);
  const lowFill = new THREE.DirectionalLight(0xcc5f3e, 0.72);
  lowFill.position.set(-8, 4, -20);
  scene.add(lowFill);
  const breachLight = new THREE.PointLight(0xff4c20, 16, 13, 2);
  breachLight.position.set(gatePoint.x, 2.4, gatePoint.z);
  scene.add(breachLight);
  const relicLight = new THREE.PointLight(0x2fdce5, 12, 11, 2);
  relicLight.position.set(endPoint.x, 2.0, endPoint.z);
  scene.add(relicLight);

  return { root, buildTargets, buildRings, entry, relic, sun };
}
