import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import RoleManager from '../../components/Editors/RoleManager';
import { COLORS } from '../../constants/theme';

export default function RolesScreen() {
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <Text style={styles.title}>Roles y permisos</Text>
    <Text style={styles.text}>Los roles de aplicación controlan la administración global. Los roles de espacio controlan diseños, recursos y miembros dentro de cada espacio.</Text>
    <RoleManager scope="AppRole" />
    <RoleManager scope="WorkspaceRole" />
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 32, backgroundColor: COLORS.bgAlt, flexGrow: 1 },
  title: { fontSize: 26, fontWeight: '700', color: COLORS.text },
  text: { color: COLORS.textMuted, lineHeight: 20 },
});
