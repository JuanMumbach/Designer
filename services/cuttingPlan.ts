export interface CutPiece {
  id: string;
  name: string;
  moduleName?: string;
  widthMm: number;
  heightMm: number;
}

export interface PlacedCutPiece extends CutPiece {
  xMm: number;
  yMm: number;
  rotated: boolean;
}

export interface CutBoard {
  widthMm: number;
  heightMm: number;
  pieces: PlacedCutPiece[];
}

export interface CuttingPlan {
  boards: CutBoard[];
  unplaced: { piece: CutPiece; reason: string }[];
  usedAreaM2: number;
  boardAreaM2: number;
  wasteAreaM2: number;
  utilization: number;
  error?: string;
}

interface FreeRectangle { x: number; y: number; width: number; height: number }

export function simulateBoardCuts(pieces: CutPiece[], boardWidthMm: number, boardHeightMm: number, spacingMm: number, allowRotation = true): CuttingPlan {
  const result: CuttingPlan = { boards: [], unplaced: [], usedAreaM2: 0, boardAreaM2: 0, wasteAreaM2: 0, utilization: 0 };
  if (![boardWidthMm, boardHeightMm, spacingMm].every(Number.isFinite) || boardWidthMm <= 0 || boardHeightMm <= 0 || boardWidthMm > 100000 || boardHeightMm > 100000 || spacingMm < 0 || spacingMm > 1000 || spacingMm >= Math.min(boardWidthMm, boardHeightMm)) {
    return { ...result, error: 'Revisá el tamaño de placa y la separación entre cortes.' };
  }
  if (pieces.length > 5000) return { ...result, error: 'La simulación admite hasta 5000 piezas.' };
  const free: FreeRectangle[][] = [];
  const ids = new Set<string>();
  const sorted = [...pieces].sort((a, b) => Math.max(b.widthMm, b.heightMm) - Math.max(a.widthMm, a.heightMm) || b.widthMm * b.heightMm - a.widthMm * a.heightMm || a.id.localeCompare(b.id));
  for (const piece of sorted) {
    if (!piece.id || ids.has(piece.id) || ![piece.widthMm, piece.heightMm].every((value) => Number.isFinite(value) && value > 0 && value <= 100000)) {
      result.unplaced.push({ piece, reason: 'Identificador repetido o medidas inválidas.' });
      continue;
    }
    ids.add(piece.id);
    const orientations = [{ width: piece.widthMm, height: piece.heightMm, rotated: false }];
    if (allowRotation && piece.widthMm !== piece.heightMm) orientations.push({ width: piece.heightMm, height: piece.widthMm, rotated: true });
    if (!orientations.some((orientation) => orientation.width <= boardWidthMm && orientation.height <= boardHeightMm)) {
      result.unplaced.push({ piece, reason: 'La pieza no entra en la placa, incluso con giro.' });
      continue;
    }
    let best: { board: number; rect: number; width: number; height: number; rotated: boolean; score: number } | undefined;
    const find = (board: number) => {
      free[board].forEach((rect, index) => {
        for (const orientation of orientations) {
          if (orientation.width > rect.width || orientation.height > rect.height) continue;
          const score = rect.width * rect.height - orientation.width * orientation.height;
          if (!best || score < best.score) best = { board, rect: index, ...orientation, score };
        }
      });
    };
    for (let board = 0; board < free.length; board++) find(board);
    if (!best) {
      free.push([{ x: 0, y: 0, width: boardWidthMm, height: boardHeightMm }]);
      result.boards.push({ widthMm: boardWidthMm, heightMm: boardHeightMm, pieces: [] });
      find(free.length - 1);
    }
    if (!best) { result.unplaced.push({ piece, reason: 'No se pudo ubicar la pieza.' }); continue; }
    const placement = best as { board: number; rect: number; width: number; height: number; rotated: boolean; score: number };
    const rect = free[placement.board].splice(placement.rect, 1)[0];
    result.boards[placement.board].pieces.push({ ...piece, widthMm: placement.width, heightMm: placement.height, xMm: rect.x, yMm: rect.y, rotated: placement.rotated });
    const remainingWidth = rect.width - placement.width - spacingMm;
    const remainingHeight = rect.height - placement.height - spacingMm;
    if (remainingWidth > 0) free[placement.board].push({ x: rect.x + placement.width + spacingMm, y: rect.y, width: remainingWidth, height: placement.height });
    if (remainingHeight > 0) free[placement.board].push({ x: rect.x, y: rect.y + placement.height + spacingMm, width: rect.width, height: remainingHeight });
    result.usedAreaM2 += placement.width * placement.height / 1e6;
  }
  result.boardAreaM2 = result.boards.length * boardWidthMm * boardHeightMm / 1e6;
  result.wasteAreaM2 = Math.max(0, result.boardAreaM2 - result.usedAreaM2);
  result.utilization = result.boardAreaM2 ? Math.min(1, result.usedAreaM2 / result.boardAreaM2) : 0;
  return result;
}
