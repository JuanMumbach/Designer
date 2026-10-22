import React, { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { createMaterialType, deleteMaterialType, MaterialType, updateMaterialType } from '../../../services/api';
import { MaterialTypeUsage } from '../../../services/useMaterialTypes';
import { ManagerAction, ManagerDialog, ManagerNotice, ManagerSearch, managerStyles as s } from '../ManagerControls';

interface MaterialTypeAdminProps {
  materialTypes: MaterialType[];
  usageByType: (typeId: string) => MaterialTypeUsage;
  onRefresh: () => void;
}

export default function MaterialTypeAdmin({ materialTypes, usageByType, onRefresh }: MaterialTypeAdminProps) {
  const [query, setQuery] = useState('');
  const [unusedOnly, setUnusedOnly] = useState(false);
  const [editing, setEditing] = useState(false);
  const [id, setId] = useState<string>();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [deleting, setDeleting] = useState<MaterialType>();
  const duplicate = materialTypes.some(type => type.id !== id && type.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase());
  const handleSave = async () => {
    if (busy || !name.trim() || duplicate) return;
    setBusy(true); setError(''); setMessage('');
    try {
      if (id) await updateMaterialType(id, { name: name.trim(), description: description.trim() || null });
      else await createMaterialType({ name: name.trim(), description: description.trim() || undefined });
      setEditing(false); setMessage('Tipo guardado.'); onRefresh();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const handleDelete = async () => {
    if (!deleting || busy) return;
    if (usageByType(deleting.id).slotCount > 0) { setError('Este tipo está en uso. Reasigna sus slots antes de eliminarlo.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      await deleteMaterialType(deleting.id); setDeleting(undefined); setMessage('Tipo eliminado.'); onRefresh();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const filtered = materialTypes.filter(type => (!unusedOnly || usageByType(type.id).slotCount === 0) && `${type.name} ${type.description ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
    <Text style={s.title}>Tipos de material</Text>
    <Text style={s.subtitle}>Clasificaciones que determinan qué materiales pueden usar los slots de un módulo.</Text>
    <View style={s.row}>
      <ManagerAction label="Nuevo tipo" primary disabled={busy} onPress={() => { setId(undefined); setName(''); setDescription(''); setEditing(true); }} />
      <ManagerAction label={unusedOnly ? 'Mostrar todos' : 'Solo sin uso'} primary={unusedOnly} onPress={() => setUnusedOnly(value => !value)} />
      <ManagerAction label="Actualizar" disabled={busy} onPress={onRefresh} />
    </View>
    <ManagerSearch value={query} onChangeText={setQuery} placeholder="Buscar tipos de material" />
    {!!error && <ManagerNotice error message={error} />}
    {!!message && <ManagerNotice message={message} />}
    {editing && (
      <ManagerDialog
        onClose={() => { if (!busy) setEditing(false); }}
        actions={
          <View style={s.row}>
            <ManagerAction label={busy ? 'Guardando…' : 'Guardar tipo'} primary disabled={busy || !name.trim() || duplicate} onPress={handleSave} />
            <ManagerAction label="Cancelar" disabled={busy} onPress={() => setEditing(false)} />
          </View>
        }
      >
        {error && <ManagerNotice error message={error} />}
        <Text style={s.name}>{id ? 'Editar tipo' : 'Crear tipo'}</Text>
        <Text style={s.label}>Nombre</Text>
        <TextInput accessibilityLabel="Nombre del tipo" editable={!busy} style={s.input} value={name} onChangeText={setName} placeholder="Por ejemplo, MDF" />
        {duplicate && <ManagerNotice error message="Ya existe un tipo con este nombre." />}
        <Text style={s.label}>Descripción</Text>
        <TextInput accessibilityLabel="Descripción del tipo" editable={!busy} style={s.input} value={description} onChangeText={setDescription} multiline />
      </ManagerDialog>
    )}
    {deleting && (
      <ManagerDialog
        onClose={() => { if (!busy) setDeleting(undefined); }}
        actions={
          <View style={s.row}>
            <ManagerAction label={busy ? 'Eliminando…' : 'Eliminar tipo'} danger disabled={busy} onPress={handleDelete} />
            <ManagerAction label="Cancelar" disabled={busy} onPress={() => setDeleting(undefined)} />
          </View>
        }
      >
        {error && <ManagerNotice error message={error} />}
        <ManagerNotice error message={`¿Eliminar “${deleting.name}”? Esta acción no se puede deshacer.`} />
      </ManagerDialog>
    )}
    <Text style={s.label}>{filtered.length} de {materialTypes.length} tipos</Text>
    {filtered.length === 0 && <ManagerNotice message="No hay tipos que mostrar. Crea uno o cambia los filtros." />}
    {filtered.map(type => {
      const count = usageByType(type.id).slotCount;
      return <View key={type.id} style={s.card}>
        <View style={s.row}><Text style={s.name}>{type.name}</Text><Text style={s.badge}>{count ? `${count} slots` : 'Sin uso'}</Text></View>
        {!!type.description && <Text style={s.subtitle}>{type.description}</Text>}
        <View style={s.row}><ManagerAction label="Editar" disabled={busy} onPress={() => { setId(type.id); setName(type.name); setDescription(type.description ?? ''); setEditing(true); }} /><ManagerAction label="Eliminar" danger disabled={busy || count > 0} onPress={() => setDeleting(type)} /></View>
        {count > 0 && <Text style={s.subtitle}>Reasigna los slots antes de eliminar este tipo.</Text>}
      </View>;
    })}
  </ScrollView>;
}
