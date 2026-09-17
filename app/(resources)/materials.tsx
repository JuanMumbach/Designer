import { useMaterials } from '@/services/useMaterials';
import MaterialBrowser from '@/components/Editors/Materials/MaterialBrowser';
import { useAuth } from '@/services/AuthContext';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { COLORS, commonStyles } from '@/constants/theme';

export default function MaterialsScreen() {
  const { selectedWorkspaceId } = useAuth();
  const { materials, categories, isLoading, error, refresh } = useMaterials(selectedWorkspaceId ?? undefined);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading materials...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Error: {error.message}</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <MaterialBrowser
        materials={materials}
        categories={categories}
        onRefresh={refresh}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...commonStyles.screen,
  },
  center: {
    ...commonStyles.center,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textMuted,
    fontSize: 14,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});