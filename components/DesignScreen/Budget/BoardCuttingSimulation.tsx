import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { COLORS } from '../../../constants/theme';
import { formatBudgetAmount, parseBudgetNumber, roundBudgetAmount } from '../../../services/budget';
import { simulateBoardCuts } from '../../../services/cuttingPlan';
import { BoardSettings, defaultBoardSettings, formatArea, MaterialDemand, validateBoardSettings } from '../../../services/materialParts';

const pieceColors = ['#bfdbfe', '#bbf7d0', '#fde68a', '#fecaca', '#ddd6fe', '#a5f3fc', '#fed7aa', '#fbcfe8'];

export default function BoardCuttingSimulation({ demand, settings, onSettingsChange }: { demand: MaterialDemand; settings?: BoardSettings; onSettingsChange?: (settings: BoardSettings) => void }) {
  const initial = {
    boardWidthMm: settings?.boardWidthMm ?? demand.material.boardWidthMm ?? defaultBoardSettings.boardWidthMm,
    boardHeightMm: settings?.boardHeightMm ?? demand.material.boardHeightMm ?? defaultBoardSettings.boardHeightMm,
    cutSpacingMm: settings?.cutSpacingMm ?? demand.material.cutSpacingMm ?? defaultBoardSettings.cutSpacingMm,
  };
  const [width, setWidth] = useState(String(initial.boardWidthMm));
  const [height, setHeight] = useState(String(initial.boardHeightMm));
  const [spacing, setSpacing] = useState(String(initial.cutSpacingMm));
  const [applied, setApplied] = useState<BoardSettings>(initial);
  const [error, setError] = useState<string>();
  const [boardIndex, setBoardIndex] = useState(0);
  useEffect(() => {
    const next = { boardWidthMm: initial.boardWidthMm, boardHeightMm: initial.boardHeightMm, cutSpacingMm: initial.cutSpacingMm };
    setWidth(String(next.boardWidthMm)); setHeight(String(next.boardHeightMm)); setSpacing(String(next.cutSpacingMm)); setApplied(next); setError(undefined); setBoardIndex(0);
  }, [initial.boardWidthMm, initial.boardHeightMm, initial.cutSpacingMm]);
  const plan = useMemo(() => simulateBoardCuts(demand.error ? [] : demand.pieces, applied.boardWidthMm, applied.boardHeightMm, applied.cutSpacingMm, true), [demand.error, demand.pieces, applied]);
  const selectedIndex = Math.min(boardIndex, Math.max(0, plan.boards.length - 1));
  const board = plan.boards[selectedIndex];
  const price = demand.material.pricePerSquareMeter;
  const purchaseCost = price == null || !Number.isFinite(price) || price < 0 || price > 1e9 || plan.error || demand.error || plan.unplaced.length ? undefined : roundBudgetAmount(plan.boardAreaM2 * price);
  const simulate = () => {
    const w = parseBudgetNumber(width, 100000, true); const h = parseBudgetNumber(height, 100000, true); const gap = parseBudgetNumber(spacing, 1000);
    if (w === undefined || h === undefined || gap === undefined) { setError('Ingresá medidas válidas en mm.'); return; }
    const next = { boardWidthMm: w, boardHeightMm: h, cutSpacingMm: gap };
    const validation = validateBoardSettings(next);
    if (validation) { setError(validation); return; }
    setError(undefined); setApplied(next); setBoardIndex(0); onSettingsChange?.(next);
  };
  return <View style={styles.card}>
    <Text style={styles.title}>{demand.material.name}</Text>
    <Text style={styles.muted}>{demand.count} piezas · {formatArea(demand.areaM2)} m² necesarios · {formatBudgetAmount(demand.material.pricePerSquareMeter ?? undefined)} / m²</Text>
    <View style={styles.fields}>
      {[{ label: 'Ancho placa (mm)', value: width, change: setWidth }, { label: 'Alto placa (mm)', value: height, change: setHeight }, { label: 'Entre cortes (mm)', value: spacing, change: setSpacing }].map((field) => <View key={field.label} style={styles.field}><Text style={styles.label}>{field.label}</Text><TextInput accessibilityLabel={field.label} style={styles.input} keyboardType="decimal-pad" value={field.value} onChangeText={field.change} /></View>)}
      <Pressable accessibilityRole="button" style={styles.button} onPress={simulate}><Text style={styles.link}>Simular cortes</Text></Pressable>
    </View>
    {(error || plan.error || demand.error) && <Text accessibilityRole="alert" style={styles.error}>{error || plan.error || demand.error}</Text>}
    <Text style={styles.muted}>Giros de 90° habilitados. La separación reserva el ancho del corte entre piezas; no agrega un margen exterior. Distribución estimada por cortes rectos, sin garantía de mínimo de placas.</Text>
    {!demand.error && !plan.error && <>
      <View style={styles.metrics}>
        <Text style={styles.metric}>{plan.boards.length} placas</Text><Text style={styles.metric}>{formatArea(plan.utilization * 100)}% aprovechado</Text><Text style={styles.metric}>{formatArea(plan.wasteAreaM2)} m² recortes + cortes</Text>
      </View>
      <Text style={styles.muted}>Compra de placas completas: {formatArea(plan.boardAreaM2)} m² · {formatBudgetAmount(purchaseCost)}. El presupuesto usa el área neta de las piezas.</Text>
      {plan.unplaced.length > 0 && <Text style={styles.error}>{plan.unplaced.length} piezas no ubicadas: {plan.unplaced.slice(0, 8).map((entry) => `${entry.piece.name}: ${entry.reason}`).join(' · ')}{plan.unplaced.length > 8 ? '…' : ''}</Text>}
      {board && <>
        <View style={styles.navigation}>
          <Pressable accessibilityRole="button" disabled={selectedIndex === 0} style={styles.button} onPress={() => setBoardIndex(selectedIndex - 1)}><Text style={styles.link}>← Anterior</Text></Pressable>
          <Text style={styles.label}>Placa {selectedIndex + 1} de {plan.boards.length}</Text>
          <Pressable accessibilityRole="button" disabled={selectedIndex === plan.boards.length - 1} style={styles.button} onPress={() => setBoardIndex(selectedIndex + 1)}><Text style={styles.link}>Siguiente →</Text></Pressable>
        </View>
        <View accessibilityLabel={`Plano de placa ${selectedIndex + 1}, ${board.widthMm} por ${board.heightMm} mm`} style={[styles.board, { aspectRatio: board.widthMm / board.heightMm }]}>
          {board.pieces.map((piece, index) => <View key={piece.id} style={[styles.piece, { left: `${piece.xMm / board.widthMm * 100}%`, top: `${piece.yMm / board.heightMm * 100}%`, width: `${piece.widthMm / board.widthMm * 100}%`, height: `${piece.heightMm / board.heightMm * 100}%`, backgroundColor: pieceColors[index % pieceColors.length] }]}><Text numberOfLines={1} style={styles.pieceLabel}>{index + 1}</Text></View>)}
        </View>
        <ScrollView style={styles.legend} nestedScrollEnabled>{board.pieces.map((piece, index) => <Text key={piece.id} style={styles.muted}>{index + 1}. {piece.moduleName ? `${piece.moduleName} · ` : ''}{piece.name} — {piece.widthMm} × {piece.heightMm} mm{piece.rotated ? ' · girada 90°' : ''}</Text>)}</ScrollView>
      </>}
    </>}
  </View>;
}

