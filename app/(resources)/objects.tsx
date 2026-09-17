import { useObjects } from '@/services/useObjects';
import { useMaterialTypes } from '@/services/useMaterialTypes';
import ObjectBrowser from '@/components/Editors/Objects/ObjectBrowser';
import { useAuth } from '@/services/AuthContext';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { COLORS, commonStyles } from '@/constants/theme';

export default function ObjectsScreen() {
  const { selectedWorkspaceId } = useAuth();
  const { objects, categories, isLoading, error, refresh } = useObjects(selectedWorkspaceId ?? undefined);
  const { materialTypes } = useMaterialTypes();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
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