import { ModelBudgetEntry } from './budget';
import { MaterialPart } from './materialParts';
import { ObjectProperties, ObjectVersion } from './api';

export type VariantMode = 'additive' | 'replace';

export const HANDLE_VARIANT_GROUPS = new Set([
  'handles',
  'handle',
  'tiradores',
  'tirador',
  'manijas',
  'manija',
  'pulls',
  'pull',
]);
export const HANDLE_NONE_KEY = '__none__';

export interface VariantProperties {
  group: string;
  label?: string;
  allowNone?: boolean;
  handleType?: string;
  raw?: Record<string, string>;
}

export interface HandleTypeOption {
  key: string;
  label: string;
  isNone?: boolean;
}

export function normalizeHandleKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isHandleVariantGroup(group: string | undefined): boolean {
  if (!group) return false;
  return HANDLE_VARIANT_GROUPS.has(group.trim().toLowerCase());
}

export function isHandleVariant(variant: ObjectVariant): boolean {
  const parsed = parseVariantProperties(variant.variantProperties);
  return isHandleVariantGroup(parsed.group) || Boolean(parsed.handleType?.trim());
}

export function getVariantHandleTypeKey(variant: ObjectVariant): string | null {
  const parsed = parseVariantProperties(variant.variantProperties);
  if (parsed.handleType?.trim()) {
    const k = normalizeHandleKey(parsed.handleType);
    if (k) return k;
  }
  if (!isHandleVariantGroup(parsed.group)) return null;
  const k = normalizeHandleKey(variant.name || variant.id);
  return k || null;
}

export function getVariantHandleTypeLabel(variant: ObjectVariant): string | null {
  const parsed = parseVariantProperties(variant.variantProperties);
  if (!isHandleVariantGroup(parsed.group) && !parsed.handleType?.trim()) return null;
  if (parsed.raw?.['handle-label']?.trim()) {
    return parsed.raw['handle-label'].trim();
  }
  return variant.name?.trim() || parsed.handleType?.trim() || variant.id;
}

export function collectAvailableHandleTypes(
  variantLists: (ObjectVariant[] | undefined)[]
): HandleTypeOption[] {
  const map = new Map<string, HandleTypeOption>();
  let anyAllowsNone = false;

  for (const list of variantLists) {
    if (!list) continue;
    for (const v of list) {
      const parsed = parseVariantProperties(v.variantProperties);
      if (!isHandleVariantGroup(parsed.group) && !parsed.handleType?.trim()) continue;
      if (parsed.allowNone ?? true) {
        anyAllowsNone = true;
      }
      const key = getVariantHandleTypeKey(v);
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: getVariantHandleTypeLabel(v) || key,
        });
      }
    }
  }

  const options = Array.from(map.values());
  if (anyAllowsNone && options.length > 0 && !map.has(HANDLE_NONE_KEY)) {
    options.unshift({
      key: HANDLE_NONE_KEY,
      label: 'Sin tirador',
      isNone: true,
    });
  }
  return options;
}

export interface MaterialPartOverride {
  targetPartId: string;
  name?: string;
  materialSlot?: number;
  widthMm?: number;
  heightMm?: number;
  widthDeltaMm?: number;
  heightDeltaMm?: number;
  quantity?: number;
  quantityDelta?: number;
  allowRotation?: boolean;
}

export interface MaterialPartsDelta {
  add?: MaterialPart[];
  replace?: MaterialPartOverride[];
  remove?: string[];
}

export interface BudgetEntryOverride {
  targetEntryId: string;
  name?: string;
  basePrice?: number;
  basePriceDelta?: number;
  materialSlot?: number | null;
  clearMaterialSlot?: boolean;
}

export interface BudgetEntriesDelta {
  add?: ModelBudgetEntry[];
  replace?: BudgetEntryOverride[];
  remove?: string[];
}

export interface ObjectVariant {
  id: string;
  objectId: string;
  version: number;
  name: string;
  mode: VariantMode;
  fileURL: string;
  thumbnailURL?: string | null;
  variantProperties: string;
  materialPartsDelta?: MaterialPartsDelta;
  budgetEntriesDelta?: BudgetEntriesDelta;
  creatorId?: string;
  createdAt?: string;
  lastUpdate?: string;
}

