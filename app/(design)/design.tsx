import { useLocalSearchParams } from "expo-router";
import DesignScreen from "@/components/DesignScreen";
import React from "react";

export default function Index() {
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();

  return (
    <>
      <DesignScreen
        projectId={typeof projectId === "string" ? projectId : undefined}
      />
    </>
  );
}
