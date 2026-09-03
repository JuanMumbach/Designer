import CommunityExplorer from '@/components/Editors/CommunityExplorer';
import React from 'react';
import { StyleSheet, View } from 'react-native';

export default function ExplorerScreen() {
  return (
    <View style={styles.screen}>
      <CommunityExplorer />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
});