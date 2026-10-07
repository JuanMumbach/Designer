import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import React from "react";
import { COLORS } from "@/constants/theme";

export default function WorkspaceLayout() {
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
    </Tabs>
  );
}
