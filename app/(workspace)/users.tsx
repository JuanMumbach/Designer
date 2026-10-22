import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AppRole, BackendUser, changeUserAppRole, fetchAllUsers, fetchAppRoles } from '../../services/api';
import { useAuth } from '../../services/AuthContext';
import { ManagerAction, ManagerDialog, ManagerNotice, ManagerSearch, managerStyles as s } from '../../components/Editors/ManagerControls';

export default function UsersScreen() {
  const { backendUserId } = useAuth();
  const [users, setUsers] = useState<BackendUser[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [pending, setPending] = useState<{ user: BackendUser; role: AppRole }>();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const [users, roles] = await Promise.all([fetchAllUsers(), fetchAppRoles()]);
      setUsers(users); setRoles(roles);
    } catch (error) { setError((error as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  const handleChangeRole = async () => {
    if (!pending || busy) return;
    setBusy(true); setError(null); setMessage('');
    try {
      await changeUserAppRole(pending.user.id, pending.role.id);
      setMessage(`Rol de ${pending.user.username} actualizado.`); setPending(undefined); await reload();
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  };
  const filtered = users.filter(user => (!roleFilter || user.appRoleId === roleFilter) && `${user.username} ${user.emailAddress} ${user.id}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort((a, b) => a.username.localeCompare(b.username));
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
    <Text style={s.title}>Usuarios de la aplicación</Text>
    <Text style={s.subtitle}>Consulta cuentas y administra su acceso global. Los permisos de cada espacio se asignan desde Espacios de trabajo.</Text>
    <ManagerSearch value={query} onChangeText={setQuery} placeholder="Buscar por nombre, correo o ID" />
    <View style={s.row}>
      <ManagerAction label={`Todos · ${users.length}`} primary={!roleFilter} onPress={() => setRoleFilter('')} />
      {roles.map(role => <ManagerAction key={role.id} label={`${role.name} · ${users.filter(user => user.appRoleId === role.id).length}`} primary={roleFilter === role.id} onPress={() => setRoleFilter(role.id)} />)}
      <ManagerAction label="Actualizar" disabled={busy || loading} onPress={reload} />
    </View>
    {error && <ManagerNotice message={error} error />}
    {!!message && <ManagerNotice message={message} />}
    {pending && <ManagerDialog
      onClose={() => { if (!busy) setPending(undefined); }}
      actions={<>
        <ManagerAction label={busy ? 'Guardando…' : 'Confirmar cambio'} primary disabled={busy} onPress={handleChangeRole} />
        <ManagerAction label="Cancelar" disabled={busy} onPress={() => setPending(undefined)} />
      </>}
    >
      {error && <ManagerNotice error message={error} />}
      <Text style={s.name}>Cambiar acceso de {pending.user.username}</Text>
      <Text style={s.subtitle}>Nuevo rol: {pending.role.name}. {pending.role.canManageApplication ? 'Podrá administrar la aplicación y todos sus usuarios.' : 'Tendrá acceso de usuario estándar.'}</Text>
    </ManagerDialog>}
    {loading ? <ManagerNotice message="Cargando usuarios…" loading /> : <>
      <Text style={s.label}>{filtered.length} usuarios encontrados</Text>
      {filtered.length === 0 && <ManagerNotice message="No hay usuarios que coincidan con estos filtros." />}
      {filtered.map(user => <View key={user.id} style={s.card}>
        <View style={s.row}><Text style={s.name}>{user.username}</Text><Text style={s.badge}>{roles.find(role => role.id === user.appRoleId)?.name ?? 'Sin rol asignado'}</Text>{user.id === backendUserId && <Text style={s.badge}>Tú</Text>}</View>
        <Text selectable style={s.subtitle}>{user.emailAddress}</Text>
        <Text selectable style={s.subtitle}>ID: {user.id}</Text>
        <View style={s.row}>{roles.map(role => <ManagerAction key={role.id} label={role.name} primary={user.appRoleId === role.id}
          disabled={busy || user.id === backendUserId || user.appRoleId === role.id} onPress={() => setPending({ user, role })} />)}</View>
        {user.id === backendUserId && <Text style={s.subtitle}>Otro administrador debe cambiar tu rol.</Text>}
      </View>)}
    </>}
  </ScrollView>;
}
