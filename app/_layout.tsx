import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthProvider, useAuth } from '../services/AuthContext';
import { COLORS } from '../constants/theme';
import { AccessProvider, useAccess } from '../services/AccessContext';
import AppSidebar from '../components/Sidebar/AppSidebar';

function RootNavigator() {
  const { user, isLoading, isWorkspaceReady, error, retry, signOut } = useAuth();
  const access = useAccess();
  if (user && (error || access.error)) {
    return <View style={styles.loadingContainer}>
      <Text>{error ?? access.error}</Text>
      <Pressable onPress={error ? retry : access.refresh}><Text>Reintentar</Text></Pressable>
      <Pressable onPress={() => { void signOut(); }}><Text>Cerrar sesión</Text></Pressable>
    </View>;
  }

  if (isLoading || (user && (!isWorkspaceReady || access.isLoading))) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const showSidebar = !!user && isWorkspaceReady;

  return (
    <>
      <View style={styles.root}>
        {showSidebar && <AppSidebar />}
        <View style={styles.content}>
          <Stack
            screenOptions={{
              headerShown: false,
            }}
          >
            <Stack.Protected guard={!user}>
              <Stack.Screen name="login" />
            </Stack.Protected>
            <Stack.Protected guard={!!user}>
              <Stack.Screen name="index" />
              <Stack.Screen name="projectManager" />
              <Stack.Screen name="profile" />
              <Stack.Screen name="(design)" />
              <Stack.Protected guard={access.canManageResources}>
                <Stack.Screen name="(resources)" />
              </Stack.Protected>
              <Stack.Protected guard={access.canManageApplication || access.manageableWorkspaceIds.length > 0}>
                <Stack.Screen name="(workspace)" />
              </Stack.Protected>
            </Stack.Protected>
          </Stack>
        </View>
      </View>
      <StatusBar style="dark" />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AccessProvider><RootNavigator /></AccessProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: COLORS.bg,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
});