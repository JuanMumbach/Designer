import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import BudgetEntriesEditor, { budgetEntryDrafts, readBudgetEntryDrafts } from '../../components/DesignScreen/Budget/BudgetEntriesEditor';
import BoardCuttingSimulation from '../../components/DesignScreen/Budget/BoardCuttingSimulation';
import MaterialPartsEditor, { materialPartDrafts, readMaterialPartDrafts } from '../../components/Editors/Objects/MaterialPartsEditor';
import { COLORS } from '../../constants/theme';
import { useAccess } from '../../services/AccessContext';
import { useAuth } from '../../services/AuthContext';
import { fetchMaterialCatalog, fetchModelMaterialTypes, fetchObjectVersion, MaterialMeta, ObjectMaterialType, ObjectVersion } from '../../services/api';
import { calculateDesignBudget, formatBudgetAmount, ModelBudgetEntry, resolveBudgetMaterial } from '../../services/budget';
import { calculatePartsBudget, collectMaterialDemand, formatArea, MaterialPart } from '../../services/materialParts';
import { useCurrentProject } from '../../services/currentProject';
import { designMaterialsConfig, normalizeTypeName } from '../../services/designMaterialDefaults';

interface Catalog {
  scope: string;
  materials: MaterialMeta[];
  versions: Record<string, ObjectVersion>;
  slots: Record<string, ObjectMaterialType[]>;
}

interface BudgetEdit {
  key: string;
  title: string;
  entries: ModelBudgetEntry[];
  slots?: { slot: number; displayName: string }[];
  fixed?: boolean;
  factors?: boolean;
  onSave: (entries: ModelBudgetEntry[]) => void;
}

interface PartsEdit { id: string; name: string; parts: MaterialPart[]; slots: { slot: number; displayName: string }[] }

function PartsDialog({ edit, onSave, onClose }: { edit: PartsEdit; onSave: (parts: MaterialPart[]) => void; onClose: () => void }) {
  const [drafts, setDrafts] = useState(() => materialPartDrafts(edit.parts));
  const [error, setError] = useState<string>();
  return <Modal transparent animationType="fade" onRequestClose={onClose}><View style={styles.scrim}><View style={styles.dialog}>
    <Text style={styles.title}>Despiece · {edit.name}</Text>
    <ScrollView contentContainerStyle={styles.dialogContent} keyboardShouldPersistTaps="handled"><MaterialPartsEditor drafts={drafts} onChange={setDrafts} slots={edit.slots} />{error && <Text style={styles.error}>{error}</Text>}</ScrollView>
    <View style={styles.actions}><Action label="Cancelar" onPress={onClose} /><Action label="Guardar" onPress={() => { const result = readMaterialPartDrafts(drafts); if (result.error) { setError(result.error); return; } onSave(result.parts); onClose(); }} /></View>
  </View></View></Modal>;
}

function Action({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.action, disabled && styles.disabled]}><Text style={styles.actionText}>{label}</Text></Pressable>;
}

function EditDialog({ edit, onClose }: { edit: BudgetEdit; onClose: () => void }) {
  const [drafts, setDrafts] = useState(() => budgetEntryDrafts(edit.entries));
  const [error, setError] = useState<string>();
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}><View style={styles.dialog}>
        <Text style={styles.title}>{edit.title}</Text>
        <ScrollView contentContainerStyle={styles.dialogContent} keyboardShouldPersistTaps="handled">
          <BudgetEntriesEditor drafts={drafts} onChange={setDrafts} slots={edit.slots} fixed={edit.fixed} factors={edit.factors} />
          {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        </ScrollView>
        <View style={styles.actions}>
          <Action label="Cancelar" onPress={onClose} />
          <Action label="Guardar" onPress={() => {
            const result = readBudgetEntryDrafts(drafts, edit.factors);
            if (result.error) { setError(result.error); return; }
            edit.onSave(result.entries);
            onClose();
          }} />
        </View>
      </View></View>
    </Modal>
  );
}

