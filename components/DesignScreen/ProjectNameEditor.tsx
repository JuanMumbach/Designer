import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useRef, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";
import { renameProject } from "@/services/api";
import { useCurrentProject } from "@/services/currentProject";
import { COLORS } from "@/constants/theme";

export default function ProjectNameEditor() {
  const { project, setProject, projectName, setProjectName } = useCurrentProject();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const submittedRef = useRef(false);

  const currentName = (project?.name ?? projectName).trim();
  const displayName = currentName || "Untitled";

  const startEditing = () => {
    submittedRef.current = false;
    setDraft(currentName);
    setEditing(true);
  };

  const finishEditing = () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setEditing(false);

    const trimmed = draft.trim();

    if (!project) {
      if (trimmed === projectName.trim()) return;
      setProjectName(trimmed);
      return;
    }

    if (trimmed === "" || trimmed === project.name) return;

    const current = project;
    renameProject({ id: current.id, name: trimmed })
      .then(() => {
        setProject({ ...current, name: trimmed });
      })
      .catch((err) => {
        console.error("Rename failed:", err);
        Alert.alert("Error", "Failed to rename the project.");
      });
  };

  if (editing) {
    return (
      <TextInput
        style={styles.input}
        value={draft}
        onChangeText={setDraft}
        onBlur={finishEditing}
        onSubmitEditing={finishEditing}
        blurOnSubmit={false}
        returnKeyType="done"
        autoFocus
        selectTextOnFocus
        placeholder="Project name"
        placeholderTextColor={COLORS.textFaint}
      />
    );
  }

  return (
    <Pressable
      style={styles.container}
      onPress={startEditing}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Edit project name"
    >
      <Text style={styles.text} numberOfLines={1}>
        {displayName}
      </Text>
      <Ionicons name="pencil" size={13} color={COLORS.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flexShrink: 1,
  },
  text: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
    flexShrink: 1,
    minWidth: 0,
  },
  input: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
    paddingVertical: 0,
    paddingHorizontal: 4,
    margin: 0,
    minWidth: 90,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
  },
});
