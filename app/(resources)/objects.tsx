import { useObjects } from '@/services/useObjects';
import { useMaterialTypes } from '@/services/useMaterialTypes';
import ObjectBrowser from '@/components/Editors/Objects/ObjectBrowser';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function ObjectsScreen() {
  const { objects, categories, isLoading, error, refresh } = useObjects();
  const { materialTypes } = useMaterialTypes();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading objects...</Text>
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
      <ObjectBrowser
        objects={objects}
        categories={categories}
        onRefresh={refresh}
        materialTypes={materialTypes}
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