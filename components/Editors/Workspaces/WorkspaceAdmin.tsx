import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useAccess } from '../../../services/AccessContext';
import { useAuth } from '../../../services/AuthContext';
import { addWorkspaceMember, fetchAllWorkspaceRoles, fetchWorkspaceMembers, removeWorkspaceMember, updateWorkspaceMember, WorkspaceMember, WorkspaceRole, WorkspaceAccessLevel } from '../../../services/api';
import { ManagerAction, ManagerDialog, ManagerNotice, ManagerSearch, managerStyles as s } from '../ManagerControls';

export default function WorkspaceAdmin({ workspaceId }: { workspaceId: string }) {
  const { refresh: refreshAccess, canManageApplication } = useAccess();
  const { backendUserId } = useAuth();
  const [roles, setRoles] = useState<WorkspaceRole[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [newMemberUserId, setNewMemberUserId] = useState('');
  const [newMemberRoleId, setNewMemberRoleId] = useState('');
  const [pending, setPending] = useState<{ member: WorkspaceMember; roleId?: string }>();
  const reload = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [r, m] = await Promise.all([fetchAllWorkspaceRoles(), fetchWorkspaceMembers(workspaceId)]);
      setRoles(r); setMembers(m);
      setNewMemberRoleId(prev => prev || r.find(role => role.accessLevel === WorkspaceAccessLevel.Designer)?.id || '');
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [workspaceId]);
  useEffect(() => { void reload(); }, [reload]);
  const handleAddMember = async () => {
    if (busy) return;
    const userId = newMemberUserId.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) { setError('Ingresa un ID de usuario válido.'); return; }
    if (!newMemberRoleId) { setError('Selecciona un rol.'); return; }
    if (members.some(m => m.userId.toLowerCase() === userId.toLowerCase())) { setError('Este usuario ya pertenece al espacio.'); return; }
    setBusy(true); setError(null); setMessage('');
    try {
      await addWorkspaceMember({ userId, workspaceId, roleId: newMemberRoleId });
      setNewMemberUserId(''); setAdding(false); setMessage('Miembro agregado.'); await reload(); refreshAccess();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const handleConfirm = async () => {
    if (!pending || busy) return;
    setBusy(true); setError(null); setMessage('');
    try {
      if (pending.roleId) await updateWorkspaceMember(pending.member.userId, workspaceId, { roleId: pending.roleId });
      else await removeWorkspaceMember(pending.member.userId, workspaceId);
      setPending(undefined); setMessage('Miembros actualizados.'); await reload(); refreshAccess();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const filtered = members.filter(member => `${member.username ?? ''} ${member.userId} ${member.roleName ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort((a, b) => (a.username ?? a.userId).localeCompare(b.username ?? b.userId));
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
    <View style={s.row}>
      <Text style={s.name}>Miembros · {members.length}</Text>
      <ManagerAction label="Agregar miembro" primary disabled={busy || loading} onPress={() => setAdding(true)} />
      <ManagerAction label="Actualizar" disabled={busy || loading} onPress={reload} />
    </View>
    <Text style={s.subtitle}>Comparte este espacio y elige qué puede hacer cada persona.</Text>
    {error && <ManagerNotice error message={error} />}
    {!!message && <ManagerNotice message={message} />}
    {adding && <View style={s.card}>
      <Text style={s.name}>Agregar una persona</Text>
      <Text style={s.subtitle}>Pídele su ID de usuario para agregar su cuenta existente.</Text>
      <Text style={s.label}>ID de usuario</Text>
      <TextInput accessibilityLabel="ID del nuevo miembro" editable={!busy} style={s.input} value={newMemberUserId} onChangeText={setNewMemberUserId} autoCapitalize="none" autoCorrect={false} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
      <Text style={s.label}>Permisos en este espacio</Text>
      <View style={s.row}>{roles.map(role => <ManagerAction key={role.id} label={role.name} primary={newMemberRoleId === role.id} disabled={busy} onPress={() => setNewMemberRoleId(role.id)} />)}</View>
      <Text style={s.subtitle}>{roles.find(role => role.id === newMemberRoleId)?.description}</Text>
      <View style={s.row}><ManagerAction label={busy ? 'Agregando…' : 'Agregar miembro'} primary disabled={busy || !newMemberUserId.trim() || !newMemberRoleId} onPress={handleAddMember} /><ManagerAction label="Cancelar" disabled={busy} onPress={() => setAdding(false)} /></View>
    </View>}
    {pending && (
      <ManagerDialog
        onClose={() => { if (!busy) setPending(undefined); }}
        actions={
          <View style={s.row}>
            <ManagerAction label={busy ? 'Guardando…' : 'Confirmar'} primary={!!pending.roleId} danger={!pending.roleId} disabled={busy} onPress={handleConfirm} />
            <ManagerAction label="Cancelar" disabled={busy} onPress={() => setPending(undefined)} />
          </View>
        }
      >
        {error && <ManagerNotice error message={error} />}
        <Text style={s.name}>{pending.roleId ? 'Cambiar permisos' : 'Quitar acceso'}</Text>
        <Text style={s.subtitle}>{pending.roleId ? `${pending.member.username ?? pending.member.userId} tendrá el rol ${roles.find(role => role.id === pending.roleId)?.name}.` : `${pending.member.username ?? pending.member.userId} dejará de acceder a este espacio.`}</Text>
      </ManagerDialog>
    )}
    <ManagerSearch value={query} onChangeText={setQuery} placeholder="Buscar miembros o roles" />
    {loading ? <ManagerNotice message="Cargando miembros…" loading /> : filtered.length === 0 ? <ManagerNotice message={query ? 'No hay coincidencias. Prueba otro nombre o rol.' : 'Este espacio todavía no tiene miembros.'} /> : filtered.map(member => {
      const self = member.userId === backendUserId;
      return <View key={member.userId} style={s.card}>
        <View style={s.row}><Text style={s.name}>{member.username ?? 'Usuario'}</Text>{self && <Text style={s.badge}>Tú</Text>}<Text style={s.badge}>{member.roleName ?? roles.find(role => role.id === member.roleId)?.name ?? 'Sin rol'}</Text></View>
        {canManageApplication && <Text selectable style={s.subtitle}>ID: {member.userId}</Text>}
        <View style={s.row}>{roles.map(role => <ManagerAction key={role.id} label={role.name} primary={member.roleId === role.id} disabled={busy || self || member.roleId === role.id} onPress={() => setPending({ member, roleId: role.id })} />)}
          <ManagerAction label="Quitar del espacio" danger disabled={busy || self} onPress={() => setPending({ member })} />
        </View>
        {self && <Text style={s.subtitle}>Otro administrador puede modificar tu acceso.</Text>}
      </View>;
    })}
  </ScrollView>;
}
