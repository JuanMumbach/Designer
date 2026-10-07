import Ionicons from "@expo/vector-icons/Ionicons";
import { usePathname, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, RADII } from "../../constants/theme";
import { useAuth } from "../../services/AuthContext";
import WorkspaceSwitcher from "./WorkspaceSwitcher";

const EXPANDED_WIDTH = 220;
const COLLAPSED_WIDTH = 64;
const NARROW_BREAKPOINT = 768;

const navItems: {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  iconActive: React.ComponentProps<typeof Ionicons>["name"];
  href: "/projectManager" | "/materials" | "/roles";
  prefixes: string[];
}[] = [
  {
    key: "projects",
    label: "Proyectos",
    icon: "folder-outline",
    iconActive: "folder",
    href: "/projectManager",
    prefixes: ["/projectManager", "/design", "/budget", "/measures"],
  },
  {
    key: "assets",
    label: "Gestión de Recursos",
    icon: "layers-outline",
    iconActive: "layers",
    href: "/materials",
    prefixes: ["/materials", "/objects", "/explorer"],
  },
  {
    key: "environment",
    label: "Ajustes de Entorno",
    icon: "settings-outline",
    iconActive: "settings",
    href: "/roles",
    prefixes: ["/roles", "/rules", "/materialTypes", "/workspaces"],
  },
];

export default function AppSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user, signOut } = useAuth();
  const [manuallyCollapsed, setManuallyCollapsed] = useState(false);

  const isNarrow = width < NARROW_BREAKPOINT;
  const collapsed = isNarrow || manuallyCollapsed;

  const isActive = (prefixes: string[]) =>
    prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const handleSignOut = () => {
    signOut();
  };

  return (
    <View
      style={[
        styles.container,
        {
          width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <View style={[styles.header, collapsed && styles.headerCollapsed]}>
        <View style={[styles.brandIcon, collapsed && styles.brandIconCollapsed]}>
          <Ionicons name="cube" size={18} color={COLORS.primary} />
        </View>
        {!collapsed && <Text style={styles.brandText}>Designer</Text>}
        {!isNarrow && (
          <Pressable
            style={({ pressed }) => [
              styles.toggleButton,
              pressed && styles.togglePressed,
            ]}
            onPress={() => setManuallyCollapsed((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={
              collapsed ? "Expandir menú lateral" : "Contraer menú lateral"
            }
          >
            <Ionicons
              name={collapsed ? "chevron-forward" : "chevron-back"}
              size={14}
              color={COLORS.textMuted}
            />
          </Pressable>
        )}
      </View>

      <WorkspaceSwitcher collapsed={collapsed} />

      <View style={styles.nav}>
        {navItems.map((item) => {
          const active = isActive(item.prefixes);
          return (
            <Pressable
              key={item.key}
              style={({ pressed }) => [
                styles.item,
                collapsed && styles.itemCollapsed,
                active && styles.itemActive,
                pressed && styles.itemPressed,
              ]}
              onPress={() => router.push(item.href)}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
            >
              <Ionicons
                name={active ? item.iconActive : item.icon}
                size={20}
                color={active ? COLORS.primary : COLORS.textMuted}
              />
              {!collapsed && (
                <Text
                  numberOfLines={1}
                  style={[styles.itemLabel, active && styles.itemLabelActive]}
                >
                  {item.label}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.signOut,
            collapsed && styles.signOutCollapsed,
            pressed && styles.signOutPressed,
          ]}
          onPress={handleSignOut}
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
        >
          <Ionicons name="log-out-outline" size={18} color={COLORS.textMuted} />
          {!collapsed && (
            <Text style={styles.signOutText} numberOfLines={1}>
              {user?.email ? user.email.split("@")[0] : "Salir"}
            </Text>
          )}
        </Pressable>
        {!collapsed && (
          <Text style={styles.versionText}>v1.0.0</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.bgAlt,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    paddingTop: 12,
    paddingBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  headerCollapsed: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 0,
    gap: 8,
  },
  brandIcon: {
    width: 32,
    height: 32,
    borderRadius: RADII.sm,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  brandIconCollapsed: {
    width: 28,
    height: 28,
  },
  brandText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textHeading,
    letterSpacing: 0.2,
  },
  toggleButton: {
    width: 24,
    height: 24,
    borderRadius: RADII.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  togglePressed: {
    backgroundColor: COLORS.surfaceAlt,
  },
  nav: {
    gap: 4,
    paddingHorizontal: 8,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: RADII.sm,
    minHeight: 40,
  },
  itemCollapsed: {
    justifyContent: "center",
    paddingHorizontal: 0,
  },
  itemActive: {
    backgroundColor: COLORS.primarySoft,
  },
  itemPressed: {
    backgroundColor: COLORS.surfaceAlt,
  },
  itemLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textMuted,
  },
  itemLabelActive: {
    color: COLORS.primary,
  },
  footer: {
    marginTop: "auto",
    paddingHorizontal: 8,
    gap: 8,
  },
  signOut: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: RADII.sm,
    minHeight: 36,
  },
  signOutCollapsed: {
    justifyContent: "center",
    paddingHorizontal: 0,
  },
  signOutPressed: {
    backgroundColor: COLORS.surfaceAlt,
  },
  signOutText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  versionText: {
    fontSize: 11,
    color: COLORS.textFaint,
    textAlign: "center",
    letterSpacing: 0.4,
  },
});
