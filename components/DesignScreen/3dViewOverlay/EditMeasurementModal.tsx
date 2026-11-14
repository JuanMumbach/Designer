import React, { useEffect, useState } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS, GLASS, RADII } from '@/constants/theme';
import GlassSurface from './GlassSurface';

export type MeasurementSide = 'left' | 'right' | 'floor';

export interface ActiveMeasurementEdit {
  objectId: string;
  side: MeasurementSide;
  currentValue: number;
}

function parseMeasure(value: string): number {
  const cleaned = String(value).trim().replace(',', '.');
  if (!cleaned) return NaN;
  return Number(cleaned);
}

function formatMeasure(value: number): string {
  if (!Number.isFinite(value)) return '0.00';
  return (Math.round(value * 100) / 100).toFixed(2);
}

export default function EditMeasurementModal({
  activeEdit,
  onApply,
  onClose,
  containerStyle,
}: {
  activeEdit: ActiveMeasurementEdit;
  objectName?: string;
  onApply: (side: MeasurementSide, newDistance: number) => void;
  onClose: () => void;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const [draft, setDraft] = useState(formatMeasure(activeEdit.currentValue));

  useEffect(() => {
    setDraft(formatMeasure(activeEdit.currentValue));
  }, [activeEdit.objectId, activeEdit.side, activeEdit.currentValue]);

  const parsedValue = parseMeasure(draft);
  const isValid = Number.isFinite(parsedValue) && parsedValue >= 0;

  const handleConfirm = () => {
    if (!isValid) return;
    onApply(activeEdit.side, parsedValue);
  };

  return (
    <GlassSurface style={[styles.container, containerStyle]}>
      <View style={styles.row}>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            keyboardType="decimal-pad"
            selectTextOnFocus
            autoFocus
            onSubmitEditing={handleConfirm}
            accessibilityLabel="Medida en metros"
          />
          <Text style={styles.unitLabel}>m</Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.iconBtn,
            styles.applyBtn,
            !isValid && styles.btnDisabled,
            pressed && isValid && styles.applyBtnPressed,
          ]}
          onPress={handleConfirm}
          disabled={!isValid}
          accessibilityRole="button"
          accessibilityLabel="Aplicar medida"
        >
          <Ionicons name="checkmark" size={18} color={COLORS.white} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.iconBtn, styles.closeBtn, pressed && styles.closeBtnPressed]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cancelar"
        >
          <Ionicons name="close" size={18} color={GLASS.textMuted} />
        </Pressable>
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 210,
    borderRadius: RADII.lg,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: GLASS.borderStrong,
    backgroundColor: GLASS.bgStrong,
    paddingHorizontal: 10,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    minWidth: 0,
    width: '100%',
    fontSize: 15,
    fontWeight: '700',
    color: GLASS.text,
    textAlign: 'center',
    paddingVertical: 0,
  },
  unitLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: GLASS.textMuted,
    marginLeft: 4,
  },
  iconBtn: {
    width: 36,
    height: 36,
    flexShrink: 0,
    borderRadius: RADII.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtn: {
    backgroundColor: COLORS.primary,
  },
  applyBtnPressed: {
    backgroundColor: COLORS.primaryPressed,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  closeBtn: {
    backgroundColor: GLASS.bgInput,
    borderWidth: 1,
    borderColor: GLASS.border,
  },
  closeBtnPressed: {
    backgroundColor: GLASS.bgPressed,
  },
});
