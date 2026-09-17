import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  fetchWorkspaceMembers,
  Workspace,
  WorkspaceMember,
} from '../services/api';
import { useAuth } from '../services/AuthContext';
import { useWorkspaces } from '../services/useWorkspaces';
import { COLORS, commonStyles, RADII } from '../constants/theme';

export default function WorkspaceSelectScreen() {
  const router = useRouter();
  const { change } = useLocalSearchParams<{ change?: string }>();
  const isChanging = change != null;
  const {
    user,
    signOut,
    backendUserId,
    selectedWorkspaceId,
    hasChosenWorkspace,
    selectWorkspace,
  } = useAuth();
  const { myWorkspaces, isLoading } = useWorkspaces();

  const [highlightedId, setHighlightedId] = useState<string | null | undefined>(
    undefined
  );
  const activeId =
    highlightedId !== undefined ? highlightedId : selectedWorkspaceId;

  const lastPressRef = useRef<{ id: string | null; at: number } | null>(null);
  const [membersByWorkspace, setMembersByWorkspace] = useState<
    Record<string, WorkspaceMember[]>
  >({});
  const [membersLoading, setMembersLoading] = useState(false);

  useEffect(() => {
    if (hasChosenWorkspace && !isChanging) {
      router.replace('/hub');
    }
  }, [hasChosenWorkspace, isChanging, router]);

  useEffect(() => {
    if (!activeId || membersByWorkspace[activeId]) return;
    let mounted = true;
    setMembersLoading(true);
    fetchWorkspaceMembers(activeId)
      .then((members) => {
        if (mounted) {
          setMembersByWorkspace((prev) => ({ ...prev, [activeId]: members }));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setMembersLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [activeId, membersByWorkspace]);

  const handleOpen = (id: string | null) => {
    selectWorkspace(id);
    router.replace('/hub');
  };

  const handleHighlight = (id: string | null) => {
    setHighlightedId(id);
  };

  const handleCardPress = (id: string | null) => {
    if (Platform.OS === 'web') {
      const last = lastPressRef.current;
      if (last && last.id === id && Date.now() - last.at < 300) {
        lastPressRef.current = null;
        handleOpen(id);
        return;
      }
      lastPressRef.current = { id, at: Date.now() };
    }
    handleHighlight(id);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const webNoSelect =
    Platform.OS === 'web' ? ({ userSelect: 'none' } as any) : undefined;

  const renderWorkspaceCard = (
    ws: Workspace | null,
    icon: 'person' | 'business',
    accent: string
  ) => {
    const id = ws?.id ?? null;
    const name = ws?.name ?? 'Personal workspace';
    const isPersonal = ws === null;
    const isActive = activeId === id;

    const members = id ? membersByWorkspace[id] : undefined;
    const pendingMembers = !isPersonal && membersLoading && !members;
    const myMembership = members?.find((m) => m.userId === backendUserId);
    const role = pendingMembers
      ? '…'
      : myMembership?.roleName ??
        (isPersonal || ws?.creatorId === backendUserId ? 'Owner' : 'Member');
    const owner = pendingMembers
      ? '…'
      : isPersonal || ws?.creatorId === backendUserId
      ? 'You'
      : members?.find((m) => m.userId === ws?.creatorId)?.username ?? 'Unknown';

    return (
      <Pressable
        key={id ?? 'personal'}
        style={[styles.card, isActive && styles.cardActive, webNoSelect]}
        onPress={() => handleCardPress(id)}
      >
        <View style={styles.cardTop}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: isActive ? COLORS.primarySoft : `${accent}22` },
            ]}
          >
            <Ionicons
              name={icon}
              size={16}
              color={isActive ? COLORS.primary : accent}
            />
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.openButton,
              pressed && styles.openButtonPressed,
            ]}
            onPress={() => handleOpen(id)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${name}`}
          >
            <Ionicons name="arrow-forward" size={14} color={COLORS.textMuted} />
          </Pressable>
        </View>
        <View style={styles.titleRow}>
          {isActive && (
            <Ionicons name="checkmark-circle" size={14} color={COLORS.primary} />
          )}
          <Text
            style={[styles.cardTitle, isActive && styles.cardTitleActive]}
            numberOfLines={1}
          >
            {name}
          </Text>
        </View>
        {isActive && (
          <View style={styles.infoBlock}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Type</Text>
              <Text style={styles.infoValue}>
                {isPersonal ? 'Personal' : 'Team'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Role</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {role}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Owner</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {owner}
              </Text>
            </View>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={commonStyles.header}>
        {isChanging ? (
          <Pressable
            style={({ pressed }) => [
              commonStyles.backButton,
              pressed && commonStyles.backButtonPressed,
            ]}
            onPress={() => router.replace('/hub')}
          >
            <Text style={commonStyles.backButtonText}>← Hub</Text>
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
        <Text style={commonStyles.headerTitle} numberOfLines={1}>
          Workspaces
        </Text>
        <Pressable
          style={({ pressed }) => [
            commonStyles.secondaryButton,
            pressed && commonStyles.secondaryButtonPressed,
          ]}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out-outline" size={14} color={COLORS.textMuted} />
          <Text style={styles.signOutText} numberOfLines={1}>
            {user?.email ? user.email.split('@')[0] : 'Account'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.intro}>
        <Text style={commonStyles.sectionTitle}>Select your workspace</Text>
        <Text style={styles.subtitle}>
          Click a workspace to select it, then use the arrow button — or
          double-click — to open it.
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={COLORS.primary} style={styles.loader} />
      ) : (
        <>
          <View style={styles.grid}>
            {renderWorkspaceCard(null, 'person', COLORS.gold)}
            {myWorkspaces.map((ws) =>
              renderWorkspaceCard(ws, 'business', COLORS.primary)
            )}
          </View>
          {myWorkspaces.length === 0 && (
            <Text style={styles.emptyText}>
              You are not a member of any team workspace yet.
            </Text>
          )}
        </>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>v1.0.0 • Expo Router Modular v2</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  headerSpacer: {
    width: 74,
  },
  signOutText: {
    fontSize: 12,
    color: COLORS.textMuted,
    maxWidth: 100,
  },
  intro: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 19,
    marginBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
  },
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    maxWidth: 200,
    minHeight: 76,
    backgroundColor: COLORS.surface,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    justifyContent: 'space-between',
  },
  cardActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: RADII.sm,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  openButton: {
    width: 24,
    height: 24,
    borderRadius: RADII.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bgAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  openButtonPressed: {
    backgroundColor: COLORS.surfaceAlt,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  cardTitle: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textHeading,
  },
  cardTitleActive: {
    color: COLORS.text,
  },
  infoBlock: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  infoLabel: {
    fontSize: 11,
    color: COLORS.textFaint,
  },
  infoValue: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textHeading,
  },
  loader: {
    marginVertical: 40,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 19,
    marginTop: 16,
    paddingHorizontal: 16,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: COLORS.textFaint,
    letterSpacing: 0.5,
  },
});