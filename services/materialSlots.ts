import * as THREE from 'three';
import { sanitizeNodeName } from './glbParts';

export interface MaterialSlotInfo {
  slot: number;
  displayName: string;
}

export interface SlotIndexMaps {
  materialNameToSlot: Map<string, number>;
  identifierToSlot: Map<string, number>;
}

export function buildSlotIndexMaps(parts: {
  materialIndex: number;
  materialName: string | null;
  displayName: string;
  identifier: string;
}[]): SlotIndexMaps {
  const materialNameToSlot = new Map<string, number>();
  const identifierToSlot = new Map<string, number>();
  for (const part of parts) {
    if (part.materialIndex < 0) continue;
    if (part.materialName && !materialNameToSlot.has(part.materialName)) {
      materialNameToSlot.set(part.materialName, part.materialIndex);
    }
    if (!identifierToSlot.has(part.identifier)) {
      identifierToSlot.set(part.identifier, part.materialIndex);
    }
  }
  return { materialNameToSlot, identifierToSlot };
}

export function resolveMeshSlot(
  mesh: THREE.Mesh,
  maps: SlotIndexMaps
): number | null {
  const materialName = (mesh.material as THREE.Material | null)?.name;
  if (materialName) {
    const byName = maps.materialNameToSlot.get(materialName);
    if (byName !== undefined) return byName;
  }
  const byIdentifier = maps.identifierToSlot.get(sanitizeNodeName(mesh.name));
  if (byIdentifier !== undefined) return byIdentifier;
  return null;
}

export function resolveSlotName(
  legacyName: string,
  maps: SlotIndexMaps
): number | null {
  const byName = maps.materialNameToSlot.get(legacyName);
  if (byName !== undefined) return byName;
  const byIdentifier = maps.identifierToSlot.get(legacyName);
  return byIdentifier !== undefined ? byIdentifier : null;
}

export function collectSlots(
  group: THREE.Object3D,
  maps: SlotIndexMaps
): {
  slots: MaterialSlotInfo[];
  originalMaterials: Map<number, THREE.Material>;
} {
  const slots: MaterialSlotInfo[] = [];
  const seenSlots = new Set<number>();
  const originalMaterials = new Map<number, THREE.Material>();

  const bySlotDisplayName = new Map<number, string>();
  group.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material) {
      const slot = resolveMeshSlot(child, maps);
      if (slot === null) return;
      if (!seenSlots.has(slot)) {
        seenSlots.add(slot);
        originalMaterials.set(slot, child.material.clone());
      }
      if (!bySlotDisplayName.has(slot)) {
        bySlotDisplayName.set(slot, (child.material as THREE.Material).name || child.name);
      }
    }
  });

  const sortedSlots = [...bySlotDisplayName.keys()].sort((a, b) => a - b);
  for (const slot of sortedSlots) {
    slots.push({ slot, displayName: bySlotDisplayName.get(slot) || `Slot ${slot}` });
  }

  return { slots, originalMaterials };
}