import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { renameProject } from "@/services/api";
import { useCurrentProject } from "@/services/currentProject";
import { COLORS } from "@/constants/theme";

const MESSAGE_VISIBLE_MS = 3000;
const MESSAGE_FADE_MS = 450;

export default function ProjectNameEditor() {
  const {
    project,
    setProject,
    projectName,
    setProjectName,
    cloudSaveStatus,
    cloudSaveMessageTick,
  } = useCurrentProject();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const submittedRef = useRef(false);
  const [showTransientText, setShowTransientText] = useState(false);
  const messageOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (cloudSaveStatus === "not_saved" || cloudSaveStatus === "saving") {
      setShowTransientText(true);
      messageOpacity.stopAnimation();
      messageOpacity.setValue(1);
      return;
    }

    if (cloudSaveMessageTick === 0) {
      setShowTransientText(false);
      messageOpacity.stopAnimation();
      messageOpacity.setValue(0);
      return;
    }

    setShowTransientText(true);
    messageOpacity.stopAnimation();
    messageOpacity.setValue(1);

    const timer = setTimeout(() => {
      Animated.timing(messageOpacity, {
        toValue: 0,
        duration: MESSAGE_FADE_MS,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setShowTransientText(false);
        }
      });
    }, MESSAGE_VISIBLE_MS);

    return () => {
      clearTimeout(timer);
      messageOpacity.stopAnimation();
    };
  }, [cloudSaveStatus, cloudSaveMessageTick, messageOpacity]);

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

  const renderStatus = () => {
    if (cloudSaveStatus === "not_saved") {
      return (
        <View style={styles.statusContainer}>
          <Ionicons name="cloud-offline-outline" size={14} color={COLORS.textMuted} />
          <Text style={styles.statusText} numberOfLines={1}>
            Not saved
          </Text>
        </View>
      );
    }

    if (cloudSaveStatus === "saving") {
      return (
        <View style={styles.statusContainer}>
          <ActivityIndicator size="small" color={COLORS.textMuted} style={styles.spinner} />
          <Text style={styles.statusText} numberOfLines={1}>
            Saving...
          </Text>
        </View>
      );
    }

    if (cloudSaveStatus === "saved") {
      return (
        <View style={styles.statusContainer}>
          <Ionicons name="cloud-done-outline" size={14} color="#16a34a" />
          {showTransientText && (
            <Animated.Text
              style={[styles.statusText, styles.statusTextSaved, { opacity: messageOpacity }]}
              numberOfLines={1}
            >
              Saved in cloud
            </Animated.Text>
          )}
        </View>
      );
    }

    return (
      <View style={styles.statusContainer}>
        <View style={styles.unsavedDot} />
        {showTransientText && (
          <Animated.Text
            style={[styles.statusText, styles.statusTextUnsaved, { opacity: messageOpacity }]}
            numberOfLines={1}
          >
            Unsaved changes
          </Animated.Text>
        )}
      </View>
    );
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
    <View style={styles.wrapper}>
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
      {renderStatus()}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    flexShrink: 1,
  },
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
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexShrink: 0,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.textMuted,
  },
  statusTextSaved: {
    color: "#16a34a",
  },
  statusTextUnsaved: {
    color: "#d97706",
  },
  unsavedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#d97706",
  },
  spinner: {
    transform: [{ scale: 0.7 }],
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
