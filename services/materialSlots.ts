import * as THREE from 'three';

export function getMeshSlotName(mesh: THREE.Mesh): string {
  return (mesh.material as THREE.Material | null)?.name || mesh.name;
}

export function collectMeshSlots(group: THREE.Object3D): {
  names: string[];
  originalMaterials: Map<string, THREE.Material>;
} {
  const names: string[] = [];
  const seen = new Set<string>();
  const originalMaterials = new Map<string, THREE.Material>();
  group.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material) {
      const slot = getMeshSlotName(child);
      if (!slot) return;
      if (!seen.has(slot)) {
        seen.add(slot);
        names.push(slot);
        originalMaterials.set(slot, child.material.clone());
      }
    }
  });
  return { names, originalMaterials };
}