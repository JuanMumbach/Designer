import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import React from "react";
import { COLORS } from "@/constants/theme";
import ProjectNameEditor from "@/components/DesignScreen/ProjectNameEditor";
import { CurrentProjectProvider } from "@/services/currentProject";

export default function DesignLayout() {
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
