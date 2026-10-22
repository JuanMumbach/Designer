import * as THREE from 'three';

export function createElevationCamera(width: number, height: number) {
  const camera = Object.assign(new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 0.1, 20000), { manual: true });
  camera.position.set(width / 2, height / 2, 10000);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}
