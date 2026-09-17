import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import MaterialTypeAdmin from '@/components/Editors/MaterialTypes/MaterialTypeAdmin';
import { useMaterialTypes } from '@/services/useMaterialTypes';
import { COLORS, commonStyles } from '@/constants/theme';

export default function MaterialTypesScreen() {
  const { materialTypes, usageByType, isLoading, error, refresh } = useMaterialTypes();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
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