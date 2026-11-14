import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import BoardCuttingSimulation from '../../components/DesignScreen/Budget/BoardCuttingSimulation';
import { COLORS } from '../../constants/theme';
import { useAccess } from '../../services/AccessContext';
import { useAuth } from '../../services/AuthContext';
import { fetchMaterialCatalog, fetchModelMaterialTypes, fetchObjectVersion, MaterialMeta, ObjectMaterialType, ObjectVersion } from '../../services/api';
import { resolveBudgetMaterial } from '../../services/budget';
import { calculatePartsBudget, collectMaterialDemand } from '../../services/materialParts';
import { useCurrentProject } from '../../services/currentProject';
import { designMaterialsConfig, normalizeTypeName } from '../../services/designMaterialDefaults';
import { resolveEffectiveModuleInventory } from '../../services/variants';

interface Catalog {
  scope: string;
  materials: MaterialMeta[];
  versions: Record<string, ObjectVersion>;
  slots: Record<string, ObjectMaterialType[]>;
}

function Action({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.action, disabled && styles.disabled]}
    >
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

export default function CutsScreen() {
  const router = typeof useRouter === 'function' ? useRouter() : undefined;
  const { project, projectName, designSnapshot, budgetSettings, setBudgetSettings, canEditBudgetObjects } = useCurrentProject();
  const { backendUserId, selectedWorkspaceId } = useAuth();
  const { canDesign } = useAccess();
  const [catalog, setCatalog] = useState<Catalog>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [revision, setRevision] = useState(0);

  const modelKeys = [...new Set(designSnapshot?.objects.map((object) => `${object.modelId}:${object.version}`) ?? [])].sort().join('|');
  const scope = `${backendUserId}:${selectedWorkspaceId}:${project?.id}:${modelKeys}:${revision}`;

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    if (!backendUserId) { setLoading(false); return () => { active = false; }; }
    (async () => {
      const materials = await fetchMaterialCatalog(selectedWorkspaceId ?? undefined, backendUserId);
      const models = await Promise.all((modelKeys ? modelKeys.split('|') : []).map(async (key) => {
        const colon = key.lastIndexOf(':');
        const id = key.slice(0, colon);
        const version = Number(key.slice(colon + 1));
        const [data, slots] = await Promise.all([fetchObjectVersion(id, version), fetchModelMaterialTypes(id, version)]);
        return { key, data, slots };
      }));
      if (active) setCatalog({ scope, materials, versions: Object.fromEntries(models.map((model) => [model.key, model.data])), slots: Object.fromEntries(models.map((model) => [model.key, model.slots])) });
    })().catch(() => { if (active) setError('No se pudieron cargar los materiales para el corte. Verificá la conexión y que la API esté actualizada.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [backendUserId, selectedWorkspaceId, modelKeys, scope]));

  const current = catalog?.scope === scope ? catalog : undefined;
  const rows = useMemo(() => (designSnapshot?.objects ?? []).map((object) => {
    const key = `${object.modelId}:${object.version}`;
    const slots = current?.slots[key] ?? [];
    const effective = resolveEffectiveModuleInventory(
      current?.versions[key],
      object,
      designSnapshot?.defaultHandleType
    );
    const entries = effective.entries;
    const parts = effective.parts;
    const result = calculatePartsBudget(parts, entries, current?.materials ?? [], (slot) => {
      const binding = slots.find((binding) => binding.slot === slot);
      const typeName = binding?.materialTypeName ?? '';
      const defaultKey = designMaterialsConfig.designMaterialSlots.find((candidate) => normalizeTypeName(candidate.type) === normalizeTypeName(typeName))?.key;
      const slotName = object.slots?.find((candidate) => candidate.slot === slot)?.displayName;
      const globals = designSnapshot?.globalMaterials ?? {};
      return resolveBudgetMaterial(slot, object.materialOverrides, globals, defaultKey && globals[defaultKey] ? defaultKey : slotName);
    });
    return { object, entries, slots, parts, result };
  }), [designSnapshot, current]);

  const demands = useMemo(() => collectMaterialDemand(rows, current?.materials ?? []), [rows, current]);
  const ready = !loading && !error && !!current && !!designSnapshot;
  const canEdit = canDesign && canEditBudgetObjects && !!designSnapshot;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <View>
            <Text style={styles.title}>Cortes de tableros</Text>
            <Text style={styles.muted}>
              {project?.name || projectName || 'Diseño actual'} · {demands.length} {demands.length === 1 ? 'material con piezas' : 'materiales con piezas'}
            </Text>
          </View>
          <View style={styles.actions}>
            {router && <Action label="Ver presupuesto" onPress={() => router.navigate('/(design)/budget')} />}
            <Action label="Actualizar" disabled={loading} onPress={() => setRevision((value) => value + 1)} />
          </View>
        </View>

        <Text style={styles.muted}>
          Simulación de distribución y corte en placas completas para los materiales configurados en el despiece. Podés ajustar el tamaño de placa y el ancho de corte por material.
        </Text>

        {!designSnapshot && (
          <View style={styles.card}>
            <Text style={styles.notice}>Abrí la pestaña Diseño para cargar el proyecto.</Text>
            {router && <Action label="Abrir diseño" onPress={() => router.navigate('/(design)/design')} />}
          </View>
        )}

        {loading && <ActivityIndicator accessibilityLabel="Cargando cortes" color={COLORS.primary} />}
        {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}

        {ready && demands.length === 0 && (
          <View style={styles.card}>
            <Text style={styles.notice}>
              No hay piezas con material asignado en este diseño. Agregá partes al despiece de los módulos en el presupuesto para simular su distribución en placas.
            </Text>
            {router && <Action label="Ir al presupuesto" onPress={() => router.navigate('/(design)/budget')} />}
          </View>
        )}

        {ready && demands.map((demand) => (
          <BoardCuttingSimulation
            key={demand.material.id}
            demand={demand}
            settings={budgetSettings.cutting?.[demand.material.id]}
            onSettingsChange={canEdit ? (settings) => setBudgetSettings({
              ...budgetSettings,
              cutting: { ...budgetSettings.cutting, [demand.material.id]: settings },
            }) : undefined}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bgAlt },
  content: { padding: 20, gap: 16, maxWidth: 1100, width: '100%', alignSelf: 'center', paddingBottom: 40 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.text },
  body: { fontSize: 14, color: COLORS.text },
  muted: { fontSize: 12, lineHeight: 18, color: COLORS.textMuted },
  notice: { color: COLORS.textMuted, paddingVertical: 12 },
  card: { padding: 16, backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, gap: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { padding: 10, minHeight: 44, borderRadius: 8, backgroundColor: COLORS.primarySoft, justifyContent: 'center' },
  actionText: { fontWeight: '600', color: COLORS.primary },
  disabled: { opacity: 0.45 },
  error: { color: COLORS.dangerStrong, fontSize: 13 },
});
