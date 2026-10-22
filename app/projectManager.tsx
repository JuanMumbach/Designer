import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAccess } from "../services/AccessContext";
import { useAuth } from "../services/AuthContext";
import { COLORS } from "../constants/theme";
import {
  BackendUser,
  fetchAllProjects,
  fetchAllUsers,
  fetchAllWorkspaces,
  fetchProjectVersion,
  fetchProjectVersions,
  Project,
  Workspace,
} from "../services/api";
import CatalogueView, { CatalogueGroup, InspectorRow } from "../components/Catalogue/CatalogueView";

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

const CARD_SIZE_KEY = "@design:projectCardSize";

const GROUP_OPTIONS = [
  { key: "lastUpdate", label: "Actualizado" },
  { key: "createdAt", label: "Creado" },
];

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const hasUsableDate = (iso?: string) => {
  if (!iso) return false;
  const date = new Date(iso);
  return !isNaN(date.getTime()) && date.getFullYear() >= 1753;
};

export default function ProjectManagerScreen() {
  const { canManageApplication } = useAccess();
  const router = useRouter();
  const { selectedWorkspaceId } = useAuth();

  const [query, setQuery] = useState("");
  const [loadError, setLoadError] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [users, setUsers] = useState<BackendUser[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [createdDate, setCreatedDate] = useState<string | null>(null);
  const [derivingDate, setDerivingDate] = useState(false);
  const [groupBy, setGroupBy] = useState<"lastUpdate" | "createdAt">("lastUpdate");
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [ws, pr, us] = await Promise.all([
        fetchAllWorkspaces(),
        fetchAllProjects(),
        canManageApplication ? fetchAllUsers().catch(() => []) : Promise.resolve([]),
      ]);
      setWorkspaces(ws);
      setProjects(pr);
      setUsers(us);
    } catch {
      setLoadError("No se pudieron cargar los proyectos. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [canManageApplication]);

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
    return filtered.filter(project => project.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort(
      (a, b) => new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime()
    );
  }, [projects, selectedWorkspaceId, query]);

  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const thumbnailAttemptedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const missing = visibleProjects
      .filter((p) => !(p.id in thumbnails))
      .filter((p) => !thumbnailAttemptedRef.current.has(p.id));
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(
      missing.map((p) =>
        fetchProjectVersion(p.id, p.lastVersion)
          .then((v) => (v.thumbnailURL ? ([p.id, v.thumbnailURL] as const) : null))
          .catch(() => null)
      )
    ).then((results) => {
      if (cancelled) return;
      setThumbnails((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (r) next[r[0]] = r[1];
        }
        return next;
      });
    });
    for (const p of missing) thumbnailAttemptedRef.current.add(p.id);
    return () => {
      cancelled = true;
    };
  }, [visibleProjects, thumbnails]);

  const projectGroups = useMemo((): CatalogueGroup[] => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const prevYear = prevMonthDate.getFullYear();
    const prevMonth = prevMonthDate.getMonth();

    const groups: { key: string; label: string; projects: Project[] }[] = [];
    const groupMap = new Map<string, { key: string; label: string; projects: Project[] }>();
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

    return groups
      .filter((g) => g.projects.length > 0)
      .map((g) => ({
        key: g.key,
        label: g.label,
        items: g.projects.map((project) => ({
          id: project.id,
          name: project.name,
          subtitle: `v${project.lastVersion}`,
          thumbnailUri: thumbnails[project.id],
        })),
      }));
  }, [visibleProjects, groupBy, thumbnails]);

  const currentWorkspaceName =
    selectedWorkspaceId === null
      ? "Personal workspace"
      : workspaceNameById[selectedWorkspaceId ?? ''] ?? "Select workspace";

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/projectManager");
    }
  };

  const openProject = (project: Project) => {
    router.push({ pathname: "/design", params: { projectId: project.id } });
  };

  const createNewProject = () => {
    router.push("/design");
  };

  const findProject = (id: string) => projects.find((p) => p.id === id);

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

  const inspector = selectedProject ? (
    <View>
      <Text style={styles.sectionTitle}>PROYECTO</Text>
      <InspectorRow label="Nombre" value={selectedProject.name} />
      <InspectorRow label="Espacio de trabajo" value={workspaceLabel(selectedProject) ?? ""} />
      <InspectorRow label="Creador" value={creatorLabel(selectedProject)} />
      <InspectorRow label="Versión" value={`v${selectedProject.lastVersion}`} />
      <InspectorRow label="Creado" value={creationDateLabel(selectedProject)} />
      <InspectorRow label="Última actualización" value={formatRelativeTime(selectedProject.lastUpdate)} />
    </View>
  ) : null;

  return (
    <CatalogueView
      title="Proyectos"
      backLabel={router.canGoBack() ? "← Volver" : "← Inicio"}
      onBack={goBack}
      headerActions={[{ label: "Nuevo Proyecto", onPress: createNewProject, primary: true }]}
      contextLabel={currentWorkspaceName}
      groups={projectGroups}
      groupOptions={GROUP_OPTIONS}
      groupKey={groupBy}
      onGroupKeyChange={(key) => setGroupBy(key as "lastUpdate" | "createdAt")}
      query={query}
      onQueryChange={setQuery}
      searchPlaceholder="Buscar proyectos por nombre"
      loading={loading}
      loadingText="Cargando proyectos..."
      error={loadError}
      onRetry={loadData}
      emptyText={query ? "No hay proyectos que coincidan con la búsqueda." : "Tu próximo diseño empieza aquí. Crea tu primer proyecto."}
      selectedId={selectedProject?.id ?? null}
      onSelect={(id) => setSelectedProject(findProject(id) ?? null)}
      onOpen={(id) => {
        const project = findProject(id);
        if (project) openProject(project);
      }}
      openLabel="Abrir"
      itemIcon="folder-outline"
      storageKey={CARD_SIZE_KEY}
      inspectorContent={inspector}
      inspectorEmptyText="Selecciona un proyecto para ver sus detalles."
      inspectorActions={selectedProject ? { primary: { label: "Abrir", onPress: () => openProject(selectedProject) } } : undefined}
    />
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textHeading,
    marginBottom: 12,
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
