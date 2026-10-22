import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { AppRole, fetchAppRoles, fetchAllWorkspaceRoles, removeRole, saveRole, WorkspaceAccessLevel, WorkspaceRole } from '../../services/api';
import { useAccess } from '../../services/AccessContext';
import { ManagerAction, ManagerDialog, ManagerNotice, ManagerSearch, managerStyles as s } from './ManagerControls';

const systemIds = new Set([
  'af7c9dcd-2e83-4b8e-8ac8-a0b00119a30a', '217154ff-7470-40ea-a0c4-b7e811629615',
  'b7710000-0000-4000-8000-000000000001', 'b7710000-0000-4000-8000-000000000002',
  'b7710000-0000-4000-8000-000000000003',
]);
const levels = ['Diseñador', 'Gestor de recursos', 'Administrador de espacio'];
const capabilities = ['Crea y edita diseños dentro del espacio.', 'Gestiona diseños, módulos y materiales del espacio.', 'Gestiona diseños, recursos y miembros del espacio.'];

export default function RoleManager({ scope }: { scope: 'AppRole' | 'WorkspaceRole' }) {
  const access = useAccess();
  const [roles, setRoles] = useState<(AppRole | WorkspaceRole)[]>([]);
  const [id, setId] = useState<string>();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [canManageApplication, setCanManageApplication] = useState(false);
  const [accessLevel, setAccessLevel] = useState(WorkspaceAccessLevel.Designer);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');
  const [deleteId, setDeleteId] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      setRoles(await (scope === 'AppRole' ? fetchAppRoles() : fetchAllWorkspaceRoles()));
    } catch (error) { setError((error as Error).message); }
    finally { setLoading(false); }
  }, [scope]);
  useEffect(() => { void reload(); }, [reload]);
  const reset = () => { setId(undefined); setName(''); setDescription(''); setCanManageApplication(false); setAccessLevel(WorkspaceAccessLevel.Designer); setEditing(false); };
  const duplicate = roles.some(role => role.id !== id && role.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase());
  const handleSave = async () => {
    if (!name.trim() || duplicate || busy) return;
    setBusy(true); setError(null); setMessage('');
    try {
      await saveRole(scope, { id, name: name.trim(), description: description.trim(), canManageApplication, accessLevel });
      reset(); setMessage('Rol guardado.'); await reload(); access.refresh();
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  };
  const handleDelete = async (roleId: string) => {
    if (busy) return;
    setBusy(true); setError(null); setMessage('');
    try {
      await removeRole(scope, roleId);
      if (id === roleId) reset();
      setDeleteId(undefined); setMessage('Rol eliminado.'); await reload(); access.refresh();
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  };
  const filtered = roles.filter(role => `${role.name} ${role.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
  return <View style={styles.section}>
    <View style={s.row}>
      <Text style={s.name}>{scope === 'AppRole' ? 'Roles de aplicación' : 'Roles de espacios de trabajo'} · {roles.length}</Text>
      <ManagerAction label="Nuevo rol" primary disabled={busy || loading} onPress={() => { reset(); setEditing(true); setMessage(''); }} />
      <ManagerAction label="Actualizar" disabled={busy || loading} onPress={reload} />
    </View>
    <ManagerSearch value={query} onChangeText={setQuery} placeholder="Buscar por nombre o descripción" />
    {error && <ManagerNotice message={error} error />}
    {!!message && <ManagerNotice message={message} />}
    {editing && <ManagerDialog onClose={() => { if (!busy) reset(); }}>
      <Text style={s.name}>{id ? 'Editar rol' : 'Crear rol'}</Text>
      <Text style={s.label}>Nombre · máximo 16 caracteres</Text>
      <TextInput accessibilityLabel="Nombre del rol" editable={!busy} style={s.input} value={name} onChangeText={setName} maxLength={16} />
      {error && <ManagerNotice error message={error} />}
      {duplicate && <ManagerNotice error message="Ya existe un rol con este nombre." />}
      <Text style={s.label}>Descripción</Text>
      <TextInput accessibilityLabel="Descripción del rol" editable={!busy} style={s.input} value={description} onChangeText={setDescription} multiline />
      {scope === 'AppRole' ? <View style={s.row}>
        <Switch accessibilityLabel="Administrar aplicación y usuarios globales" disabled={busy} value={canManageApplication} onValueChange={setCanManageApplication} />
        <Text style={s.subtitle}>Administrar aplicación y usuarios globales</Text>
      </View> : <>
        <Text style={s.label}>Nivel de acceso</Text>
        <View style={s.row}>{levels.map((label, level) => <ManagerAction key={level} label={label} primary={accessLevel === level} disabled={busy} onPress={() => setAccessLevel(level)} />)}</View>
        <Text style={s.subtitle}>{capabilities[accessLevel]}</Text>
      </>}
      <View style={s.row}>
        <ManagerAction label={busy ? 'Guardando…' : 'Guardar rol'} primary disabled={busy || !name.trim() || duplicate} onPress={handleSave} />
        <ManagerAction label="Cancelar" disabled={busy} onPress={reset} />
      </View>
    </ManagerDialog>}
    {loading ? <ManagerNotice message="Cargando roles…" loading /> : filtered.length === 0 ? <ManagerNotice message={query ? 'No hay roles que coincidan con la búsqueda.' : 'Crea el primer rol para definir sus permisos.'} /> : filtered.map(role => <View key={role.id} style={s.card}>
      <View style={s.row}><Text style={s.name}>{role.name}</Text>{systemIds.has(role.id.toLowerCase()) && <Text style={s.badge}>Sistema · protegido</Text>}</View>
      {!!role.description && <Text style={s.subtitle}>{role.description}</Text>}
      <Text style={s.badge}>{'accessLevel' in role ? levels[role.accessLevel] : role.canManageApplication ? 'Administración global' : 'Usuario estándar'}</Text>
      {!systemIds.has(role.id.toLowerCase()) && <View style={s.row}>
        <ManagerAction label="Editar" disabled={busy} onPress={() => {
          setId(role.id); setName(role.name); setDescription(role.description ?? ''); setEditing(true);
          setCanManageApplication('canManageApplication' in role && role.canManageApplication);
          setAccessLevel('accessLevel' in role ? role.accessLevel : WorkspaceAccessLevel.Designer);
        }} />
        <ManagerAction label="Eliminar" danger disabled={busy} onPress={() => setDeleteId(role.id)} />
      </View>}
      {deleteId === role.id && <>
        <ManagerNotice error message={`¿Eliminar el rol “${role.name}”? Esta acción no se puede deshacer. Los roles en uso pueden requerir reasignación.`} />
        <View style={s.row}><ManagerAction label={busy ? 'Eliminando…' : 'Confirmar eliminación'} danger disabled={busy} onPress={() => handleDelete(role.id)} /><ManagerAction label="Cancelar" disabled={busy} onPress={() => setDeleteId(undefined)} /></View>
      </>}
    </View>)}
  </View>;
}
const styles = StyleSheet.create({ section: { gap: 14 } });
