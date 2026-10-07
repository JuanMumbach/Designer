import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AuthProvider, useAuth } from '../services/AuthContext';
import { COLORS } from '../constants/theme';
import AppSidebar from '../components/Sidebar/AppSidebar';

function RootNavigator() {
  const { user, isLoading, isWorkspaceReady } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const inLoginScreen = segments[0] === 'login';

    if (!user && !inLoginScreen) {
      router.replace('/login');
    } else if (user && inLoginScreen) {
      router.replace('/projectManager');
    }
  }, [user, isLoading, segments, router]);

  if (isLoading || (user && !isWorkspaceReady)) {
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
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="projectManager" />
            <Stack.Screen name="(design)" />
            <Stack.Screen name="(resources)" />
            <Stack.Screen name="(workspace)" />
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
      <RootNavigator />
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