export function parseVariantProperties(raw: unknown): VariantProperties {
  if (!raw) return { group: 'general' };

  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    const group = typeof obj.group === 'string' && obj.group.trim() ? obj.group.trim().toLowerCase() : 'general';
    const label = typeof obj.label === 'string' ? obj.label.trim() : undefined;
    const allowNone = typeof obj.allowNone === 'boolean' ? obj.allowNone : undefined;
    const rawHandle = obj.handleType ?? obj['handle-type'] ?? obj['handle_type'];
    const handleType = typeof rawHandle === 'string' && rawHandle.trim() ? rawHandle.trim() : undefined;
    return { group, label, allowNone, handleType };
  }

  if (typeof raw !== 'string') return { group: 'general' };

  const trimmedRaw = raw.trim();
  if (trimmedRaw.startsWith('{') && trimmedRaw.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmedRaw);
      return parseVariantProperties(parsed);
    } catch {
      // Fall through to semicolon parsing
    }
  }

  let group = 'general';
  let label: string | undefined;
  let allowNone: boolean | undefined;
  let handleType: string | undefined;
  const otherProps: Record<string, string> = {};

  const segments = trimmedRaw.split(';');
  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;
    const key = trimmed.slice(0, colonIndex).trim().toLowerCase();
    const value = trimmed.slice(colonIndex + 1).trim();

    if (key === 'group') {
      if (value) group = value.toLowerCase();
    } else if (key === 'label') {
      label = value;
    } else if (key === 'allow-none' || key === 'allownone') {
      allowNone = value.toLowerCase() === 'true';
    } else if (key === 'handle-type' || key === 'handletype' || key === 'handle_type') {
      if (value) handleType = value;
    } else {
      otherProps[key] = value;
    }
  }

  return {
    group,
    label,
    allowNone,
    handleType,
    raw: Object.keys(otherProps).length > 0 ? otherProps : undefined,
  };
}

export function serializeVariantProperties(props: VariantProperties): string {
  const segments: string[] = [`group:${props.group.trim().toLowerCase()}`];
  if (props.label?.trim()) {
    segments.push(`label:${props.label.trim()}`);
  }
  if (props.allowNone !== undefined) {
    segments.push(`allow-none:${props.allowNone}`);
  }
  if (props.handleType?.trim()) {
    segments.push(`handle-type:${normalizeHandleKey(props.handleType)}`);
  }
  if (props.raw) {
    for (const [k, v] of Object.entries(props.raw)) {
      if (
        k !== 'group' &&
        k !== 'label' &&
        k !== 'allow-none' &&
        k !== 'handle-type' &&
        k !== 'handletype' &&
        k !== 'handle_type' &&
        v
      ) {
        segments.push(`${k}:${v}`);
      }
    }
  }
  return segments.join(';');
}

export function parseDefaultVariantsSegment(value: string): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  if (!value) return result;

  let raw = value.trim();
  const prefix = 'default-variants:';
  const prefixIdx = raw.toLowerCase().indexOf(prefix);
  if (prefixIdx !== -1) {
    raw = raw.slice(prefixIdx + prefix.length);
    const semiIdx = raw.indexOf(';');
    if (semiIdx !== -1) {
      raw = raw.slice(0, semiIdx);
    }
  }

  const pairs = raw.split(',');
  for (const pair of pairs) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const group = trimmed.slice(0, eqIndex).trim().toLowerCase();
    const val = trimmed.slice(eqIndex + 1).trim();
    if (!group) continue;
    result[group] = val.toLowerCase() === 'null' || val === '' ? null : val;
  }
  return result;
}

export function serializeDefaultVariantsSegment(map: Record<string, string | null>): string {
  const pairs: string[] = [];
  for (const [group, variantId] of Object.entries(map)) {
    if (!group.trim()) continue;
    pairs.push(`${group.trim().toLowerCase()}=${variantId ? variantId.trim() : 'null'}`);
  }
  return pairs.length > 0 ? `default-variants:${pairs.join(',')}` : '';
}

