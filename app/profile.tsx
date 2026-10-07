import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Thumbnail from '../components/Thumbnail';
import { COLORS, commonStyles, RADII } from '../constants/theme';
import { BackendUser, fetchUser, updateUser } from '../services/api';
import { useAuth } from '../services/AuthContext';
import { uploadFileToFirebase } from '../services/firebaseSetup';
import { pickImage } from '../services/imagePicker';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, backendUserId } = useAuth();
  const [profile, setProfile] = useState<BackendUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!backendUserId) return;
    setLoading(true);
    try {
      setProfile(await fetchUser(backendUserId));
    } catch {
      Alert.alert('Error', 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  }, [backendUserId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleChangePicture = async () => {
    const uri = await pickImage();
    if (!uri) return;
    setUploading(true);
    try {
      const fileURL = await uploadFileToFirebase(
        uri,
        'profile-pictures',
        `profile_${Date.now()}.jpeg`
      );
      await updateUser(backendUserId as string, {
        profilePictureURL: fileURL,
      });
      await loadProfile();
    } catch {
      Alert.alert('Error', 'Failed to update profile picture.');
    } finally {
      setUploading(false);
    }
  };

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/projectManager');
    }
  };

  const fullName = [profile?.name, profile?.lastname]
    .filter(Boolean)
    .join(' ')
    .trim();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading profile…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Text style={styles.backButtonText}>← Volver</Text>
        </Pressable>
        <Text style={commonStyles.headerTitle}>Perfil</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.avatarSection}>
          <Thumbnail
            uri={profile?.profilePictureURL}
            size={120}
            icon="person"
            radius={RADII.full}
          />
          <Text style={styles.name}>{fullName || profile?.username || 'Usuario'}</Text>
          <Text style={styles.email}>{user?.email ?? ''}</Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.photoButton,
            pressed && styles.photoButtonPressed,
            uploading && styles.photoButtonDisabled,
          ]}
          onPress={handleChangePicture}
          disabled={uploading || !backendUserId}
          accessibilityRole="button"
          accessibilityLabel="Cambiar foto de perfil"
        >
          <Text style={styles.photoButtonText}>
            {uploading ? 'Subiendo…' : 'Cambiar foto'}
          </Text>
        </Pressable>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Usuario</Text>
            <Text style={styles.infoValue}>{profile?.username ?? '—'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{profile?.emailAddress ?? '—'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>ID</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {profile?.id ?? '—'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    ...commonStyles.screen,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textMuted,
    fontSize: 14,
  },
  headerRow: commonStyles.header,
  backButton: commonStyles.backButton,
  backButtonPressed: commonStyles.backButtonPressed,
  backButtonText: commonStyles.backButtonText,
  scroll: {
    padding: 24,
    alignItems: 'center',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 12,
  },
  email: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  photoButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: RADII.md,
    backgroundColor: COLORS.primary,
    marginBottom: 24,
  },
  photoButtonPressed: {
    backgroundColor: COLORS.primaryPressed,
  },
  photoButtonDisabled: {
    opacity: 0.6,
  },
  photoButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  infoCard: {
    alignSelf: 'stretch',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.md,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 16,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textHeading,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textBody,
    textAlign: 'right',
  },
});