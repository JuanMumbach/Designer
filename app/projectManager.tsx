import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useAuth } from "../services/AuthContext";
import {
  BackendUser,
  fetchAllProjects,
  fetchAllUsers,
  fetchAllWorkspaces,
  fetchProjectVersions,
  Project,
  Workspace,
} from "../services/api";

const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const hasUsableDate = (iso?: string) => {
  if (!iso) return false;
  const date = new Date(iso);
  return !isNaN(date.getTime()) && date.getFullYear() >= 1753;
};

export default function ProjectManagerScreen() {
  const router = useRouter();
  const { selectedWorkspaceId } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const isWide = screenWidth >= 700;

  const [projects, setProjects] = useState<Project[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [users, setUsers] = useState<BackendUser[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [createdDate, setCreatedDate] = useState<string | null>(null);
  const [derivingDate, setDerivingDate] = useState(false);
  const [groupBy, setGroupBy] = useState<"lastUpdate" | "createdAt">("lastUpdate");
  const [loading, setLoading] = useState(true);
  const lastPressRef = useRef(0);

  const loadData = useCallback(async () => {
    try {
      const [ws, pr, us] = await Promise.all([
        fetchAllWorkspaces(),
        fetchAllProjects(),
        fetchAllUsers().catch(() => []),
      ]);
      setWorkspaces(ws);
      setProjects(pr);
      setUsers(us);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    setCreatedDate(null);
    if (!selectedProject) {
      setDerivingDate(false);
      return;
    }
    if (hasUsableDate(selectedProject.createdAt)) {
      setDerivingDate(false);
      return;
    }
    let cancelled = false;
    setDerivingDate(true);
    fetchProjectVersions(selectedProject.id)
      .then((versions) => {
        if (cancelled) return;
        const sorted = [...versions].sort((a, b) => a.version - b.version);
        const first = sorted.find((v) => hasUsableDate(v.createdAt));
        setCreatedDate(first?.createdAt ?? null);
      })
      .catch(() => {
        if (!cancelled) setCreatedDate(null);
      })
      .finally(() => {
        if (!cancelled) setDerivingDate(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProject]);

  const workspaceNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const ws of workspaces) {
      map[ws.id] = ws.name;
    }
    return map;
  }, [workspaces]);

  const userNameById = useMemo(() => {
    const map: Record<string, BackendUser> = {};
    for (const user of users) {
      map[user.id] = user;
    }
    return map;
  }, [users]);

  const visibleProjects = useMemo(() => {
    const filtered = selectedWorkspaceId === null
      ? projects.filter((p) => p.workspaceId == null)
      : projects.filter((p) => p.workspaceId === selectedWorkspaceId);
    return [...filtered].sort(
      (a, b) => new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime()
    );
  }, [projects, selectedWorkspaceId]);

  interface ProjectGroup {
    key: string;
    label: string;
    projects: Project[];
  }

  const projectGroups = useMemo((): ProjectGroup[] => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const prevYear = prevMonthDate.getFullYear();
    const prevMonth = prevMonthDate.getMonth();

    const groups: ProjectGroup[] = [];
    const groupMap = new Map<string, ProjectGroup>();
    const getGroup = (key: string, label: string) => {
      let group = groupMap.get(key);
      if (!group) {
        group = { key, label, projects: [] };
        groupMap.set(key, group);
        groups.push(group);
      }
      return group;
    };

    for (const project of visibleProjects) {
      const iso = groupBy === "lastUpdate" ? project.lastUpdate : project.createdAt;
      const date = new Date(iso);
      if (!hasUsableDate(iso)) {
        getGroup("unknown", "Sin fecha").projects.push(project);
        continue;
      }
      const year = date.getFullYear();
      const month = date.getMonth();
      if (year === currentYear && month === currentMonth) {
        getGroup("currentMonth", "Este mes").projects.push(project);
      } else if (year === prevYear && month === prevMonth) {
        getGroup("prevMonth", capitalize(MONTH_NAMES[month])).projects.push(project);
      } else if (year === currentYear) {
        getGroup("currentYear", "Este año").projects.push(project);
      } else {
        getGroup(`year-${year}`, `${year}`).projects.push(project);
      }
    }

    const sortKey = (iso: string) => (hasUsableDate(iso) ? new Date(iso).getTime() : 0);
    for (const group of groups) {
      group.projects.sort(
        (a, b) =>
          sortKey(groupBy === "lastUpdate" ? b.lastUpdate : b.createdAt) -
          sortKey(groupBy === "lastUpdate" ? a.lastUpdate : a.createdAt)
      );
    }

    return groups.filter((g) => g.projects.length > 0);
  }, [visibleProjects, groupBy]);

  const currentWorkspaceName =
    selectedWorkspaceId === null
      ? "Personal workspace"
      : workspaceNameById[selectedWorkspaceId ?? ''] ?? "Select workspace";

  const openProject = (project: Project) => {
    router.push({ pathname: "/design", params: { projectId: project.id } });
  };

  const createNewProject = () => {
    router.push("/design");
  };

  const selectProject = (project: Project) => {
    const now = Date.now();
    if (now - lastPressRef.current < 300) {
      lastPressRef.current = 0;
      openProject(project);
      return;
    }
    lastPressRef.current = now;
    setSelectedProject(project);
  };

  const formatRelativeTime = (iso?: string) => {
    if (!hasUsableDate(iso)) return "";
    const date = new Date(iso as string);
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return "ahora";
    if (minutes < 60) return `hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `hace ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `hace ${days} día${days === 1 ? "" : "s"}`;
    return date.toLocaleDateString();
  };

  const formatDate = (iso?: string) => {
    if (!hasUsableDate(iso)) return "—";
    return new Date(iso as string).toLocaleDateString();
  };

  const workspaceLabel = (project: Project) =>
    project.workspaceId
      ? workspaceNameById[project.workspaceId]
      : "Personal workspace";

  const creatorLabel = (project: Project) => {
    const user = userNameById[project.creatorId];
    if (user) {
      const fullName = [user.name, user.lastname].filter(Boolean).join(" ").trim();
      if (fullName) return fullName;
      if (user.username) return user.username;
    }
    return `${project.creatorId.slice(0, 8)}…`;
  };

  const creationDateLabel = (project: Project) => {
    if (hasUsableDate(project.createdAt)) {
      return formatDate(project.createdAt);
    }
    if (derivingDate) return "…";
    return formatDate(createdDate ?? undefined);
  };

  const renderPreview = () => {
    if (!selectedProject) {
      return (
        <View style={styles.previewEmpty}>
          <Text style={styles.previewEmptyText}>
            Selecciona un proyecto para ver sus detalles.
          </Text>
        </View>
      );
    }
    return (
      <>
        <Text style={styles.sectionTitle}>PROYECTO</Text>
        <View style={styles.previewRow}>
          <Text style={styles.previewLabel}>Nombre</Text>
          <Text style={styles.previewValue}>{selectedProject.name}</Text>
        </View>
        <View style={styles.previewRow}>
          <Text style={styles.previewLabel}>Espacio de trabajo</Text>
          <Text style={styles.previewValue}>
            {workspaceLabel(selectedProject)}
          </Text>
        </View>
        <View style={styles.previewRow}>
          <Text style={styles.previewLabel}>Creador</Text>
          <Text style={styles.previewValue}>{creatorLabel(selectedProject)}</Text>
        </View>
        <View style={styles.previewRow}>
          <Text style={styles.previewLabel}>Versión</Text>
          <Text style={styles.previewValue}>
            v{selectedProject.lastVersion}
          </Text>
        </View>
        <View style={styles.previewRow}>
          <Text style={styles.previewLabel}>Creado</Text>
          <Text style={styles.previewValue}>
            {creationDateLabel(selectedProject)}
          </Text>
        </View>
        <View style={styles.previewRow}>
          <Text style={styles.previewLabel}>Última actualización</Text>
          <Text style={styles.previewValue}>
            {formatRelativeTime(selectedProject.lastUpdate)}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.openButton,
            pressed && styles.openButtonPressed,
          ]}
          onPress={() => openProject(selectedProject)}
        >
          <Text style={styles.openButtonText}>Abrir</Text>
        </Pressable>
      </>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
          onPress={() => router.replace("/")}
        >
          <Text style={styles.backButtonText}>← Inicio</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Proyectos
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.newProjectButton,
            pressed && styles.newProjectButtonPressed,
          ]}
          onPress={createNewProject}
        >
          <Text style={styles.newProjectButtonText}>Nuevo Proyecto</Text>
        </Pressable>
      </View>

      <View style={styles.statusRow}>
        <Text style={styles.statusText} numberOfLines={1}>
          {currentWorkspaceName}
        </Text>
        <View style={styles.segmented}>
          <Pressable
            style={[
              styles.segmentButton,
              groupBy === "lastUpdate" && styles.segmentButtonActive,
            ]}
            onPress={() => setGroupBy("lastUpdate")}
          >
            <Text
              style={[
                styles.segmentButtonText,
                groupBy === "lastUpdate" && styles.segmentButtonTextActive,
              ]}
            >
              Actualizado
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.segmentButton,
              groupBy === "createdAt" && styles.segmentButtonActive,
            ]}
            onPress={() => setGroupBy("createdAt")}
          >
            <Text
              style={[
                styles.segmentButtonText,
                groupBy === "createdAt" && styles.segmentButtonTextActive,
              ]}
            >
              Creado
            </Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Cargando proyectos...</Text>
        </View>
      ) : visibleProjects.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            No hay proyectos en este espacio.
          </Text>
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.listColumn}>
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.projectList}
              showsVerticalScrollIndicator={false}
            >
              {projectGroups.map((group) => (
                <View key={group.key} style={styles.groupSection}>
                  <Text style={styles.groupTitle}>
                    {group.label}
                    <Text style={styles.groupCount}>
                      {" · "}
                      {group.projects.length}
                    </Text>
                  </Text>
                  <View style={styles.pillGrid}>
                    {group.projects.map((project) => {
                      const isSelected = selectedProject?.id === project.id;
                      return (
                        <View
                          key={project.id}
                          style={[
                            styles.pill,
                            isSelected && styles.pillSelected,
                          ]}
                        >
                          <Pressable
                            style={styles.pillInfo}
                            onPress={() => selectProject(project)}
                          >
                            <Text
                              style={[
                                styles.pillName,
                                isSelected && styles.pillNameSelected,
                              ]}
                              numberOfLines={1}
                            >
                              {project.name}
                            </Text>
                          </Pressable>
                          <Pressable
                            style={({ pressed }) => [
                              styles.openChip,
                              pressed && styles.openChipPressed,
                            ]}
                            hitSlop={4}
                            onPress={() => openProject(project)}
                          >
                            <Text style={styles.openChipText}>Abrir</Text>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
          {isWide && <View style={styles.previewColumn}>{renderPreview()}</View>}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    backgroundColor: "white",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "#e5e7eb",
  },
  backButtonPressed: {
    backgroundColor: "#d1d5db",
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  newProjectButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#2563eb",
    alignItems: "center",
  },
  newProjectButtonPressed: {
    backgroundColor: "#1d4ed8",
  },
  newProjectButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  statusText: {
    flex: 1,
    fontSize: 13,
    color: "#6b7280",
  },
  segmented: {
    flexDirection: "row",
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    padding: 2,
  },
  segmentButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  segmentButtonActive: {
    backgroundColor: "#2563eb",
  },
  segmentButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
  },
  segmentButtonTextActive: {
    color: "#fff",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: "#6b7280",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyText: {
    textAlign: "center",
    color: "#6b7280",
    fontSize: 14,
    paddingVertical: 30,
  },
  content: {
    flex: 1,
    flexDirection: "row",
  },
  listColumn: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  projectList: {
    padding: 12,
    paddingBottom: 24,
  },
  groupSection: {
    marginBottom: 18,
  },
  groupTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  groupCount: {
    color: "#9ca3af",
    fontWeight: "600",
  },
  pillGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 10,
  },
  pillSelected: {
    backgroundColor: "#eff6ff",
    borderColor: "#2563eb",
  },
  pillInfo: {
    maxWidth: 260,
  },
  pillName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
  pillNameSelected: {
    color: "#2563eb",
  },
  openChip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 13,
    backgroundColor: "#e5e7eb",
  },
  openChipPressed: {
    backgroundColor: "#d1d5db",
  },
  openChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
  },
  previewColumn: {
    width: 300,
    padding: 16,
    borderLeftWidth: 1,
    borderLeftColor: "#e5e7eb",
  },
  previewEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  previewEmptyText: {
    textAlign: "center",
    color: "#6b7280",
    fontSize: 13,
    lineHeight: 19,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 12,
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  previewRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  previewValue: {
    fontSize: 14,
    color: "#111827",
  },
  openButton: {
    marginTop: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#2563eb",
    alignItems: "center",
  },
  openButtonPressed: {
    backgroundColor: "#1d4ed8",
  },
  openButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
});