import Button from "@/components/Button";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { DesignObject, TextureOverride } from "../3dView/DesignObjects";
import { MaterialCategory, MaterialMeta, MaterialData } from "../../../services/api";
import MaterialPicker from "./MaterialPicker";

export default function EditFurnitureInstanceMenu({object, onEditComplete, onDelete, materials, materialCategories} : {
        object : DesignObject,
        onEditComplete : (id: string, updates: { name: string, position: [number, number, number], textureOverrides?: TextureOverride[] }) => void,
        onDelete? : (id: string) => void,
        materials: MaterialMeta[],
        materialCategories: MaterialCategory[],
    }){

    const [name, onChangeName] = useState(object.name);
    const [positionX, setPositionX] = useState(object.position?.[0]?.toString() ?? '0');
    const [positionY, setPositionY] = useState(object.position?.[1]?.toString() ?? '0');
    const [positionZ, setPositionZ] = useState(object.position?.[2]?.toString() ?? '0');
    const [dirtyOverrides, setDirtyOverrides] = useState<TextureOverride[]>(object.textureOverrides || []);
    const [editingSlot, setEditingSlot] = useState<string | null>(null);
    const editingSlotRef = useRef<string | null>(null);
    editingSlotRef.current = editingSlot;

    const handleSave = () => {
        onEditComplete(object.id, {
            name: name,
            position: [
                parseFloat(positionX) || 0,
                parseFloat(positionY) || 0,
                parseFloat(positionZ) || 0
            ],
            textureOverrides: dirtyOverrides,
        });
    };

    useEffect(() => {
        onChangeName(object.name);
        setPositionX(object.position?.[0]?.toString() ?? '0');
        setPositionY(object.position?.[1]?.toString() ?? '0');
        setPositionZ(object.position?.[2]?.toString() ?? '0');
        setDirtyOverrides(object.textureOverrides || []);
      }, [object]);

    const handleDelete = () => {
        if (Platform.OS === 'web') {
            if (window.confirm('Are you sure you want to delete this object?')) {
                if (onDelete) onDelete(object.id);
            }
        } else {
            Alert.alert('Delete Object', 'Are you sure you want to delete this object?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => {
                    if (onDelete) onDelete(object.id);
                }},
            ]);
        }
    };

    const handleMaterialSelect = useCallback(async (_materialMeta: MaterialMeta, materialData: MaterialData) => {
        const slot = editingSlotRef.current;
        if (!slot) return;
        const newOverride: TextureOverride = {
            meshName: slot,
            materialId: _materialMeta.id,
            version: materialData.version,
            fileURL: materialData.fileURL,
            scaleU: materialData.scaleU,
            scaleV: materialData.scaleV,
        };
        setDirtyOverrides(prev => {
            const existing = prev.findIndex(o => o.meshName === slot);
            if (existing >= 0) {
                return prev.map((o, i) => i === existing ? newOverride : o);
            }
            return [...prev, newOverride];
        });
        setEditingSlot(null);
    }, []);

    const handleResetSlot = (meshName: string) => {
        setDirtyOverrides(prev => prev.filter(o => o.meshName !== meshName));
    };

    const getMaterialName = (materialId: string): string => {
        return materials.find(m => m.id === materialId)?.name ?? 'Unknown';
    };

    if (editingSlot) {
        return (
            <MaterialPicker
                materials={materials}
                categories={materialCategories}
                onSelect={handleMaterialSelect}
                onClose={() => setEditingSlot(null)}
            />
        );
    }

    return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <TextInput style={styles.input} onChangeText={onChangeName} value={name} placeholder={object.name} />
        <Text>Type: {object.name}</Text>
        <Text style={styles.label}>Position X</Text>
              <TextInput style={styles.input}
                onChangeText={setPositionX}
                value={positionX}
                keyboardType="numeric"
              />
        <Text style={styles.label}>Position Y</Text>
                <TextInput style={styles.input}
                    onChangeText={setPositionY}
                    value={positionY}
                    keyboardType="numeric"
                />
        <Text style={styles.label}>Position Z</Text>
                <TextInput style={styles.input}
                    onChangeText={setPositionZ}
                    value={positionZ}
                    keyboardType="numeric"
                />

        {object.meshNames && object.meshNames.length > 0 && (
            <>
                <Text style={styles.sectionTitle}>Textures</Text>
                {object.meshNames.map(meshName => {
                    const override = dirtyOverrides.find(o => o.meshName === meshName);
                    return (
                        <View key={meshName} style={styles.textureRow}>
                            <View style={styles.textureInfo}>
                                <Text style={styles.textureMeshName}>{meshName}</Text>
                                <Text style={styles.textureStatus}>
                                    {override ? getMaterialName(override.materialId) : 'Default'}
                                </Text>
                            </View>
                            <View style={styles.textureActions}>
                                <Pressable
                                    style={styles.textureButton}
                                    onPress={() => setEditingSlot(meshName)}
                                >
                                    <Text style={styles.textureButtonLabel}>Change</Text>
                                </Pressable>
                                {override && (
                                    <Pressable
                                        style={styles.textureResetButton}
                                        onPress={() => handleResetSlot(meshName)}
                                    >
                                        <Text style={styles.textureResetLabel}>Reset</Text>
                                    </Pressable>
                                )}
                            </View>
                        </View>
                    );
                })}
            </>
        )}

        {(!object.meshNames || object.meshNames.length === 0) && (
            <Text style={styles.discoveringText}>Discovering textures...</Text>
        )}

        <Button label="Save Changes" onPress={handleSave} />
        <Pressable style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonLabel}>Delete Object</Text>
        </Pressable>
      </ScrollView>
    </View>
    );
};

const styles = StyleSheet.create({
  container: {
    width: 300,
    maxHeight: '100%',
    backgroundColor: 'white',
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
    overflow: 'hidden',
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  label: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    height: 44,
    borderColor: '#e5e7eb',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
    backgroundColor: '#f9fafb',
    fontSize: 14,
    color: '#111827',
  },
  sectionTitle: {
    marginTop: 20,
    marginBottom: 12,
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  textureInfo: {
    flex: 1,
    marginRight: 8,
  },
  textureMeshName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  textureStatus: {
    fontSize: 11,
    color: '#6b7280',
  },
  textureActions: {
    flexDirection: 'row',
    gap: 6,
  },
  textureButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#2563eb',
  },
  textureButtonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  textureResetButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  textureResetLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  discoveringText: {
    marginTop: 12,
    fontStyle: 'italic',
    color: '#9ca3af',
    fontSize: 13,
    textAlign: 'center',
  },
  deleteButton: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    backgroundColor: '#dc2626',
  },
  deleteButtonLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  }
});
