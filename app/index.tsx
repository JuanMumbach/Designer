import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../services/AuthContext';
import { useWorkspaces } from '../services/useWorkspaces';
import {
  fetchWorkspaceMembers,
  Workspace,
  WorkspaceMember,
} from '../services/api';

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
              { backgroundColor: isActive ? 'rgba(37, 99, 235, 0.25)' : `${accent}22` },
            ]}
          >
            <Ionicons name={icon} size={16} color={isActive ? '#93c5fd' : accent} />
          </View>
          <Pressable
            style={styles.openButton}
            onPress={() => handleOpen(id)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${name}`}
          >
            <Ionicons name="arrow-forward" size={14} color="#94a3b8" />
          </Pressable>
        </View>
        <View style={styles.titleRow}>
          {isActive && (
            <Ionicons name="checkmark-circle" size={14} color="#60a5fa" />
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
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerTextGroup}>
              <Text style={styles.brandTitle}>DESIGNER</Text>
              <Text style={styles.brandSubtitle}>Modular 3D Furniture Studio</Text>
            </View>
            <View style={styles.headerActions}>
              {isChanging && (
                <Pressable
                  style={styles.actionButton}
                  onPress={() => router.replace('/hub')}
                >
                  <Ionicons name="close" size={14} color="#94a3b8" />
                  <Text style={styles.cancelLabel}>Cancel</Text>
                </Pressable>
              )}
              <Pressable style={styles.actionButton} onPress={handleSignOut}>
                <Ionicons name="log-out-outline" size={16} color="#94a3b8" />
                <Text style={styles.accountLabel} numberOfLines={1}>
                  {user?.email ? user.email.split('@')[0] : 'Account'}
                </Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.divider} />
        </View>

        <Text style={styles.sectionTitle}>Select your workspace</Text>
        <Text style={styles.sectionSubtitle}>
          Click a workspace to select it, then use the arrow button — or
          double-click — to open it.
        </Text>

        {isLoading ? (
          <ActivityIndicator color="#ffd33d" style={styles.loader} />
        ) : (
          <>
            <View style={styles.grid}>
              {renderWorkspaceCard(null, 'person', '#ffd33d')}
              {myWorkspaces.map((ws) =>
                renderWorkspaceCard(ws, 'business', '#60a5fa')
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#12121e',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 24,
  },
  header: {
    marginBottom: 32,
    marginTop: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerTextGroup: {
    flex: 1,
  },
  headerActions: {
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  brandTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 6,
    textTransform: 'uppercase',
  },
  brandSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 8,
    letterSpacing: 1.5,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  cancelLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  accountLabel: {
    fontSize: 12,
    color: '#64748b',
    maxWidth: 100,
  },
  divider: {
    width: 60,
    height: 4,
    backgroundColor: '#60a5fa',
    borderRadius: 2,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 19,
    marginBottom: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    gap: 12,
  },
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    maxWidth: 200,
    minHeight: 76,
    backgroundColor: '#1c1c2e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2d2d44',
    padding: 12,
    justifyContent: 'space-between',
  },
  cardActive: {
    borderColor: '#2563eb',
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  openButton: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: '#2d2d44',
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
    color: '#e2e8f0',
  },
  cardTitleActive: {
    color: '#ffffff',
  },
  infoBlock: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
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
    color: '#64748b',
  },
  infoValue: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  loader: {
    marginVertical: 40,
  },
  emptyText: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 19,
    marginTop: 16,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#4b5563',
    letterSpacing: 0.5,
  },
});
