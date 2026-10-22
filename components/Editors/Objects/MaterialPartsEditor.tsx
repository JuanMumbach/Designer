import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { generateUUID } from 'three/src/math/MathUtils.js';
import { COLORS } from '../../../constants/theme';
import { parseBudgetNumber } from '../../../services/budget';
import { formatArea, MaterialPart, validateMaterialParts } from '../../../services/materialParts';

export interface MaterialPartDraft { id: string; name: string; slot: string; width: string; height: string; quantity: string }

export function materialPartDrafts(parts: MaterialPart[]): MaterialPartDraft[] {
  return parts.map((part) => ({ id: part.id, name: part.name, slot: String(part.materialSlot), width: String(part.widthMm), height: String(part.heightMm), quantity: String(part.quantity) }));
}

export function readMaterialPartDrafts(drafts: MaterialPartDraft[]): { parts: MaterialPart[]; error?: string } {
  const parts: MaterialPart[] = [];
  for (const draft of drafts) {
    const widthMm = parseBudgetNumber(draft.width, 100000, true);
    const heightMm = parseBudgetNumber(draft.height, 100000, true);
    if (widthMm === undefined || heightMm === undefined || !/^\d+$/.test(draft.slot) || !/^\d+$/.test(draft.quantity)) return { parts: [], error: 'Completá las medidas en mm, el material y la cantidad entera de cada parte.' };
    parts.push({ id: draft.id, name: draft.name.trim(), materialSlot: Number(draft.slot), widthMm, heightMm, quantity: Number(draft.quantity), allowRotation: true });
  }
  return { parts, error: validateMaterialParts(parts) };
}

export default function MaterialPartsEditor({ drafts, onChange, slots = [], disabled = false }: { drafts: MaterialPartDraft[]; onChange: (drafts: MaterialPartDraft[]) => void; slots?: { slot: number; displayName: string }[]; disabled?: boolean }) {
  const result = readMaterialPartDrafts(drafts);
  const area = result.parts.reduce((sum, part) => sum + part.widthMm * part.heightMm * part.quantity / 1e6, 0);
  const update = (id: string, key: keyof MaterialPartDraft, value: string) => onChange(drafts.map((draft) => draft.id === id ? { ...draft, [key]: value } : draft));
  return <View style={styles.container}>
    <View style={styles.summary}><Text style={styles.title}>Despiece del módulo</Text><Text style={styles.area}>{result.error ? 'Área pendiente' : `${formatArea(area)} m²`}</Text></View>
    <Text style={styles.hint}>Agregá laterales, puertas, estantes o tapas. Medidas de corte fijas en mm: ancho × alto × cantidad ÷ 1.000.000 = m². Se permite girar todas las piezas.</Text>
    {drafts.length === 0 && <Text style={styles.empty}>Todavía no hay partes. Agregá la primera para calcular el consumo de material.</Text>}
    {drafts.map((draft, index) => <View key={draft.id} style={styles.part}>
      <View style={styles.summary}><Text style={styles.label}>Parte {index + 1}</Text><Pressable accessibilityRole="button" disabled={disabled} onPress={() => onChange(drafts.filter((part) => part.id !== draft.id))}><Text style={styles.link}>Quitar</Text></Pressable></View>
      <TextInput style={styles.input} accessibilityLabel="Nombre de la parte" editable={!disabled} value={draft.name} onChangeText={(value) => update(draft.id, 'name', value)} placeholder="Ej.: Lateral izquierdo" maxLength={200} />
      <View style={styles.row}>
        {(['width', 'height', 'quantity'] as const).map((key) => <View style={styles.field} key={key}><Text style={styles.label}>{key === 'width' ? 'Ancho (mm)' : key === 'height' ? 'Alto (mm)' : 'Cantidad'}</Text><TextInput accessibilityLabel={key === 'width' ? 'Ancho de parte en mm' : key === 'height' ? 'Alto de parte en mm' : 'Cantidad de partes'} style={styles.input} editable={!disabled} keyboardType={key === 'quantity' ? 'number-pad' : 'decimal-pad'} value={draft[key]} onChangeText={(value) => update(draft.id, key, value)} /></View>)}
      </View>
      <Text style={styles.label}>Material del modelo</Text>
      <View style={styles.row}>{slots.map((slot) => <Pressable accessibilityRole="button" key={slot.slot} disabled={disabled} style={[styles.chip, draft.slot === String(slot.slot) && styles.selected]} onPress={() => update(draft.id, 'slot', String(slot.slot))}><Text style={styles.link}>{slot.displayName || `Slot ${slot.slot}`} ({slot.slot})</Text></Pressable>)}</View>
      <TextInput style={styles.input} accessibilityLabel="Slot de material de la parte" editable={!disabled} keyboardType="number-pad" value={draft.slot} onChangeText={(value) => update(draft.id, 'slot', value)} placeholder="Número de slot de material" />
      <Text style={styles.hint}>{(() => { const parsed = readMaterialPartDrafts([draft]); return parsed.error ? 'Completá los datos para calcular el área.' : `${formatArea(parsed.parts[0].widthMm * parsed.parts[0].heightMm * parsed.parts[0].quantity / 1e6)} m² en esta parte`; })()}</Text>
      <Pressable accessibilityRole="button" disabled={disabled || drafts.length >= 200} onPress={() => onChange([...drafts, { ...draft, id: generateUUID(), name: `${draft.name} (copia)`.slice(0, 200) }])}><Text style={styles.link}>Duplicar parte</Text></Pressable>
    </View>)}
    <Pressable accessibilityRole="button" disabled={disabled || drafts.length >= 200} style={styles.add} onPress={() => onChange([...drafts, { id: generateUUID(), name: '', slot: slots[0] ? String(slots[0].slot) : '', width: '', height: '', quantity: '1' }])}><Text style={styles.link}>+ Agregar parte de material</Text></Pressable>
    {drafts.length > 0 && result.error && <Text style={styles.hint}>{result.error}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 12 }, summary: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 17, fontWeight: '700', color: COLORS.text }, area: { color: COLORS.primary, fontWeight: '700', fontSize: 18 },
  hint: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18 }, empty: { padding: 16, color: COLORS.textMuted, backgroundColor: COLORS.bgAlt, borderRadius: 8 },
  part: { padding: 12, borderColor: COLORS.border, borderWidth: 1, borderRadius: 10, gap: 10, backgroundColor: COLORS.bgAlt },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, field: { flex: 1, minWidth: 90, gap: 6 }, label: { color: COLORS.textHeading, fontSize: 12, fontWeight: '600' },
  input: { minHeight: 44, borderWidth: 1, borderColor: COLORS.borderStrong, borderRadius: 8, padding: 10, backgroundColor: COLORS.bg, color: COLORS.text },
  chip: { padding: 8, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8 }, selected: { backgroundColor: COLORS.primarySoft, borderColor: COLORS.primary },
  link: { color: COLORS.primary, fontWeight: '600', fontSize: 13 }, add: { padding: 14, borderRadius: 8, backgroundColor: COLORS.primarySoft },
});