export default function BudgetScreen() {
  const { project, designSnapshot, budgetSettings, setBudgetSettings, updateBudgetEntries, canEditBudgetObjects, updateMaterialParts } = useCurrentProject();
  const { backendUserId, selectedWorkspaceId } = useAuth();
  const { canDesign } = useAccess();
  const [catalog, setCatalog] = useState<Catalog>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [revision, setRevision] = useState(0);
  const [edit, setEdit] = useState<BudgetEdit>();
  const [partsEdit, setPartsEdit] = useState<PartsEdit>();
  const modelKeys = [...new Set(designSnapshot?.objects.map((object) => `${object.modelId}:${object.version}`) ?? [])].sort().join('|');
  const scope = `${backendUserId}:${selectedWorkspaceId}:${project?.id}:${modelKeys}:${revision}`;

  useFocusEffect(useCallback(() => {
    let active = true;
    setEdit(undefined);
    setPartsEdit(undefined);
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
    })().catch(() => { if (active) setError('No se pudieron cargar los precios. Verificá la conexión y que la API esté actualizada.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [backendUserId, selectedWorkspaceId, modelKeys, scope]));

  const current = catalog?.scope === scope ? catalog : undefined;
  const rows = useMemo(() => (designSnapshot?.objects ?? []).map((object) => {
    const key = `${object.modelId}:${object.version}`;
    const slots = current?.slots[key] ?? [];
    const entries = object.budgetEntries ?? current?.versions[key]?.budgetEntries;
    const parts = object.materialParts ?? current?.versions[key]?.materialParts ?? [];
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
  const summary = calculateDesignBudget(rows.map((row) => row.result), budgetSettings);
  const ready = !loading && !error && !!current && !!designSnapshot;
  const canEdit = canDesign && canEditBudgetObjects && !!designSnapshot;

  const editExtras = () => setEdit({
    key: 'extras', title: 'Costos adicionales', fixed: true,
    entries: budgetSettings.extras.map((extra) => ({ id: extra.id, name: extra.name, basePrice: extra.amount })),
    onSave: (entries) => setBudgetSettings({ ...budgetSettings, extras: entries.map((entry) => ({ id: entry.id, name: entry.name, amount: entry.basePrice })) }),
  });
  const editMultipliers = () => setEdit({
    key: 'multipliers', title: 'Multiplicadores del proyecto', fixed: true, factors: true,
    entries: budgetSettings.multipliers.map((factor) => ({ id: factor.id, name: factor.name, basePrice: factor.factor })),
    onSave: (entries) => setBudgetSettings({ ...budgetSettings, multipliers: entries.map((entry) => ({ id: entry.id, name: entry.name, factor: entry.basePrice })) }),
  });

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <View><Text style={styles.title}>Presupuesto</Text><Text style={styles.muted}>{project?.name ?? 'Diseño actual'} · {rows.length} módulos</Text></View>
          <Action label="Actualizar precios" disabled={loading} onPress={() => setRevision((value) => value + 1)} />
        </View>
        <Text style={styles.muted}>El despiece calcula m² × precio del material. Los costos fijos y extras se suman aparte. Los slots con despiece reemplazan sus conceptos manuales para evitar duplicar materiales.</Text>
        {!designSnapshot && <Text style={styles.notice}>Abrí la pestaña Diseño para cargar el proyecto.</Text>}
        {loading && <ActivityIndicator accessibilityLabel="Cargando precios" color={COLORS.primary} />}
        {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        {designSnapshot && rows.length === 0 && <Text style={styles.notice}>No hay módulos en el diseño. Podés agregar costos adicionales abajo.</Text>}
        {rows.map(({ object, entries, slots, parts, result }) => (
          <View key={object.id} style={styles.card}>
            <View style={styles.heading}><View><Text style={styles.moduleTitle}>{object.name}</Text><Text style={styles.muted}>Cantidad: 1 · Versión {object.version}{object.hidden ? ' · Oculto en vista 3D' : ''}</Text></View><Text style={styles.amount}>{formatBudgetAmount(ready ? result.total : undefined)}</Text></View>
            {parts.length > 0 && <Text style={styles.body}>{parts.reduce((sum, part) => sum + part.quantity, 0)} piezas · {formatArea(result.areaM2)} m² de material</Text>}
            {parts.length === 0 && <Text style={styles.muted}>Sin despiece: se usan los conceptos manuales del módulo.</Text>}
            {result.partCosts.map((cost) => <View key={cost.part.id} style={styles.line}><View style={styles.lineName}><Text style={styles.body}>{cost.part.name} · {cost.materialName ?? `Slot ${cost.part.materialSlot}`}</Text><Text style={styles.muted}>{cost.part.quantity} × {cost.part.widthMm} × {cost.part.heightMm} mm = {formatArea(cost.areaM2)} m² · {formatBudgetAmount(cost.pricePerSquareMeter)} / m²</Text>{cost.error && <Text style={styles.error}>{cost.error}</Text>}</View><Text style={styles.body}>{formatBudgetAmount(ready ? cost.amount : undefined)}</Text></View>)}
            {result.lines.map((line) => <View style={styles.line} key={line.entry.id}><View style={styles.lineName}><Text style={styles.body}>{line.entry.name}</Text><Text style={styles.muted}>{formatBudgetAmount(line.entry.basePrice)} × {line.multiplier ?? '?'}{line.materialName ? ` · ${line.materialName}` : line.entry.materialSlot == null ? ' · Fijo' : ` · Slot ${line.entry.materialSlot}`}</Text></View><Text style={styles.body}>{formatBudgetAmount(ready ? line.amount : undefined)}</Text></View>)}
            {ready && result.error && <Text style={styles.error}>{result.error}</Text>}
            <View style={styles.actions}>
              <Action label="Editar despiece" disabled={!canEdit || !ready} onPress={() => setPartsEdit({ id: object.id, name: object.name, parts, slots })} />
              {object.materialParts !== undefined && <Action label="Usar despiece del catálogo" disabled={!canEdit} onPress={() => updateMaterialParts(object.id, undefined)} />}
              <Action label={object.budgetEntries === undefined ? 'Personalizar conceptos' : 'Editar conceptos personalizados'} disabled={!canEdit || !ready} onPress={() => setEdit({ key: object.id, title: object.name, entries: entries ?? [], slots, onSave: (value) => updateBudgetEntries(object.id, value) })} />
              {object.budgetEntries !== undefined && <Action label="Usar catálogo" disabled={!canEdit} onPress={() => updateBudgetEntries(object.id, undefined)} />}
            </View>
          </View>
        ))}
        {ready && <>
          <Text style={styles.moduleTitle}>Simulación de placas y cortes</Text>
          {demands.length === 0 && <Text style={styles.muted}>Agregá partes al despiece y asignales un material para simular su distribución en placas.</Text>}
          {demands.map((demand) => <BoardCuttingSimulation key={demand.material.id} demand={demand} settings={budgetSettings.cutting?.[demand.material.id]} onSettingsChange={canEdit ? (settings) => setBudgetSettings({ ...budgetSettings, cutting: { ...budgetSettings.cutting, [demand.material.id]: settings } }) : undefined} />)}
        </>}
        <View style={styles.card}>
          <View style={styles.heading}><Text style={styles.moduleTitle}>Costos adicionales del proyecto</Text><Action label="Editar extras" disabled={!canEdit} onPress={editExtras} /></View>
          {budgetSettings.extras.length === 0 && <Text style={styles.muted}>Entrega, instalación o cualquier costo fuera del diseño.</Text>}
          {budgetSettings.extras.map((extra) => <View key={extra.id} style={styles.line}><Text style={styles.body}>{extra.name}</Text><Text style={styles.body}>{formatBudgetAmount(extra.amount)}</Text></View>)}
        </View>
        <View style={styles.card}>
          <View style={styles.heading}><Text style={styles.moduleTitle}>Multiplicadores del proyecto</Text><Action label="Editar multiplicadores" disabled={!canEdit} onPress={editMultipliers} /></View>
          <Text style={styles.muted}>Se aplican en orden sobre módulos + extras. Ej.: 1,10 aumenta 10%; 0,90 descuenta 10%.</Text>
          {budgetSettings.multipliers.map((factor) => <View key={factor.id} style={styles.line}><Text style={styles.body}>{factor.name}</Text><Text style={styles.body}>× {factor.factor}</Text></View>)}
        </View>
        <View style={styles.totalCard}>
          <View style={styles.line}><Text style={styles.body}>Módulos calculados</Text><Text style={styles.body}>{formatBudgetAmount(ready ? summary.modulesTotal : undefined)}</Text></View>
          <View style={styles.line}><Text style={styles.body}>Extras</Text><Text style={styles.body}>{formatBudgetAmount(summary.extrasTotal)}</Text></View>
          <View style={styles.line}><Text style={styles.body}>Subtotal antes de multiplicadores</Text><Text style={styles.body}>{formatBudgetAmount(ready ? summary.subtotal : undefined)}</Text></View>
          <View style={styles.line}><Text style={styles.title}>Total estimado</Text><Text style={styles.title}>{formatBudgetAmount(ready ? summary.total : undefined)}</Text></View>
          {ready && summary.error && <Text style={styles.error}>{summary.error}: completá los precios pendientes para obtener el total.</Text>}
          <Text style={styles.muted}>Importes en la misma moneda que el catálogo. Guardá el proyecto desde Diseño para conservar los cambios.</Text>
        </View>
      </ScrollView>
      {edit && canEdit && <EditDialog key={edit.key} edit={edit} onClose={() => setEdit(undefined)} />}
      {partsEdit && canEdit && <PartsDialog key={partsEdit.id} edit={partsEdit} onSave={(parts) => updateMaterialParts(partsEdit.id, parts)} onClose={() => setPartsEdit(undefined)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bgAlt },
  content: { padding: 20, gap: 16, maxWidth: 1100, width: '100%', alignSelf: 'center', paddingBottom: 40 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.text },
  moduleTitle: { fontSize: 17, fontWeight: '600', color: COLORS.text },
  body: { fontSize: 14, color: COLORS.text },
  muted: { fontSize: 12, lineHeight: 18, color: COLORS.textMuted },
  notice: { color: COLORS.textMuted, paddingVertical: 12 },
  card: { padding: 16, backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, gap: 12 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  lineName: { flex: 1, minWidth: 160 },
  amount: { fontSize: 20, color: COLORS.text, fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { padding: 10, minHeight: 44, borderRadius: 8, backgroundColor: COLORS.primarySoft },
  actionText: { fontWeight: '600', color: COLORS.primary },
  disabled: { opacity: 0.45 },
  error: { color: COLORS.dangerStrong, fontSize: 13 },
  totalCard: { padding: 20, gap: 16, borderRadius: 12, borderWidth: 1, borderColor: COLORS.primaryBorder, backgroundColor: COLORS.primarySoft },
  scrim: { flex: 1, backgroundColor: COLORS.overlay, alignItems: 'center', justifyContent: 'center', padding: 16 },
  dialog: { width: '100%', maxWidth: 800, maxHeight: '90%', backgroundColor: COLORS.surface, borderRadius: 12, padding: 20, gap: 16 },
  dialogContent: { gap: 16 },
});
