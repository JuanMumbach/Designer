import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs, useRouter } from "expo-router";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import React from "react";
import { COLORS, RADII } from "@/constants/theme";

export default function ResourcesLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textFaint,
        headerStyle: {
          backgroundColor: COLORS.bgAlt,
        },
        headerShadowVisible: false,
        headerTintColor: COLORS.text,
        tabBarStyle: {
          backgroundColor: COLORS.bg,
          borderTopColor: COLORS.border,
        },
        headerLeft: () => (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace("/hub")}
          >
            <Ionicons name="home-outline" size={16} color={COLORS.primary} />
            <Text style={styles.backText}>Hub</Text>
          </TouchableOpacity>
        ),
      }}
    >
      <Tabs.Screen
        name="materials"
        options={{
          title: "Materiales",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "layers" : "layers-outline"}
              color={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="objects"
        options={{
          title: "Módulos",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "grid" : "grid-outline"}
              color={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="explorer"
        options={{
          title: "Comunidad",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "globe" : "globe-outline"}
              color={color}
              size={24}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: RADII.sm,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backText: {
    color: COLORS.textHeading,
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },
});