const styles = StyleSheet.create({
  card: { gap: 12, padding: 16, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, backgroundColor: COLORS.surface },
  title: { fontSize: 17, fontWeight: '700', color: COLORS.text }, muted: { fontSize: 12, color: COLORS.textMuted, lineHeight: 19 },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }, field: { flex: 1, minWidth: 110, gap: 6 }, label: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  input: { minHeight: 44, borderWidth: 1, borderColor: COLORS.borderStrong, padding: 10, borderRadius: 8, color: COLORS.text },
  button: { minHeight: 44, padding: 12, backgroundColor: COLORS.primarySoft, borderRadius: 8, justifyContent: 'center' }, link: { color: COLORS.primary, fontWeight: '600', fontSize: 13 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, metric: { padding: 8, color: COLORS.text, backgroundColor: COLORS.bgAlt, fontWeight: '600', borderRadius: 6 },
  navigation: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  board: { width: '100%', backgroundColor: '#f5ead7', borderWidth: 1, borderColor: '#b29c77', position: 'relative', overflow: 'hidden' },
  piece: { position: 'absolute', borderWidth: 1, borderColor: '#64748b', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, pieceLabel: { fontSize: 11, fontWeight: '700', color: '#1e293b' },
  legend: { maxHeight: 170 }, error: { fontSize: 12, lineHeight: 18, color: COLORS.dangerStrong },
});