export function resolveActiveVariants(
  variants: ObjectVariant[] | undefined,
  defaultVariants?: Record<string, string | null>,
  selectedVariants?: Record<string, string | null>,
  defaultHandleType?: string | null
): ObjectVariant[] {
  if (!variants || variants.length === 0) return [];

  const byGroup = new Map<string, ObjectVariant[]>();
  for (const v of variants) {
    const parsed = parseVariantProperties(v.variantProperties);
    const g = parsed.group;
    let list = byGroup.get(g);
    if (!list) {
      list = [];
      byGroup.set(g, list);
    }
    list.push(v);
  }

  const active: ObjectVariant[] = [];
  const sortedGroups = Array.from(byGroup.keys()).sort();
  const normalizedDefaultHandle =
    defaultHandleType && defaultHandleType !== HANDLE_NONE_KEY
      ? normalizeHandleKey(defaultHandleType)
      : defaultHandleType === HANDLE_NONE_KEY
        ? HANDLE_NONE_KEY
        : null;

  for (const group of sortedGroups) {
    const groupVariants = byGroup.get(group)!;
    const isHandleGroup =
      isHandleVariantGroup(group) || groupVariants.some((v) => isHandleVariant(v));
    let chosenId: string | null | undefined;
    let resolvedViaDesignDefault = false;

    if (selectedVariants && group in selectedVariants && selectedVariants[group] !== undefined) {
      chosenId = selectedVariants[group];
    } else if (isHandleGroup && normalizedDefaultHandle) {
      if (normalizedDefaultHandle === HANDLE_NONE_KEY) {
        const allowNone = groupVariants.every(
          (v) => (parseVariantProperties(v.variantProperties).allowNone ?? true) !== false
        );
        const noneVar = groupVariants.find(
          (v) => !v.fileURL || getVariantHandleTypeKey(v) === 'none' || getVariantHandleTypeKey(v) === 'sin-tirador'
        );
        if (noneVar) {
          chosenId = noneVar.id;
          resolvedViaDesignDefault = true;
        } else if (allowNone) {
          chosenId = null;
          resolvedViaDesignDefault = true;
        }
      } else {
        const matchingHandle = groupVariants.find(
          (v) => getVariantHandleTypeKey(v) === normalizedDefaultHandle
        );
        if (matchingHandle) {
          chosenId = matchingHandle.id;
          resolvedViaDesignDefault = true;
        }
      }
    }

    if (!resolvedViaDesignDefault && !(selectedVariants && group in selectedVariants && selectedVariants[group] !== undefined)) {
      if (defaultVariants && group in defaultVariants) {
        chosenId = defaultVariants[group];
      } else {
        chosenId = groupVariants[0]?.id;
      }
    }

    if (chosenId) {
      const match = groupVariants.find((v) => v.id.toLowerCase() === chosenId!.toLowerCase());
      if (match) {
        active.push(match);
      }
    }
  }

  return active;
}

export function resolveVariantMeshes(
  baseModelUrl: string,
  activeVariants: ObjectVariant[]
): {
  primaryModelUrl: string;
  additiveMeshes: ObjectVariant[];
} {
  let primaryModelUrl = baseModelUrl;
  const additiveMeshes: ObjectVariant[] = [];

  for (const variant of activeVariants) {
    if (variant.mode === 'replace') {
      if (variant.fileURL) {
        primaryModelUrl = variant.fileURL;
      }
    } else {
      if (variant.fileURL) {
        additiveMeshes.push(variant);
      }
    }
  }

  return { primaryModelUrl, additiveMeshes };
}

