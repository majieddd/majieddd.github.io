import * as THREE from "three";

type CameraState = {
  yaw: number;
  pitch: number;
  distance: number;
  focusX: number;
  focusZ: number;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export class BattleCamera {
  readonly camera: THREE.PerspectiveCamera;
  readonly current: CameraState = { yaw: -0.74, pitch: 0.70, distance: 27.2, focusX: 0, focusZ: 0 };
  readonly target: CameraState = { ...this.current };
  private dragPointer = -1;
  private previousX = 0;
  private previousY = 0;
  private dragDistance = 0;
  private shake = 0;
  private shakeSeed = 0;
  private readonly reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.camera = new THREE.PerspectiveCamera(44, 1, 0.1, 180);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerUp);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
    this.update(1);
  }

  reset(): void {
    Object.assign(this.target, { yaw: -0.74, pitch: 0.70, distance: 27.2, focusX: 0, focusZ: 0 });
  }

  addShake(amount: number): void {
    if (!this.reduceMotion) this.shake = Math.min(1.5, this.shake + amount);
  }

  wasDrag(): boolean {
    return this.dragDistance > 5;
  }

  update(dt: number): void {
    const k = 1 - Math.exp(-dt * 9.5);
    this.current.yaw += (this.target.yaw - this.current.yaw) * k;
    this.current.pitch += (this.target.pitch - this.current.pitch) * k;
    this.current.distance += (this.target.distance - this.current.distance) * k;
    this.current.focusX += (this.target.focusX - this.current.focusX) * k;
    this.current.focusZ += (this.target.focusZ - this.current.focusZ) * k;
    this.shake = Math.max(0, this.shake - dt * 4.8);
    this.shakeSeed += dt * 41;
    const shakeX = Math.sin(this.shakeSeed * 1.7) * this.shake * 0.09;
    const shakeY = Math.sin(this.shakeSeed * 2.3 + 1.1) * this.shake * 0.06;
    const horizontal = Math.cos(this.current.pitch) * this.current.distance;
    const focus = new THREE.Vector3(this.current.focusX, 0.25, this.current.focusZ);
    this.camera.position.set(
      focus.x + Math.sin(this.current.yaw) * horizontal + shakeX,
      focus.y + Math.sin(this.current.pitch) * this.current.distance + shakeY,
      focus.z + Math.cos(this.current.yaw) * horizontal,
    );
    this.camera.lookAt(focus);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerUp);
    this.canvas.removeEventListener("wheel", this.onWheel);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 && event.button !== 1 && event.button !== 2) return;
    this.dragPointer = event.pointerId;
    this.previousX = event.clientX;
    this.previousY = event.clientY;
    this.dragDistance = 0;
    this.canvas.setPointerCapture(event.pointerId);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.dragPointer) return;
    const dx = event.clientX - this.previousX;
    const dy = event.clientY - this.previousY;
    this.previousX = event.clientX;
    this.previousY = event.clientY;
    this.dragDistance += Math.hypot(dx, dy);
    if ((event.buttons & 1) !== 0 || (event.buttons & 4) !== 0 || (event.buttons & 2) !== 0) {
      this.target.yaw -= dx * 0.0052;
      this.target.pitch = clamp(this.target.pitch + dy * 0.0041, 0.48, 1.13);
    }
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.dragPointer) return;
    this.dragPointer = -1;
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
  };

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.target.distance = clamp(this.target.distance * Math.exp(event.deltaY * 0.001), 18, 43);
  };
}
