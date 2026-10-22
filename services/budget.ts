export interface ModelBudgetEntry {
  id: string;
  name: string;
  basePrice: number;
  materialSlot?: number | null;
}

export interface BudgetSettings {
  cutting?: Record<string, import('./materialParts').BoardSettings>;
  extras: { id: string; name: string; amount: number }[];
  multipliers: { id: string; name: string; factor: number }[];
}

export interface BudgetMaterial {
  id: string;
  name: string;
  costMultiplier?: number;
}

export interface BudgetLine {
  entry: ModelBudgetEntry;
  materialName?: string;
  multiplier?: number;
  amount?: number;
  error?: string;
}

export interface ModuleBudget {
  lines: BudgetLine[];
  total?: number;
  error?: string;
}

export function emptyBudgetSettings(): BudgetSettings {
  return { extras: [], multipliers: [] };
}

export function parseBudgetNumber(value: string, maximum = 1e9, positive = false): number | undefined {
  const trimmed = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(trimmed)) return undefined;
  const number = Number(trimmed);
  return Number.isFinite(number) && number <= maximum && (positive ? number > 0 : number >= 0)
    ? number : undefined;
}

export function validateBudgetEntries(entries: ModelBudgetEntry[]): string | undefined {
  if (!Array.isArray(entries)) return 'Los conceptos deben ser una lista.';
  if (entries.length > 100) return 'El máximo es de 100 conceptos.';
  const ids = new Set<string>();
  for (const entry of entries) {
    if (!entry || typeof entry.id !== 'string' || !entry.id.trim() || entry.id.length > 100 || ids.has(entry.id)) return 'Los identificadores deben ser únicos.';
    ids.add(entry.id);
    if (typeof entry.name !== 'string' || !entry.name.trim() || entry.name.length > 200) return 'Cada concepto necesita un nombre de hasta 200 caracteres.';
    if (!Number.isFinite(entry.basePrice) || entry.basePrice < 0 || entry.basePrice > 1e9) return 'El importe debe estar entre 0 y 1.000.000.000.';
    if (entry.materialSlot != null && (!Number.isInteger(entry.materialSlot) || entry.materialSlot < 0 || entry.materialSlot > 1000)) return 'El slot debe ser un entero entre 0 y 1000.';
  }
  return undefined;
}

export function validateBudgetSettings(settings: BudgetSettings): string | undefined {
  if (!settings || !Array.isArray(settings.extras) || !Array.isArray(settings.multipliers)) return 'Configuración de presupuesto inválida.';
  if (settings.cutting !== undefined) {
    if (!settings.cutting || typeof settings.cutting !== 'object' || Array.isArray(settings.cutting)) return 'Configuración de cortes inválida.';
    for (const board of Object.values(settings.cutting)) {
      if (!board || ![board.boardWidthMm, board.boardHeightMm, board.cutSpacingMm].every(Number.isFinite) || board.boardWidthMm <= 0 || board.boardHeightMm <= 0 || board.boardWidthMm > 100000 || board.boardHeightMm > 100000 || board.cutSpacingMm < 0 || board.cutSpacingMm > 1000 || board.cutSpacingMm >= Math.min(board.boardWidthMm, board.boardHeightMm)) return 'Configuración de cortes inválida.';
    }
  }
  if (settings.extras.some((extra) => !extra || typeof extra.amount !== 'number') || settings.multipliers.some((factor) => !factor || typeof factor.factor !== 'number')) return 'Configuración de presupuesto inválida.';
  const extrasError = validateBudgetEntries(settings.extras.map((extra) => ({ ...extra, basePrice: extra.amount })));
  if (extrasError) return extrasError;
  const factorsError = validateBudgetEntries(settings.multipliers.map((factor) => ({ ...factor, basePrice: factor.factor })));
  if (factorsError) return factorsError;
  if (settings.multipliers.some((factor) => factor.factor <= 0 || factor.factor > 1e6)) return 'El multiplicador debe ser mayor que 0 y hasta 1.000.000.';
  return undefined;
}

export function roundBudgetAmount(value: number): number | undefined {
  if (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER / 100) return undefined;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function resolveBudgetAlias(value: string | undefined, globals: Record<string, string>, seen = new Set<string>()): string | undefined {
  if (!value) return undefined;
  if (!value.startsWith('ref:')) return value;
  const key = value.slice(4);
  if (seen.has(key)) return undefined;
  return resolveBudgetAlias(globals[key], globals, new Set([...seen, key]));
}

export function resolveBudgetMaterial(
  slot: number,
  overrides: Record<number, string> | undefined,
  globals: Record<string, string>,
  defaultDesignKey?: string,
): string | undefined {
  const explicit = overrides?.[slot];
  return resolveBudgetAlias(explicit ?? (defaultDesignKey ? globals[defaultDesignKey] : undefined), globals);
}

export function calculateModuleBudget(
  entries: ModelBudgetEntry[] | undefined,
  materials: BudgetMaterial[],
  materialForSlot: (slot: number) => string | undefined,
): ModuleBudget {
  if (!entries?.length) return { lines: [], error: 'Precio sin configurar' };
  const validation = validateBudgetEntries(entries);
  if (validation) return { lines: [], error: validation };
  const byId = new Map(materials.map((material) => [material.id, material]));
  const lines = entries.map((entry): BudgetLine => {
    let multiplier = 1;
    let materialName: string | undefined;
    if (entry.materialSlot != null) {
      const materialId = materialForSlot(entry.materialSlot);
      const material = materialId ? byId.get(materialId) : undefined;
      if (!material) return { entry, error: 'Material sin resolver' };
      materialName = material.name;
      multiplier = material.costMultiplier ?? 1;
      if (!Number.isFinite(multiplier) || multiplier <= 0 || multiplier > 1e6) return { entry, materialName, error: 'Multiplicador inválido' };
    }
    const amount = roundBudgetAmount(entry.basePrice * multiplier);
    return { entry, materialName, multiplier, amount, ...(amount === undefined ? { error: 'Importe fuera de rango' } : {}) };
  });
  const total = lines.every((line) => line.amount !== undefined)
    ? roundBudgetAmount(lines.reduce((sum, line) => sum + line.amount!, 0)) : undefined;
  return { lines, total, ...(total === undefined ? { error: 'Presupuesto incompleto' } : {}) };
}

export function calculateDesignBudget(modules: ModuleBudget[], settings: BudgetSettings) {
  const validation = validateBudgetSettings(settings);
  if (validation) return { modulesTotal: undefined, extrasTotal: undefined, subtotal: undefined, total: undefined, error: validation };
  const modulesTotal = roundBudgetAmount(modules.reduce((sum, module) => sum + (module.total ?? 0), 0));
  const extrasTotal = validation ? undefined : roundBudgetAmount(settings.extras.reduce((sum, extra) => sum + (roundBudgetAmount(extra.amount) ?? 0), 0));
  const subtotal = modulesTotal !== undefined && extrasTotal !== undefined ? roundBudgetAmount(modulesTotal + extrasTotal) : undefined;
  let total = subtotal;
  for (const multiplier of settings.multipliers) total = total === undefined ? undefined : roundBudgetAmount(total * multiplier.factor);
  const complete = !validation && modules.every((module) => module.total !== undefined) && total !== undefined;
  return { modulesTotal, extrasTotal, subtotal, total: complete ? total : undefined, error: validation ?? (!complete ? 'Presupuesto incompleto' : undefined) };
}

export function formatBudgetAmount(value: number | undefined): string {
  return value === undefined ? 'Pendiente' : value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
