import defaultDesignMaterials from '../config/defaultDesignMaterials.json';
import { GlobalMaterials, MaterialOverrides } from '@/components/DesignScreen/3dView/DesignObjects';
import { MaterialMeta, MaterialType } from './api';

export interface DesignMaterialSlot {
  key: string;
  label: string;
  type: string;
  materialId: string;
}

export interface DesignMaterialsConfig {
  version: number;
  designMaterialSlots: DesignMaterialSlot[];
}

export const designMaterialsConfig: DesignMaterialsConfig = defaultDesignMaterials as DesignMaterialsConfig;

export function designSlotByKey(slots: DesignMaterialSlot[], key: string): DesignMaterialSlot | undefined {
  return slots.find(s => s.key === key);
}

export function designSlotForType(slots: DesignMaterialSlot[], typeName: string): DesignMaterialSlot | undefined {
  if (!typeName) return undefined;
  return slots.find(s => s.type === typeName);
}

export function isMaterialRef(value: string): boolean {
  return value.startsWith('ref:');
}

export function resolveMaterialValue(
  value: string,
  globalMaterials: GlobalMaterials
): string | undefined {
  if (!value) return undefined;
  if (isMaterialRef(value)) {
    const designKey = value.substring(4);
    const target = globalMaterials[designKey];
    if (!target || target.startsWith('ref:')) return undefined;
    return target;
  }
  return value;
}

export function collectDefaultGlobalMaterials(
  slots: DesignMaterialSlot[],
  materials: MaterialMeta[],
  materialTypes: MaterialType[]
): GlobalMaterials {
  const typeNameById = new Map<string, string>();
  for (const t of materialTypes) {
    if (t.name) typeNameById.set(t.id, t.name);
  }

  const matchesSlotType = (m: MaterialMeta, slotType: string): boolean => {
    const expected = normalizeTypeName(slotType);
    if (!expected) return false;
    if (m.type?.name && normalizeTypeName(m.type.name) === expected) return true;
    if (m.typeId) {
      const resolvedName = typeNameById.get(m.typeId);
      if (resolvedName && normalizeTypeName(resolvedName) === expected) return true;
    }
    return false;
  };

  const resolved: GlobalMaterials = {};
  for (const slot of slots) {
    if (slot.materialId) {
      resolved[slot.key] = slot.materialId;
      continue;
    }
    if (!slot.type) continue;
    const candidate = materials.find(m => matchesSlotType(m, slot.type));
    if (candidate) resolved[slot.key] = candidate.id;
  }
  return resolved;
}

export function normalizeTypeName(name: string): string {
  return name.trim().toLowerCase();
}

export function resolveInstanceOverrides(
  overrides: MaterialOverrides,
  globalMaterials: GlobalMaterials,
  materialDataById: Record<string, { fileURL: string; scaleU: number; scaleV: number }> | undefined
): { [slot: number]: { fileURL: string; scaleU: number; scaleV: number } } {
  const resolved: { [slot: number]: { fileURL: string; scaleU: number; scaleV: number } } = {};
  for (const slotKey of Object.keys(overrides)) {
    const slot = Number(slotKey);
    const value = overrides[slot];
    const materialId = resolveMaterialValue(value, globalMaterials);
    const data = materialId && materialDataById ? materialDataById[materialId] : undefined;
    if (data) resolved[slot] = data;
  }
  return resolved;
}