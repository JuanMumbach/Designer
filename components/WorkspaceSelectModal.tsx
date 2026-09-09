import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Workspace } from '../services/api';

interface WorkspaceSelectModalProps {
  visible: boolean;
  workspaces: Workspace[];
  selectedWorkspaceId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}

export default function WorkspaceSelectModal({
  visible,
  workspaces,
  selectedWorkspaceId,
  onSelect,
  onClose,
}: WorkspaceSelectModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ScrollView contentContainerStyle={styles.cardContent}>
            <View style={styles.iconContainer}>
              <Ionicons name="business" size={32} color="#ffd33d" />
            </View>
            <Text style={styles.title}>Select your workspace</Text>
            <Text style={styles.subtitle}>
              Choose the workspace you want to work in. You can also pick your
              personal workspace to work without a shared team space.
            </Text>

            <Text style={styles.label}>Personal workspace</Text>
            <Pressable
              style={[
                styles.chip,
                styles.personalChip,
                selectedWorkspaceId === null && styles.chipActive,
              ]}
              onPress={() => onSelect(null)}
            >
              <Ionicons
                name="person-circle-outline"
                size={18}
                color={selectedWorkspaceId === null ? '#ffffff' : '#cbd5e1'}
              />
              <Text
                style={[
                  styles.chipText,
                  selectedWorkspaceId === null && styles.chipTextActive,
                ]}
              >
                Personal workspace
              </Text>
            </Pressable>

            {workspaces.length > 0 && (
              <>
                <Text style={styles.label}>Team workspaces</Text>
                <View style={styles.chipRow}>
                  {workspaces.map((ws) => {
                    const isActive = selectedWorkspaceId === ws.id;
                    return (
                      <Pressable
                        key={ws.id}
                        style={[styles.chip, isActive && styles.chipActive]}
                        onPress={() => onSelect(ws.id)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            isActive && styles.chipTextActive,
                          ]}
                        >
                          {ws.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            {workspaces.length === 0 && (
              <Text style={styles.emptyText}>
                You are not a member of any workspace yet.
              </Text>
            )}

            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonLabel}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    backgroundColor: '#1e1e2f',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2d2d44',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  cardContent: {
    padding: 24,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 211, 61, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 19,
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e2e8f0',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2d2d44',
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  personalChip: {
    marginBottom: 20,
  },
  chipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  emptyText: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 20,
    lineHeight: 19,
  },
  cancelButton: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  cancelButtonLabel: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
  },
});