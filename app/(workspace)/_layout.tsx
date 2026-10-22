import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import React from "react";
import { useAccess } from "../../services/AccessContext";
import { COLORS } from "@/constants/theme";

export default function WorkspaceLayout() {
  const access = useAccess();
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
      }}
    >
      <Tabs.Protected guard={access.canManageApplication}>
      <Tabs.Screen
        name="roles"
        options={{
          title: "Roles",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "people" : "people-outline"}
              color={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="rules"
        options={{
          title: "Reglas",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "construct" : "construct-outline"}
              color={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="materialTypes"
        options={{
          title: "Tipos",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "albums" : "albums-outline"}
              color={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen name="users" options={{ title: "Usuarios de App" }} />
      </Tabs.Protected>
      <Tabs.Protected guard={access.canManageApplication || access.manageableWorkspaceIds.length > 0}>
      <Tabs.Screen
        name="workspaces"
        options={{
          title: "Workspaces",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "business" : "business-outline"}
              color={color}
              size={24}
            />
          ),
        }}
      />
      </Tabs.Protected>
    </Tabs>
  );
}
