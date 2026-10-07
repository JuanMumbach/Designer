import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import React from "react";
import { COLORS } from "@/constants/theme";

export default function ResourcesLayout() {
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
