import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import WorkspaceAdmin from '../../components/Editors/Workspaces/WorkspaceAdmin';
import Thumbnail from '../../components/Thumbnail';
import { ManagerAction, ManagerNotice, ManagerSearch, managerStyles as s } from '../../components/Editors/ManagerControls';
import { createWorkspace, fetchAllWorkspaces, updateWorkspace, Workspace } from '../../services/api';
import { useAccess } from '../../services/AccessContext';
import { useAuth } from '../../services/AuthContext';
import { uploadFileToFirebase } from '../../services/firebaseSetup';
import { pickImage } from '../../services/imagePicker';
import { COLORS } from '../../constants/theme';

export default function WorkspacesScreen() {
  const access = useAccess();
  const { backendUserId, selectedWorkspaceId: contextId } = useAuth();
  const { width } = useWindowDimensions();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const selected = workspaces.find(ws => ws.id === selectedId);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const all = await fetchAllWorkspaces();
      const manageable = all.filter(ws => access.canManageApplication || access.manageableWorkspaceIds.includes(ws.id));
      setWorkspaces(manageable);
      setSelectedId(prev => manageable.some(ws => ws.id === prev) ? prev : manageable.find(ws => ws.id === contextId)?.id ?? manageable[0]?.id ?? null);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [contextId, access.canManageApplication, access.manageableWorkspaceIds]);
  useEffect(() => { void load(); }, [load]);
  const handleSave = async () => {
    if (busy || !name.trim() || !backendUserId) return;
    setBusy(true); setError(null); setMessage('');
    try {
      if (creating) {
        const ws = await createWorkspace({ name: name.trim(), creatorId: backendUserId });
        setWorkspaces(prev => [...prev, ws]); setSelectedId(ws.id); access.refresh();
      } else if (selected) {
        await updateWorkspace(selected.id, { name: name.trim() });
        setWorkspaces(prev => prev.map(ws => ws.id === selected.id ? { ...ws, name: name.trim() } : ws));
      }
      setCreating(false); setRenaming(false); setName(''); setMessage('Espacio guardado.');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const handleLogo = async () => {
    if (!selected || busy) return;
    setBusy(true); setError(null); setMessage('');
    try {
      const uri = await pickImage();
      if (!uri) return;
      const logoURL = await uploadFileToFirebase(uri, 'workspace-logos', `logo_${selected.id}_${Date.now()}.jpeg`);
      await updateWorkspace(selected.id, { logoURL });
      setWorkspaces(prev => prev.map(ws => ws.id === selected.id ? { ...ws, logoURL } : ws));
      setMessage('Logo actualizado.');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const filtered = workspaces.filter(ws => ws.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
  return <View style={styles.screen}>
    <View style={styles.header}>
      <Text style={s.title}>Espacios de trabajo</Text>
      <Text style={s.subtitle}>{access.canManageApplication ? 'Administra los espacios y el acceso de sus miembros.' : 'Un lugar para tus proyectos y tu equipo.'}</Text>
    </View>
    <View style={[styles.body, width >= 900 && styles.wide]}>
      <ScrollView style={[styles.picker, width >= 900 && styles.widePicker]} contentContainerStyle={styles.pickerContent} keyboardShouldPersistTaps="handled">
        <View style={s.row}><ManagerAction label="Nuevo espacio" primary disabled={busy} onPress={() => { setCreating(true); setRenaming(false); setName(''); }} /><ManagerAction label="Actualizar" disabled={busy || loading} onPress={load} /></View>
        <ManagerSearch value={query} onChangeText={setQuery} placeholder="Buscar espacios" />
        {loading && <ManagerNotice message="Cargando espacios…" loading />}
        {!loading && <Text style={s.label}>{filtered.length} espacios disponibles</Text>}
        {filtered.map(ws => <ManagerAction key={ws.id} label={ws.name} primary={selectedId === ws.id} disabled={busy} onPress={() => { setSelectedId(ws.id); setRenaming(false); setCreating(false); setMessage(''); setError(null); }} />)}
        {!loading && filtered.length === 0 && <ManagerNotice message={query ? 'No hay coincidencias.' : 'Crea un espacio para empezar a colaborar.'} />}
      </ScrollView>
      <View style={styles.detail}>
        <ScrollView style={styles.detailsHeader} contentContainerStyle={styles.pickerContent} keyboardShouldPersistTaps="handled">
          {error && <ManagerNotice message={error} error />}
          {!!message && <ManagerNotice message={message} />}
          {(creating || renaming) ? <View style={s.card}>
            <Text style={s.name}>{creating ? 'Nuevo espacio' : 'Renombrar espacio'}</Text>
            <Text style={s.label}>Nombre del espacio</Text>
            <TextInput accessibilityLabel="Nombre del espacio" editable={!busy} style={s.input} value={name} onChangeText={setName} placeholder="Por ejemplo, Estudio Norte" />
            <View style={s.row}><ManagerAction label={busy ? 'Guardando…' : 'Guardar espacio'} primary disabled={busy || !name.trim() || !backendUserId} onPress={handleSave} /><ManagerAction label="Cancelar" disabled={busy} onPress={() => { setCreating(false); setRenaming(false); }} /></View>
          </View> : selected && <View style={s.row}>
            <Thumbnail uri={selected.logoURL} size={56} icon="business" radius={14} />
            <View style={styles.identity}><Text style={s.name}>{selected.name}</Text>{access.canManageApplication && <Text selectable style={s.subtitle}>{selected.id}</Text>}</View>
            <ManagerAction label="Renombrar" disabled={busy} onPress={() => { setRenaming(true); setName(selected.name); }} />
            <ManagerAction label={busy ? 'Actualizando…' : 'Cambiar logo'} disabled={busy} onPress={handleLogo} />
          </View>}
        </ScrollView>
        {selected && !creating && <WorkspaceAdmin key={selected.id} workspaceId={selected.id} />}
      </View>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bgAlt }, header: { padding: 24, gap: 8 },
  body: { flex: 1 }, wide: { flexDirection: 'row' },
  picker: { maxHeight: 220, flexGrow: 0, borderBottomWidth: 1, borderColor: COLORS.border },
  widePicker: { width: 280, maxHeight: '100%', borderRightWidth: 1, borderBottomWidth: 0 },
  pickerContent: { padding: 20, gap: 12 }, detail: { flex: 1, minWidth: 0 },
  detailsHeader: { flexGrow: 0, maxHeight: 280 }, identity: { flex: 1, minWidth: 120, gap: 4 },
});
