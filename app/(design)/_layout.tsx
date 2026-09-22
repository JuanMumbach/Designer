import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs, useRouter } from "expo-router";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import React from "react";
import { COLORS, RADII } from "@/constants/theme";
import ProjectNameEditor from "@/components/DesignScreen/ProjectNameEditor";
import { CurrentProjectProvider } from "@/services/currentProject";

export default function DesignLayout() {
  const router = useRouter();

  return (
    <CurrentProjectProvider>
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
          name="design"
          options={{
            headerTitle: () => <ProjectNameEditor />,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "cube" : "cube-outline"}
                color={color}
                size={24}
              />
            ),
          }}
        />
      <Tabs.Screen
        name="budget"
        options={{
          title: "Presupuesto",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "cash" : "cash-outline"}
              color={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="measures"
        options={{
          title: "Medidas",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "resize" : "resize-outline"}
              color={color}
              size={24}
            />
          ),
        }}
      />
    </Tabs>
    </CurrentProjectProvider>
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