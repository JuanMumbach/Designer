import * as THREE from 'three';

export function measureModelSizeInParent(model: THREE.Object3D): THREE.Vector3 | null {
  const parent = model.parent;
  if (!parent) return null;

  model.updateWorldMatrix(true, true);

  const inverseModel = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const toParent = new THREE.Matrix4().copy(parent.matrixWorld).invert().multiply(model.matrixWorld);

  const box = new THREE.Box3();
  const childMatrix = new THREE.Matrix4();
  let foundGeometry = false;

  model.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry;
    if (!geometry) return;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const bounds = geometry.boundingBox;
    if (!bounds) return;
    childMatrix.multiplyMatrices(inverseModel, mesh.matrixWorld);
    box.union(bounds.clone().applyMatrix4(childMatrix));
    foundGeometry = true;
  });

  if (!foundGeometry || box.isEmpty()) return null;

  box.applyMatrix4(toParent);

  const size = box.getSize(new THREE.Vector3());
  if (!(size.x > 0) || !(size.y > 0) || !(size.z > 0)) return null;
  return size;
}

export function fitScaleFromSize(
  size: THREE.Vector3 | null,
  dimensions: [number, number, number]
): [number, number, number] | null {
  if (!size) return null;
  if (!dimensions.every(value => Number.isFinite(value) && value > 0)) return null;

  const scale: [number, number, number] = [
    dimensions[0] / size.x,
    dimensions[1] / size.y,
    dimensions[2] / size.z,
  ];

  if (!scale.every(value => Number.isFinite(value) && value > 0)) return null;
  return scale;
}
