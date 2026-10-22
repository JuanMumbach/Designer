import React, { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { COLORS, RADII } from '../../constants/theme';
import FormPanel, { formStyles } from './FormPanel';
import { ManagerAction } from './ManagerControls';

export interface CategoryNode {
  id: string;
  categoryName: string;
  parentCategoryId: string | null;
}

type Mode = { type: 'list' } | { type: 'create' } | { type: 'edit'; id: string };

const TABS = [
  { key: 'list', label: 'Categorías' },
  { key: 'create', label: 'Nueva categoría' },
];

export default function CategoryManagerPanel({
  title = 'Gestionar categorías',
  categories,
  deletableIds,
  onCreate,
  onRename,
  onDelete,
  onClose,
}: {
  title?: string;
  categories: CategoryNode[];
  deletableIds: string[];
  onCreate: (name: string, parentId?: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>({ type: 'list' });
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>, errorMessage: string) => {
    setBusy(true);
    try {
      await action();
      return true;
    } catch {
      Alert.alert('Error', errorMessage);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const goToList = () => {
    setName('');
    setParentId('');
    setMode({ type: 'list' });
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    const ok = await run(() => onCreate(name.trim(), parentId || undefined), 'No se pudo crear la categoría.');
    if (ok) goToList();
  };

  const handleRename = async (id: string) => {
    if (!name.trim()) return;
    const ok = await run(() => onRename(id, name.trim()), 'No se pudo renombrar la categoría.');
    if (ok) goToList();
  };

  const handleDelete = (id: string) => {
    const confirm = () => {
      run(() => onDelete(id), 'No se pudo eliminar la categoría.');
    };
    if (Platform.OS === 'web') {
      if (window.confirm('¿Eliminar esta categoría?')) confirm();
    } else {
      Alert.alert('Eliminar categoría', '¿Estás seguro?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: confirm },
      ]);
    }
  };

  const startEdit = (category: CategoryNode) => {
    setName(category.categoryName);
    setMode({ type: 'edit', id: category.id });
  };

  const handleTabChange = (key: string) => {
    setName('');
    setParentId('');
    setMode({ type: key === 'create' ? 'create' : 'list' });
  };

  if (mode.type === 'edit') {
    return (
      <FormPanel
        title="Renombrar categoría"
        primaryAction={{ label: busy ? 'Guardando...' : 'Guardar', onPress: () => handleRename(mode.id), disabled: busy || !name.trim() }}
        secondaryAction={{ label: 'Cancelar', onPress: goToList, disabled: busy }}
      >
        <View style={formStyles.field}>
          <Text style={formStyles.label}>Nombre</Text>
          <TextInput style={formStyles.input} value={name} onChangeText={setName} placeholder="Nombre de la categoría" />
        </View>
      </FormPanel>
    );
  }

  if (mode.type === 'create') {
    return (
      <FormPanel
        title={title}
        tabs={TABS}
        activeTab="create"
        onTabChange={handleTabChange}
        primaryAction={{ label: busy ? 'Creando...' : 'Crear', onPress: handleCreate, disabled: busy || !name.trim() }}
        secondaryAction={{ label: 'Cerrar', onPress: onClose, disabled: busy }}
      >
        <View style={formStyles.field}>
          <Text style={formStyles.label}>Nombre</Text>
          <TextInput style={formStyles.input} value={name} onChangeText={setName} placeholder="Nombre de la categoría" />
        </View>
        <View style={formStyles.field}>
          <Text style={formStyles.label}>Categoría padre (opcional)</Text>
          <View style={formStyles.chipRow}>
            <Pressable
              style={[formStyles.chip, parentId === '' && formStyles.chipActive]}
              onPress={() => setParentId('')}
            >
              <Text style={[formStyles.chipText, parentId === '' && formStyles.chipTextActive]}>Ninguna</Text>
            </Pressable>
            {categories.map((category) => (
              <Pressable
                key={category.id}
                style={[formStyles.chip, parentId === category.id && formStyles.chipActive]}
                onPress={() => setParentId(category.id)}
              >
                <Text style={[formStyles.chipText, parentId === category.id && formStyles.chipTextActive]}>
                  {category.categoryName}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </FormPanel>
    );
  }

  return (
    <FormPanel
      title={title}
      tabs={TABS}
      activeTab="list"
      onTabChange={handleTabChange}
      secondaryAction={{ label: 'Cerrar', onPress: onClose }}
    >
      {categories.length === 0 && <Text style={formStyles.hint}>Todavía no hay categorías.</Text>}
      {categories.map((category) => {
        const parent = category.parentCategoryId
          ? categories.find((c) => c.id === category.parentCategoryId)?.categoryName ?? '?'
          : 'Ninguna';
        return (
          <View key={category.id} style={styles.row}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowName} numberOfLines={1}>{category.categoryName}</Text>
              <Text style={styles.rowMeta} numberOfLines={1}>Padre: {parent}</Text>
            </View>
            <ManagerAction label="Renombrar" disabled={busy} onPress={() => startEdit(category)} />
            {deletableIds.includes(category.id) && (
              <ManagerAction danger label="Eliminar" disabled={busy} onPress={() => handleDelete(category.id)} />
            )}
          </View>
        );
      })}
    </FormPanel>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.md,
    backgroundColor: COLORS.surface,
  },
  rowInfo: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  rowMeta: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
});
