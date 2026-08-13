import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import MaterialTypeAdmin from '@/components/Editors/MaterialTypes/MaterialTypeAdmin';
import { useMaterialTypes } from '@/services/useMaterialTypes';

export default function MaterialTypesScreen() {
  const { materialTypes, usageByType, isLoading, error, refresh } = useMaterialTypes();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ffd33d" />
        <Text style={styles.loadingText}>Loading material types...</Text>
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
    <MaterialTypeAdmin
      materialTypes={materialTypes}
      usageByType={usageByType}
      onRefresh={refresh}
    />
  );
}

const styles = StyleSheet.create({
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