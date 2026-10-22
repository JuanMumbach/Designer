import React from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS } from '../../constants/theme';

export function ManagerDialog({ children, onClose, actions }: { children: React.ReactNode; onClose: () => void; actions?: React.ReactNode }) {
  return <Modal transparent animationType="fade" onRequestClose={onClose}>
    <KeyboardAvoidingView style={styles.scrim} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View accessibilityViewIsModal style={styles.dialog}>
        <ScrollView style={styles.dialogScroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.dialogContent}>{children}</ScrollView>
        {!!actions && <View style={styles.dialogFooter}>{actions}</View>}
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

export function ManagerSearch({ value, onChangeText, placeholder = 'Buscar…' }: {
  value: string; onChangeText: (value: string) => void; placeholder?: string;
}) {
  return <View style={styles.search}>
    <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
    <TextInput accessibilityLabel={placeholder} placeholder={placeholder} placeholderTextColor={COLORS.textMuted}
      value={value} onChangeText={onChangeText} style={styles.searchInput} autoCapitalize="none" autoCorrect={false} />
    {!!value && <Pressable accessibilityRole="button" accessibilityLabel="Limpiar búsqueda" hitSlop={10} onPress={() => onChangeText('')}>
      <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
    </Pressable>}
  </View>;
}

export function ManagerAction({ label, onPress, disabled = false, primary = false, danger = false }: {
  label: string; onPress: () => void; disabled?: boolean; primary?: boolean; danger?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.action, primary && styles.primary, danger && styles.danger, (disabled || pressed) && styles.dim]}>
    <Text style={[styles.actionText, primary && styles.primaryText, danger && styles.dangerText]}>{label}</Text>
  </Pressable>;
}

export function ManagerNotice({ message, error = false, loading = false }: { message: string; error?: boolean; loading?: boolean }) {
  return <View accessibilityLiveRegion="polite" style={[styles.notice, error && styles.danger]}>
    {loading && <ActivityIndicator color={COLORS.primary} />}
    <Text style={[styles.noticeText, error && styles.dangerText]}>{message}</Text>
  </View>;
}

export const managerStyles = StyleSheet.create({
  content: { padding: 24, gap: 18, flexGrow: 1, backgroundColor: COLORS.bgAlt },
  title: { fontSize: 26, fontWeight: '700', color: COLORS.text },
  subtitle: { fontSize: 14, lineHeight: 21, color: COLORS.textMuted },
  card: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 20, gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  name: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textHeading },
  input: { borderWidth: 1, borderColor: COLORS.borderStrong, borderRadius: 10, padding: 12, minHeight: 44, color: COLORS.text, backgroundColor: COLORS.surface },
  badge: { color: COLORS.primaryPressed, backgroundColor: COLORS.primarySoft, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 12, alignSelf: 'flex-start' },
});

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'center', alignItems: 'center', padding: 20 },
  dialog: { width: '100%', maxWidth: 600, maxHeight: '90%', borderRadius: 18, backgroundColor: COLORS.surface, overflow: 'hidden' },
  dialogScroll: { flexShrink: 1 },
  dialogContent: { padding: 24, gap: 14 },
  dialogFooter: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10, paddingHorizontal: 24, paddingVertical: 14, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.surface },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, borderRadius: 12, paddingHorizontal: 14, minHeight: 46 },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 12, color: COLORS.text, fontSize: 14 },
  action: { minHeight: 42, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 9, backgroundColor: COLORS.surfaceAlt },
  actionText: { color: COLORS.textHeading, fontWeight: '600', fontSize: 13 },
  primary: { backgroundColor: COLORS.primary }, primaryText: { color: COLORS.white },
  danger: { backgroundColor: COLORS.errorSoft }, dangerText: { color: COLORS.dangerText }, dim: { opacity: 0.5 },
  notice: { padding: 16, borderRadius: 12, backgroundColor: COLORS.primarySoft, flexDirection: 'row', alignItems: 'center', gap: 10 },
  noticeText: { flex: 1, color: COLORS.textHeading, lineHeight: 20 },
});
