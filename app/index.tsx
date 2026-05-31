import { useRouter } from "expo-router";
import React from "react";
import { useAuth } from "../services/AuthContext";
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

export default function HubScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const handleNavigate = (path: "/design" | "/materials" | "/roles") => {
    router.push(path);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerTextGroup}>
              <Text style={styles.brandTitle}>DESIGNER</Text>
              <Text style={styles.brandSubtitle}>Modular 3D Furniture Studio</Text>
            </View>
            <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
              <Ionicons name="log-out-outline" size={20} color="#64748b" />
              {user?.email ? (
                <Text style={styles.signOutLabel} numberOfLines={1}>{user.email.split('@')[0]}</Text>
              ) : null}
            </TouchableOpacity>
          </View>
          <View style={styles.divider} />
        </View>

        {/* Dashboard Grid/List */}
        <View style={styles.grid}>
          {/* Card 1: Design Area */}
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.7}
            onPress={() => handleNavigate("/design")}
          >
            <View style={[styles.iconContainer, styles.designIconBg]}>
              <Ionicons name="cube" size={28} color="#60a5fa" />
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitle}>Área de Diseño</Text>
              <Text style={styles.cardDescription}>
                Espacio de modelado 3D interactivo, cálculo de presupuestos y vistas técnicas con medidas.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#4b5563" style={styles.chevron} />
          </TouchableOpacity>

          {/* Card 2: Resources Area */}
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.7}
            onPress={() => handleNavigate("/materials")}
          >
            <View style={[styles.iconContainer, styles.resourcesIconBg]}>
              <Ionicons name="layers" size={28} color="#fbbf24" />
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitle}>Gestión de Recursos</Text>
              <Text style={styles.cardDescription}>
                Catálogos interactivos de materiales, texturas, acabados y módulos de mobiliario estándar.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#4b5563" style={styles.chevron} />
          </TouchableOpacity>

          {/* Card 3: Workspace Area */}
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.7}
            onPress={() => handleNavigate("/roles")}
          >
            <View style={[styles.iconContainer, styles.workspaceIconBg]}>
              <Ionicons name="settings" size={28} color="#34d399" />
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitle}>Ajustes de Entorno</Text>
              <Text style={styles.cardDescription}>
                Configuración de perfiles y roles de usuario, y reglas generales de ensamble o fabricación.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#4b5563" style={styles.chevron} />
          </TouchableOpacity>
        </View>

        {/* Footer/System Info */}
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
    backgroundColor: "#12121e",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 24,
    minHeight: "100%",
    justifyContent: "space-between",
  },
  header: {
    marginBottom: 40,
    marginTop: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  headerTextGroup: {
    flex: 1,
  },
  brandTitle: {
    fontSize: 36,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 6,
    textTransform: "uppercase",
  },
  brandSubtitle: {
    fontSize: 14,
    color: "#94a3b8",
    marginTop: 8,
    letterSpacing: 1.5,
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "#2d2d44",
    marginTop: 4,
  },
  signOutLabel: {
    fontSize: 12,
    color: "#64748b",
    maxWidth: 80,
  },
  divider: {
    width: 60,
    height: 4,
    backgroundColor: "#60a5fa",
    borderRadius: 2,
    marginTop: 20,
  },
  grid: {
    flex: 1,
    gap: 20,
    marginBottom: 40,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1c1c2e",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#2d2d44",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  designIconBg: {
    backgroundColor: "rgba(96, 165, 250, 0.15)",
  },
  resourcesIconBg: {
    backgroundColor: "rgba(251, 191, 36, 0.15)",
  },
  workspaceIconBg: {
    backgroundColor: "rgba(52, 211, 153, 0.15)",
  },
  cardTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 18,
  },
  chevron: {
    marginLeft: 8,
  },
  footer: {
    alignItems: "center",
    marginTop: 20,
  },
  footerText: {
    fontSize: 12,
    color: "#4b5563",
    letterSpacing: 0.5,
  },
});
