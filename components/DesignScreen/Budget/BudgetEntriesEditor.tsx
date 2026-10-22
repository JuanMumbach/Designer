import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { generateUUID } from 'three/src/math/MathUtils.js';
import { COLORS } from '../../../constants/theme';
import { ModelBudgetEntry, parseBudgetNumber, validateBudgetEntries } from '../../../services/budget';

export interface BudgetEntryDraft {
  id: string;
  name: string;
  amount: string;
  slot: string;
}

export function budgetEntryDrafts(entries: ModelBudgetEntry[]): BudgetEntryDraft[] {
  return entries.map((entry) => ({ id: entry.id, name: entry.name, amount: String(entry.basePrice), slot: entry.materialSlot == null ? '' : String(entry.materialSlot) }));
}

export function readBudgetEntryDrafts(drafts: BudgetEntryDraft[], factors = false): { entries: ModelBudgetEntry[]; error?: string } {
  const entries: ModelBudgetEntry[] = [];
  for (const draft of drafts) {
    const basePrice = parseBudgetNumber(draft.amount, factors ? 1e6 : 1e9, factors);
    const slot = draft.slot.trim();
    if (basePrice === undefined) return { entries: [], error: factors ? 'Ingresá un factor mayor que 0 y hasta 1.000.000.' : 'Ingresá un importe válido entre 0 y 1.000.000.000.' };
    if (slot && !/^\d+$/.test(slot)) return { entries: [], error: 'El slot debe ser un número entero.' };
    entries.push({ id: draft.id, name: draft.name.trim(), basePrice, materialSlot: slot ? Number(slot) : null });
  }
  return { entries, error: validateBudgetEntries(entries) };
}

export default function BudgetEntriesEditor({ drafts, onChange, disabled, slots, fixed = false, factors = false }: {
  drafts: BudgetEntryDraft[];
  onChange: (drafts: BudgetEntryDraft[]) => void;
  disabled?: boolean;
  slots?: { slot: number; displayName: string }[];
  fixed?: boolean;
  factors?: boolean;
}) {
  const update = (id: string, field: keyof BudgetEntryDraft, value: string) => onChange(drafts.map((draft) => draft.id === id ? { ...draft, [field]: value } : draft));
  return (
    <View style={styles.container}>
      {!fixed && <Text style={styles.hint}>Vinculá un slot de material para aplicar su multiplicador. Dejalo vacío para un costo fijo.</Text>}
      {slots && slots.length > 0 && !fixed && <Text style={styles.hint}>{slots.map((slot) => `${slot.slot}: ${slot.displayName}`).join(' · ')}</Text>}
      {drafts.map((draft) => (
        <View key={draft.id} style={styles.row}>
          <TextInput accessibilityLabel="Nombre del concepto" editable={!disabled} maxLength={200} style={[styles.input, styles.name]} value={draft.name} placeholder="Concepto" placeholderTextColor={COLORS.textMuted} onChangeText={(value) => update(draft.id, 'name', value)} />
          <TextInput accessibilityLabel={factors ? 'Factor' : 'Importe base'} editable={!disabled} style={[styles.input, styles.amount]} value={draft.amount} keyboardType="decimal-pad" placeholder={factors ? 'Factor (1,10)' : 'Importe base'} placeholderTextColor={COLORS.textMuted} onChangeText={(value) => update(draft.id, 'amount', value)} />
          {!fixed && <TextInput accessibilityLabel="Slot de material opcional" editable={!disabled} style={[styles.input, styles.slot]} value={draft.slot} keyboardType="number-pad" placeholder="Slot o fijo" placeholderTextColor={COLORS.textMuted} onChangeText={(value) => update(draft.id, 'slot', value)} />}
          <Pressable accessibilityRole="button" accessibilityLabel={`Quitar ${draft.name || 'concepto'}`} disabled={disabled} style={styles.action} onPress={() => onChange(drafts.filter((entry) => entry.id !== draft.id))}><Text style={styles.actionText}>Quitar</Text></Pressable>
        </View>
      ))}
      <Pressable accessibilityRole="button" disabled={disabled || drafts.length >= 100} style={styles.action} onPress={() => onChange([...drafts, { id: generateUUID(), name: '', amount: factors ? '1' : '', slot: '' }])}><Text style={styles.actionText}>+ Agregar concepto</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 10, color: COLORS.text, backgroundColor: COLORS.bg, minHeight: 44 },
  name: { flex: 2, minWidth: 140 },
  amount: { flex: 1, minWidth: 110 },
  slot: { width: 110 },
  action: { padding: 10, minHeight: 44, alignSelf: 'flex-start' },
  actionText: { color: COLORS.primary, fontWeight: '600' },
  hint: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18 },
});
