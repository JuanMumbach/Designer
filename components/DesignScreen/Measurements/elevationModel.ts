import * as THREE from 'three';
import type { DesignObject } from '../3dView/DesignObjects';
import { WallView } from '../../../services/measurements';

export function getElevationRotation(rotation: number, wall: WallView): number {
  return rotation + (wall === WallView.Left ? -Math.PI / 2 : wall === WallView.Right ? Math.PI / 2 : 0);
}

export function createElevationModel(source: THREE.Group, object: DesignObject, wall: WallView) {
  const model = source.clone(true);
  model.rotation.y -= Math.PI / 2;
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const geometries: THREE.EdgesGeometry[] = [];
  const faceMaterial = new THREE.MeshBasicMaterial({
    color: '#ffffff', side: THREE.DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  });
  const edgeMaterial = new THREE.LineBasicMaterial({ color: '#000000', depthTest: true });
  const meshes: THREE.Mesh[] = [];
  model.traverse(child => {
    if (child instanceof THREE.Mesh) meshes.push(child);
  });
  meshes.forEach(mesh => {
    mesh.material = faceMaterial;
    const edges = new THREE.EdgesGeometry(mesh.geometry, 25);
    geometries.push(edges);
    const lines = new THREE.LineSegments(edges, edgeMaterial);
    lines.renderOrder = 1;
    lines.raycast = () => {};
    mesh.add(lines);
  });
  const centered = new THREE.Group();
  centered.add(model);
  model.position.sub(center);
  const fitted = new THREE.Group();
  fitted.scale.set(object.dimensions[0] / (size.x || 1), object.dimensions[1] / (size.y || 1), object.dimensions[2] / (size.z || 1));
  fitted.add(centered);
  const elevation = new THREE.Group();
  elevation.rotation.y = getElevationRotation(object.rotation, wall);
  elevation.add(fitted);
  return {
    scene: elevation,
    dispose: () => {
      geometries.forEach(geometry => geometry.dispose());
      faceMaterial.dispose();
      edgeMaterial.dispose();
    },
  };
}
