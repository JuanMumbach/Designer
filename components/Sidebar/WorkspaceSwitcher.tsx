import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { COLORS, RADII } from "../../constants/theme";
import { useAuth } from "../../services/AuthContext";
import { useWorkspaces } from "../../services/useWorkspaces";

const PERSONAL_LABEL = "Espacio personal";

export default function WorkspaceSwitcher({ collapsed }: { collapsed: boolean }) {
  const { selectedWorkspaceId, selectWorkspace } = useAuth();
  const { myWorkspaces, isLoading, error } = useWorkspaces();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{
    x: number;
    y: number;
    height: number;
  } | null>(null);
  const triggerRef = useRef<View>(null);

  const currentName = useMemo(() => {
    if (selectedWorkspaceId === null) return PERSONAL_LABEL;
    return (
      myWorkspaces.find((ws) => ws.id === selectedWorkspaceId)?.name ??
      PERSONAL_LABEL
    );
  }, [selectedWorkspaceId, myWorkspaces]);

  useEffect(() => {
    if (isLoading || error || selectedWorkspaceId === null) return;
    if (!myWorkspaces.some((ws) => ws.id === selectedWorkspaceId)) {
      selectWorkspace(null);
    }
  }, [isLoading, error, myWorkspaces, selectedWorkspaceId, selectWorkspace]);

  const handleToggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    triggerRef.current?.measureInWindow((x, y, _width, height) => {
      setAnchor({ x, y, height });
      setOpen(true);
    });
  };

  const handleSelect = (id: string | null) => {
    selectWorkspace(id);
    setOpen(false);
  };

  const rows: { id: string | null; name: string }[] = [
    { id: null, name: PERSONAL_LABEL },
    ...myWorkspaces.map((ws) => ({ id: ws.id as string | null, name: ws.name })),
  ];

  return (
    <View style={styles.wrapper}>
      <Pressable
        ref={triggerRef}
        style={({ pressed }) => [
          styles.trigger,
          collapsed && styles.triggerCollapsed,
          pressed && styles.triggerPressed,
        ]}
        onPress={handleToggle}
        accessibilityRole="button"
        accessibilityLabel={`Workspace actual: ${currentName}. Cambiar workspace`}
      >
        <Ionicons
          name={selectedWorkspaceId === null ? "person" : "business"}
          size={16}
          color={COLORS.primary}
        />
        {!collapsed && (
          <>
            <Text style={styles.triggerText} numberOfLines={1}>
              {currentName}
            </Text>
            <Ionicons
              name={open ? "chevron-up" : "chevron-down"}
              size={13}
              color={COLORS.textFaint}
            />
          </>
        )}
      </Pressable>

      {open && anchor && (
        <Modal
          transparent
          visible
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setOpen(false)}
        >
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
            <Pressable
              style={[
                styles.panel,
                {
                  top: anchor.y + anchor.height + 6,
                  left: anchor.x,
                  width: collapsed ? 236 : 204,
                },
              ]}
              onPress={() => {}}
            >
              <Text style={styles.panelTitle}>Workspaces</Text>
              <ScrollView style={styles.list} bounces={false}>
                {isLoading ? (
                  <ActivityIndicator
                    color={COLORS.primary}
                    style={styles.loader}
                  />
                ) : (
                  rows.map((row) => {
                    const isActive = row.id === selectedWorkspaceId;
                    return (
                      <Pressable
                        key={row.id ?? "personal"}
                        style={({ pressed }) => [
                          styles.row,
                          isActive && styles.rowActive,
                          pressed && styles.rowPressed,
                        ]}
                        onPress={() => handleSelect(row.id)}
                      >
                        <Ionicons
                          name={row.id === null ? "person" : "business"}
                          size={14}
                          color={isActive ? COLORS.primary : COLORS.textMuted}
                        />
                        <Text
                          style={[styles.rowText, isActive && styles.rowTextActive]}
                          numberOfLines={1}
                        >
                          {row.name}
                        </Text>
                        {isActive && (
                          <Ionicons
                            name="checkmark"
                            size={14}
                            color={COLORS.primary}
                          />
                        )}
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    paddingHorizontal: 8,
    marginBottom: 10,
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: RADII.sm,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 36,
  },
  triggerCollapsed: {
    justifyContent: "center",
    paddingHorizontal: 0,
  },
  triggerPressed: {
    backgroundColor: COLORS.surfaceAlt,
  },
  triggerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textHeading,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.15)",
  },
  panel: {
    position: "absolute",
    backgroundColor: COLORS.surface,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
    maxHeight: 280,
  },
  panelTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textFaint,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    paddingHorizontal: 6,
    marginBottom: 6,
  },
  list: {
    flexGrow: 0,
  },
  loader: {
    marginVertical: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: RADII.sm,
  },
  rowActive: {
    backgroundColor: COLORS.primarySoft,
  },
  rowPressed: {
    backgroundColor: COLORS.surfaceAlt,
  },
  rowText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textBody,
  },
  rowTextActive: {
    color: COLORS.primary,
    fontWeight: "600",
  },
});
