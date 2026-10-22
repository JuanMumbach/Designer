import defaultDesignMaterials from '../config/defaultDesignMaterials.json';
import { resolveBudgetAlias } from './budget';
import {
  AppliedMaterial,
  GlobalMaterials,
  MaterialOverrides,
} from '@/components/DesignScreen/3dView/DesignObjects';
import { fetchMaterialVersion, MaterialMeta, MaterialType } from './api';

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
  return resolveBudgetAlias(value, globalMaterials);
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

export async function resolveDefaultSlotTextures(
  slots: { slot: number; materialTypeId: string }[],
  materialTypes: MaterialType[],
  materials: MaterialMeta[]
): Promise<Record<number, AppliedMaterial>> {
  const globals = collectDefaultGlobalMaterials(
    designMaterialsConfig.designMaterialSlots,
    materials,
    materialTypes
  );
  const typeById = new Map(materialTypes.map((t) => [t.id, t]));
  const metaById = new Map(materials.map((m) => [m.id, m]));
  const dataCache = new Map<string, AppliedMaterial | null>();
  const result: Record<number, AppliedMaterial> = {};

  for (const slot of slots) {
    if (!slot.materialTypeId) continue;
    const type = typeById.get(slot.materialTypeId);
    if (!type) continue;
    const key = normalizeTypeName(type.name);
    const designSlot = designMaterialsConfig.designMaterialSlots.find(
      (s) => normalizeTypeName(s.type) === key
    );
    if (!designSlot) continue;
    const materialId = globals[designSlot.key];
    if (!materialId) continue;

    let applied = dataCache.get(materialId);
    if (applied === undefined) {
      applied = null;
      const meta = metaById.get(materialId);
      if (meta) {
        try {
          const data = await fetchMaterialVersion(materialId, meta.lastVersion);
          if (data?.fileURL) {
            applied = {
              fileURL: data.fileURL,
              scaleU: Number(data.scaleU) || 1,
              scaleV: Number(data.scaleV) || 1,
            };
          }
        } catch (err) {
          console.warn('Failed to resolve default material for slot:', err);
        }
      }
      dataCache.set(materialId, applied);
    }

    if (applied) result[slot.slot] = applied;
  }

  return result;
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
