import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleProp, StyleSheet, Switch, Text, TextInput, View, ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Room3dProps } from '../3dView/Room3d';
import { COLORS, GLASS, RADII } from '../../../constants/theme';
import GlassSurface from './GlassSurface';
import { ManagerAction, ManagerNotice } from '../../Editors/ManagerControls';

interface RoomManagerProps {
  room3dProps: Room3dProps;
  setRoom3d: React.Dispatch<React.SetStateAction<Room3dProps>>;
  onClose: () => void;
  containerStyle?: StyleProp<ViewStyle>;
}
const dimensions = [
  { key: 'width', label: 'Ancho' },
  { key: 'depth', label: 'Profundidad' },
  { key: 'height', label: 'Altura' },
] as const;

export default function RoomManager({ room3dProps, setRoom3d, onClose, containerStyle }: RoomManagerProps) {
  const [draft, setDraft] = useState({ width: String(room3dProps.width), depth: String(room3dProps.depth), height: String(room3dProps.height) });
  useEffect(() => {
    setDraft({ width: String(room3dProps.width), depth: String(room3dProps.depth), height: String(room3dProps.height) });
  }, [room3dProps.width, room3dProps.depth, room3dProps.height]);
  const parseDimension = (value: string) => Number(value.trim().replace(',', '.'));
  const valid = dimensions.every(({ key }) => Number.isFinite(parseDimension(draft[key])) && parseDimension(draft[key]) > 0);
  const handleApply = () => {
    if (!valid) return;
    setRoom3d(previous => ({ ...previous, width: parseDimension(draft.width), depth: parseDimension(draft.depth), height: parseDimension(draft.height) }));
    onClose();
  };
  return <GlassSurface style={[styles.container, containerStyle]}>
    <View style={styles.header}>
      <View><Text style={styles.title}>Tu ambiente</Text><Text style={styles.subtitle}>Ajusta el espacio para tu diseño</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Cerrar dimensiones" onPress={onClose} hitSlop={12}><Ionicons name="close" size={22} color={GLASS.textMuted} /></Pressable>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
      <Text style={styles.label}>Dimensiones en metros</Text>
      {dimensions.map(({ key, label }) => <View key={key} style={styles.dimension}>
        <Text style={styles.dimensionLabel}>{label}</Text>
        <ManagerAction label="−" onPress={() => setDraft(previous => ({ ...previous, [key]: String(Math.max(0.1, Math.round(((parseDimension(previous[key]) || 0) - 0.5) * 10) / 10)) }))} />
        <TextInput accessibilityLabel={`${label} en metros`} style={styles.input} keyboardType="decimal-pad" value={draft[key]} onChangeText={value => setDraft(previous => ({ ...previous, [key]: value }))} selectTextOnFocus />
        <ManagerAction label="+" onPress={() => setDraft(previous => ({ ...previous, [key]: String(Math.round(((parseDimension(previous[key]) || 0) + 0.5) * 10) / 10) }))} />
      </View>)}
      {valid ? <Text style={styles.area}>{(parseDimension(draft.width) * parseDimension(draft.depth)).toLocaleString(undefined, { maximumFractionDigits: 2 })} m² de superficie</Text> : <ManagerNotice error message="Ingresa medidas mayores que cero." />}
      <Text style={styles.label}>Paredes visibles</Text>
      <View style={styles.wall}><Text style={styles.dimensionLabel}>Izquierda</Text><Switch accessibilityLabel="Mostrar pared izquierda" value={room3dProps.leftWall} onValueChange={value => setRoom3d(previous => ({ ...previous, leftWall: value }))} /></View>
      <View style={styles.wall}><Text style={styles.dimensionLabel}>Derecha</Text><Switch accessibilityLabel="Mostrar pared derecha" value={room3dProps.rightWall} onValueChange={value => setRoom3d(previous => ({ ...previous, rightWall: value }))} /></View>
      <ManagerAction label="Aplicar medidas" primary disabled={!valid} onPress={handleApply} />
    </ScrollView>
  </GlassSurface>;
}
const styles = StyleSheet.create({
  container: { width: 360, maxWidth: '100%', maxHeight: '100%', borderRadius: RADII.xl, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: GLASS.bgStrong, borderBottomWidth: 1, borderColor: GLASS.border },
  title: { fontSize: 20, fontWeight: '700', color: GLASS.text }, subtitle: { color: GLASS.textMuted, fontSize: 12, marginTop: 4 },
  body: { padding: 18, gap: 14 }, label: { color: GLASS.textMuted, fontWeight: '600', fontSize: 13 },
  dimension: { flexDirection: 'row', alignItems: 'center', gap: 8 }, dimensionLabel: { flex: 1, color: GLASS.text, fontSize: 14 },
  input: { width: 64, minHeight: 44, textAlign: 'center', borderWidth: 1, borderColor: GLASS.border, borderRadius: 10, color: GLASS.text, backgroundColor: GLASS.bgStrong },
  area: { color: COLORS.primaryPressed, backgroundColor: COLORS.primarySoft, padding: 12, borderRadius: 10, textAlign: 'center', fontWeight: '600' },
  wall: { flexDirection: 'row', alignItems: 'center', minHeight: 40 },
});
