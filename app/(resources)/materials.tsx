import { useMaterials } from '@/services/useMaterials';
import MaterialBrowser from '@/components/Editors/Materials/MaterialBrowser';
import { useAuth } from '@/services/AuthContext';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function MaterialsScreen() {
  const { selectedWorkspaceId } = useAuth();
  const { materials, categories, isLoading, error, refresh } = useMaterials(selectedWorkspaceId ?? undefined);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
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
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  loadingText: {
    marginTop: 12,
    color: '#94a3b8',
    fontSize: 14,
  },
  errorText: {
    color: '#f87171',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
