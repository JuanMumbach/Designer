import CommunityExplorer from '@/components/Editors/CommunityExplorer';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { commonStyles } from '@/constants/theme';

export default function ExplorerScreen() {
  return (
    <View style={styles.screen}>
      <CommunityExplorer />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...commonStyles.screen,
  },
});