import { BudgetLine, BudgetMaterial, calculateModuleBudget, ModelBudgetEntry, ModuleBudget, roundBudgetAmount } from './budget';
import type { CutPiece } from './cuttingPlan';

export interface MaterialPart {
  id: string;
  name: string;
  materialSlot: number;
  widthMm: number;
  heightMm: number;
  quantity: number;
  allowRotation?: boolean;
}

export interface BoardSettings { boardWidthMm: number; boardHeightMm: number; cutSpacingMm: number }
export interface PricedMaterial extends BudgetMaterial, Partial<BoardSettings> { pricePerSquareMeter?: number | null }
export interface MaterialPartCost { part: MaterialPart; materialId?: string; materialName?: string; areaM2: number; pricePerSquareMeter?: number; amount?: number; error?: string }
export interface MaterialDemand { material: PricedMaterial; areaM2: number; count: number; pieces: CutPiece[]; error?: string }

export const defaultBoardSettings: BoardSettings = { boardWidthMm: 2600, boardHeightMm: 1600, cutSpacingMm: 3 };

export function validateBoardSettings(settings: BoardSettings): string | undefined {
  if (![settings.boardWidthMm, settings.boardHeightMm, settings.cutSpacingMm].every(Number.isFinite) || settings.boardWidthMm <= 0 || settings.boardHeightMm <= 0 || settings.boardWidthMm > 100000 || settings.boardHeightMm > 100000 || settings.cutSpacingMm < 0 || settings.cutSpacingMm > 1000 || settings.cutSpacingMm >= Math.min(settings.boardWidthMm, settings.boardHeightMm)) return 'Medidas de placa o separación de cortes inválidas.';
}

export function validateMaterialParts(parts: MaterialPart[]): string | undefined {
  if (!Array.isArray(parts) || parts.length > 200) return 'El despiece admite hasta 200 partes distintas.';
  const ids = new Set<string>();
  for (const part of parts) {
    if (!part || typeof part.id !== 'string' || !part.id.trim() || part.id.length > 100 || ids.has(part.id)) return 'Cada parte necesita un identificador único.';
    ids.add(part.id);
    if (typeof part.name !== 'string' || !part.name.trim() || part.name.length > 200) return 'Cada parte necesita un nombre de hasta 200 caracteres.';
    if (!Number.isInteger(part.materialSlot) || part.materialSlot < 0 || part.materialSlot > 1000) return 'Asigná un slot de material válido.';
    if (![part.widthMm, part.heightMm].every((value) => Number.isFinite(value) && value > 0 && value <= 100000)) return 'Las medidas de corte deben ser mayores que 0 y hasta 100.000 mm.';
    if (!Number.isInteger(part.quantity) || part.quantity < 1 || part.quantity > 1000) return 'La cantidad debe ser un entero entre 1 y 1000.';
  }
}

export function materialPartsArea(parts: MaterialPart[]): number {
  return parts.reduce((sum, part) => sum + part.widthMm * part.heightMm * part.quantity / 1e6, 0);
}

export function calculatePartsBudget(parts: MaterialPart[], entries: ModelBudgetEntry[] | undefined, materials: PricedMaterial[], resolveSlot: (slot: number) => string | undefined): ModuleBudget & { partCosts: MaterialPartCost[]; areaM2: number } {
  if (!parts.length) return { ...calculateModuleBudget(entries, materials, resolveSlot), partCosts: [], areaM2: 0 };
  const validation = validateMaterialParts(parts);
  if (validation) return { lines: [], partCosts: [], areaM2: 0, error: validation };
  const coveredSlots = new Set(parts.map((part) => part.materialSlot));
  const otherEntries = (entries ?? []).filter((entry) => entry.materialSlot == null || !coveredSlots.has(entry.materialSlot));
  const extras = otherEntries.length ? calculateModuleBudget(otherEntries, materials, resolveSlot) : { lines: [] as BudgetLine[], total: 0 };
  const partCosts = parts.map((part): MaterialPartCost => {
    const areaM2 = part.widthMm * part.heightMm * part.quantity / 1e6;
    const materialId = resolveSlot(part.materialSlot);
    const material = materials.find((candidate) => candidate.id === materialId);
    const price = material?.pricePerSquareMeter;
    if (!material) return { part, areaM2, materialId, error: 'Material sin resolver' };
    if (price == null || !Number.isFinite(price) || price < 0 || price > 1e9) return { part, areaM2, materialId, materialName: material.name, error: 'Precio por m² sin configurar' };
    const amount = roundBudgetAmount(areaM2 * price);
    return { part, areaM2, materialId, materialName: material.name, pricePerSquareMeter: price, amount, ...(amount === undefined ? { error: 'Importe fuera de rango' } : {}) };
  });
  const total = extras.total !== undefined && partCosts.every((cost) => cost.amount !== undefined) ? roundBudgetAmount(extras.total + partCosts.reduce((sum, cost) => sum + cost.amount!, 0)) : undefined;
  return { lines: extras.lines, partCosts, areaM2: materialPartsArea(parts), total, ...(total === undefined ? { error: 'Presupuesto incompleto' } : {}) };
}

export function collectMaterialDemand(rows: { object: { id: string; name: string }; result: { partCosts: MaterialPartCost[] } }[], materials: PricedMaterial[]): MaterialDemand[] {
  const demands = new Map<string, MaterialDemand>();
  for (const row of rows) for (const cost of row.result.partCosts) {
    const material = materials.find((candidate) => candidate.id === cost.materialId);
    if (!material) continue;
    let demand = demands.get(material.id);
    if (!demand) { demand = { material, areaM2: 0, count: 0, pieces: [] }; demands.set(material.id, demand); }
    demand.areaM2 += cost.areaM2;
    demand.count += cost.part.quantity;
    if (demand.count > 5000) { demand.error = 'La simulación admite hasta 5000 piezas por material.'; demand.pieces = []; continue; }
    for (let index = 0; index < cost.part.quantity; index++) demand.pieces.push({ id: `${row.object.id}:${cost.part.id}:${index}`, name: cost.part.name, moduleName: row.object.name, widthMm: cost.part.widthMm, heightMm: cost.part.heightMm });
  }
  return [...demands.values()];
}

export function formatArea(area: number): string {
  return area.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}