export function applyMaterialPartsDeltas(
  baseParts: MaterialPart[],
  activeVariants: ObjectVariant[]
): MaterialPart[] {
  let workingParts = baseParts.map((p) => ({ ...p }));

  for (const variant of activeVariants) {
    const delta = variant.materialPartsDelta;
    if (!delta) continue;

    if (delta.remove && delta.remove.length > 0) {
      const removeSet = new Set(delta.remove);
      workingParts = workingParts.filter((p) => !removeSet.has(p.id));
    }

    if (delta.replace && delta.replace.length > 0) {
      const replaceMap = new Map(delta.replace.map((r) => [r.targetPartId, r]));
      workingParts = workingParts.map((part) => {
        const override = replaceMap.get(part.id);
        if (!override) return part;

        let widthMm = part.widthMm;
        if (override.widthMm !== undefined) {
          widthMm = override.widthMm;
        } else if (override.widthDeltaMm !== undefined) {
          widthMm = Math.max(1, widthMm + override.widthDeltaMm);
        }

        let heightMm = part.heightMm;
        if (override.heightMm !== undefined) {
          heightMm = override.heightMm;
        } else if (override.heightDeltaMm !== undefined) {
          heightMm = Math.max(1, heightMm + override.heightDeltaMm);
        }

        let quantity = part.quantity;
        if (override.quantity !== undefined) {
          quantity = override.quantity;
        } else if (override.quantityDelta !== undefined) {
          quantity = Math.max(1, quantity + override.quantityDelta);
        }

        return {
          ...part,
          name: override.name ?? part.name,
          materialSlot: override.materialSlot !== undefined ? override.materialSlot : part.materialSlot,
          widthMm,
          heightMm,
          quantity,
          allowRotation: override.allowRotation !== undefined ? override.allowRotation : part.allowRotation,
        };
      });
    }

    if (delta.add && delta.add.length > 0) {
      for (const addedPart of delta.add) {
        workingParts.push({ ...addedPart });
      }
    }
  }

  return workingParts;
}

export function applyBudgetEntriesDeltas(
  baseEntries: ModelBudgetEntry[],
  activeVariants: ObjectVariant[]
): ModelBudgetEntry[] {
  let workingEntries = baseEntries.map((e) => ({ ...e }));

  for (const variant of activeVariants) {
    const delta = variant.budgetEntriesDelta;
    if (!delta) continue;

    if (delta.remove && delta.remove.length > 0) {
      const removeSet = new Set(delta.remove);
      workingEntries = workingEntries.filter((e) => !removeSet.has(e.id));
    }

    if (delta.replace && delta.replace.length > 0) {
      const replaceMap = new Map(delta.replace.map((r) => [r.targetEntryId, r]));
      workingEntries = workingEntries.map((entry) => {
        const override = replaceMap.get(entry.id);
        if (!override) return entry;

        let basePrice = entry.basePrice;
        if (override.basePrice !== undefined) {
          basePrice = override.basePrice;
        } else if (override.basePriceDelta !== undefined) {
          basePrice = Math.max(0, basePrice + override.basePriceDelta);
        }

        let materialSlot = entry.materialSlot;
        if (override.clearMaterialSlot) {
          materialSlot = null;
        } else if (override.materialSlot !== undefined) {
          materialSlot = override.materialSlot;
        }

        return {
          ...entry,
          name: override.name ?? entry.name,
          basePrice,
          materialSlot,
        };
      });
    }

    if (delta.add && delta.add.length > 0) {
      for (const addedEntry of delta.add) {
        workingEntries.push({ ...addedEntry });
      }
    }
  }

  return workingEntries;
}

export function resolveEffectiveModuleInventory(
  version: ObjectVersion | undefined,
  instance: {
    materialParts?: MaterialPart[];
    budgetEntries?: ModelBudgetEntry[];
    variants?: ObjectVariant[];
    selectedVariants?: Record<string, string | null>;
    objectProperties?: ObjectProperties;
  },
  defaultHandleType?: string | null
): {
  parts: MaterialPart[];
  entries: ModelBudgetEntry[];
  activeVariants: ObjectVariant[];
} {
  const availableVariants = instance.variants ?? version?.variants ?? [];
  const versionDefaults = typeof version?.objectProperties === 'object' && version?.objectProperties !== null
    ? version.objectProperties.defaultVariants
    : undefined;
  const defaultVariants = instance.objectProperties?.defaultVariants ?? versionDefaults;
  const activeVariants = resolveActiveVariants(
    availableVariants,
    defaultVariants,
    instance.selectedVariants,
    defaultHandleType
  );

  let parts: MaterialPart[];
  if (instance.materialParts !== undefined) {
    parts = instance.materialParts;
  } else {
    const baseParts = version?.materialParts ?? [];
    parts = applyMaterialPartsDeltas(baseParts, activeVariants);
  }

  let entries: ModelBudgetEntry[];
  if (instance.budgetEntries !== undefined) {
    entries = instance.budgetEntries;
  } else {
    const baseEntries = version?.budgetEntries ?? [];
    entries = applyBudgetEntriesDeltas(baseEntries, activeVariants);
  }

  return { parts, entries, activeVariants };
}
