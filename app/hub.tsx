import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import React from "react";
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  Pressable,
  View,
} from "react-native";
import { COLORS, commonStyles, RADII } from "../constants/theme";
import { useAuth } from "../services/AuthContext";
import { useWorkspaces } from "../services/useWorkspaces";

export default function HubScreen() {
  const router = useRouter();
  const { user, signOut, selectedWorkspaceId } = useAuth();
  const { workspaces } = useWorkspaces();

  const currentWorkspaceName =
    selectedWorkspaceId === null
      ? "Personal workspace"
      : workspaces.find((ws) => ws.id === selectedWorkspaceId)?.name ??
        "Select workspace";

  const handleNavigate = (
    path: "/projectManager" | "/materials" | "/roles"
  ) => {
    router.push(path);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const navItems: {
    path: "/projectManager" | "/materials" | "/roles";
    icon: React.ComponentProps<typeof Ionicons>["name"];
    accent: string;
    tint: string;
    title: string;
    description: string;
  }[] = [
    {
      path: "/projectManager",
      icon: "cube",
      accent: COLORS.primary,
      tint: COLORS.primarySoft,
      title: "Área de Diseño",
      description:
        "Espacio de modelado 3D interactivo, cálculo de presupuestos y vistas técnicas con medidas.",
    },
    {
      path: "/materials",
      icon: "layers",
      accent: COLORS.gold,
      tint: COLORS.goldSoft,
      title: "Gestión de Recursos",
      description:
        "Catálogos interactivos de materiales, texturas, acabados y módulos de mobiliario estándar.",
    },
    {
      path: "/roles",
      icon: "settings",
      accent: COLORS.green,
      tint: COLORS.greenSoft,
      title: "Ajustes de Entorno",
      description:
        "Configuración de perfiles y roles de usuario, y reglas generales de ensamble o fabricación.",
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={commonStyles.header}>
        <Pressable
          style={({ pressed }) => [
            commonStyles.backButton,
            pressed && commonStyles.backButtonPressed,
          ]}
          onPress={() => router.replace("/?change=1")}
        >
          <Text style={commonStyles.backButtonText}>← Workspaces</Text>
        </Pressable>
        <Text style={commonStyles.headerTitle} numberOfLines={1}>
          Hub
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
            {user?.email ? user.email.split("@")[0] : "Salir"}
          </Text>
        </Pressable>
      </View>

      <View style={commonStyles.statusRow}>
        <Pressable
          style={styles.workspaceChip}
          onPress={() => router.push("/?change=1")}
        >
          <Ionicons
            name={selectedWorkspaceId === null ? "person" : "business"}
            size={15}
            color={COLORS.primary}
          />
          <Text style={styles.workspaceChipText} numberOfLines={1}>
            {currentWorkspaceName}
          </Text>
          <Ionicons name="chevron-down" size={13} color={COLORS.textFaint} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            commonStyles.secondaryButton,
            pressed && commonStyles.secondaryButtonPressed,
          ]}
          onPress={() => router.push("/?change=1")}
        >
          <Text style={commonStyles.secondaryButtonText}>Cambiar</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {navItems.map((item) => (
          <Pressable
            key={item.path}
            style={({ pressed }) => [
              styles.navCard,
              pressed && styles.navCardPressed,
            ]}
            onPress={() => handleNavigate(item.path)}
          >
            <View style={[styles.navIcon, { backgroundColor: item.tint }]}>
              <Ionicons name={item.icon} size={22} color={item.accent} />
            </View>
            <View style={styles.navText}>
              <Text style={styles.navTitle}>{item.title}</Text>
              <Text style={styles.navDescription}>{item.description}</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={COLORS.textFaint}
            />
          </Pressable>
        ))}
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
    backgroundColor: COLORS.bg,
  },
  signOutText: {
    fontSize: 12,
    color: COLORS.textMuted,
    maxWidth: 80,
  },
  workspaceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    maxWidth: "100%",
    flexShrink: 1,
  },
  workspaceChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textHeading,
    flexShrink: 1,
    maxWidth: 220,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  navCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: RADII.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  navCardPressed: {
    backgroundColor: COLORS.bgAlt,
  },
  navIcon: {
    width: 44,
    height: 44,
    borderRadius: RADII.md,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  navText: {
    flex: 1,
    marginRight: 8,
  },
  navTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textBody,
    marginBottom: 4,
  },
  navDescription: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 17,
  },
  footer: {
    alignItems: "center",
    marginTop: 20,
  },
  footerText: {
    fontSize: 12,
    color: COLORS.textFaint,
    letterSpacing: 0.5,
  },
});