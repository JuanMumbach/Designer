import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Room3dProps, WallConfig, WallIdentifier, WallTileZone } from '../3dView/Room3d';
import { AppliedMaterial, DesignObject, GlobalMaterials, resolveGlobalMaterials } from '../3dView/DesignObjects';
import { resolveWallTileZones } from '../3dView/wallTiles';
import { MaterialCategory, MaterialData, MaterialMeta, MaterialType } from '../../../services/api';
import FormPanel, { formStyles } from '../../Editors/FormPanel';
import { InspectorRow, inspectorStyles } from '../../Catalogue/CatalogueView';
import MaterialPicker from './MaterialPicker';
import { COLORS, GLASS, RADII } from '../../../constants/theme';
import Thumbnail from '../../Thumbnail';

interface EditWallModalProps {
  wallId: WallIdentifier;
  room3d: Room3dProps;
  setRoom3d: React.Dispatch<React.SetStateAction<Room3dProps>>;
  materials: MaterialMeta[];
  materialCategories: MaterialCategory[];
  materialTypes?: MaterialType[];
  materialDataById?: Record<string, AppliedMaterial>;
  globalMaterials?: GlobalMaterials;
  designObjects: DesignObject[];
  onMaterialDataResolved?: (id: string, data: AppliedMaterial) => void;
  onClose: () => void;
  containerStyle?: StyleProp<ViewStyle>;
}

const WALL_NAMES: Record<WallIdentifier, string> = {
  back: 'Pared Trasera',
  left: 'Pared Izquierda',
  right: 'Pared Derecha',
};

const COLOR_SWATCHES = ['#ffffff', '#f4f3ef', '#e5e7eb', '#a9a58f', '#64748b', '#334155'];

export default function EditWallModal({
  wallId,
  room3d,
  setRoom3d,
  materials,
  materialCategories,
  materialTypes = [],
  materialDataById,
  globalMaterials,
  designObjects,
  onMaterialDataResolved,
  onClose,
  containerStyle,
}: EditWallModalProps) {
  const [activeTab, setActiveTab] = useState<'base' | 'tiles'>('base');
  const existingConfig = room3d.walls?.[wallId];

  const [draftConfig, setDraftConfig] = useState<WallConfig>({
    materialId: existingConfig?.materialId,
    color: existingConfig?.color || '#a9a58f',
    autoBacksplash: existingConfig?.autoBacksplash !== false,
    defaultTileMaterialId: existingConfig?.defaultTileMaterialId,
    defaultTileScale: existingConfig?.defaultTileScale ?? 1,
    tiles: existingConfig?.tiles ? [...existingConfig.tiles] : [],
  });

  const [pickerTarget, setPickerTarget] = useState<'wall' | 'defaultTile' | { manualTileId: string } | null>(null);

  const resolvedGlobals = useMemo(
    () => (globalMaterials ? resolveGlobalMaterials(globalMaterials) : {}),
    [globalMaterials]
  );
  const defaultGlobalTileId = resolvedGlobals['wall_tile'];
  const defaultGlobalWallId = resolvedGlobals['wall_base'];

  const wallWidth = wallId === 'back' ? room3d.width : room3d.depth;
  const wallHeight = room3d.height;
  const totalArea = Number((wallWidth * wallHeight).toFixed(2));

  const draftRoom: Room3dProps = useMemo(() => {
    return {
      ...room3d,
      walls: {
        ...room3d.walls,
        [wallId]: draftConfig,
      },
    };
  }, [room3d, wallId, draftConfig]);

  const activeTileZones = useMemo(() => {
    return resolveWallTileZones(
      wallId,
      draftRoom,
      designObjects,
      draftConfig.defaultTileMaterialId || defaultGlobalTileId
    );
  }, [wallId, draftRoom, designObjects, draftConfig.defaultTileMaterialId, defaultGlobalTileId]);

  const totalTiledArea = useMemo(() => {
    const area = activeTileZones.reduce((acc, t) => acc + t.width * t.height, 0);
    return Number(area.toFixed(2));
  }, [activeTileZones]);

  const netWallArea = Math.max(0, Number((totalArea - totalTiledArea).toFixed(2)));

  const effectiveBaseMaterialId = draftConfig.materialId || defaultGlobalWallId;
  const effectiveTileMaterialId = draftConfig.defaultTileMaterialId || defaultGlobalTileId;

  const baseMaterialMeta = materials.find((m) => m.id === effectiveBaseMaterialId);
  const defaultTileMaterialMeta = materials.find((m) => m.id === effectiveTileMaterialId);

  const typeNameById = useMemo(
    () => new Map(materialTypes.map((t) => [t.id, t.name])),
    [materialTypes]
  );

  const resolveMaterialTypeName = (material?: MaterialMeta): string | undefined => {
    if (!material) return undefined;
    return material.type?.name ?? (material.typeId ? typeNameById.get(material.typeId) : undefined);
  };

  const wallMaterials = useMemo(() => {
    const filtered = materials.filter((m) => {
      const typeName = m.type?.name ?? (m.typeId ? typeNameById.get(m.typeId) : undefined);
      const lower = typeName?.toLowerCase();
      return Boolean(lower && (lower.includes('wall') || lower.includes('pared')));
    });
    return filtered.length > 0 ? filtered : materials;
  }, [materials, typeNameById]);

  const tileMaterials = useMemo(() => {
    const filtered = materials.filter((m) => {
      const typeName = m.type?.name ?? (m.typeId ? typeNameById.get(m.typeId) : undefined);
      const lower = typeName?.toLowerCase();
      return Boolean(lower && (lower.includes('tile') || lower.includes('azulejo') || lower.includes('revestimiento')));
    });
    return filtered.length > 0 ? filtered : materials;
  }, [materials, typeNameById]);

  const handleSelectMaterial = async (meta: MaterialMeta, _data: MaterialData) => {
    if (_data?.fileURL) {
      onMaterialDataResolved?.(meta.id, {
        fileURL: _data.fileURL,
        scaleU: typeof _data.scaleU === 'number' ? _data.scaleU : (parseFloat(String(_data.scaleU).replace(',', '.')) || 1),
        scaleV: typeof _data.scaleV === 'number' ? _data.scaleV : (parseFloat(String(_data.scaleV).replace(',', '.')) || 1),
      });
    }
    if (pickerTarget === 'wall') {
      setDraftConfig((prev) => ({ ...prev, materialId: meta.id }));
    } else if (pickerTarget === 'defaultTile') {
      setDraftConfig((prev) => ({ ...prev, defaultTileMaterialId: meta.id }));
    } else if (pickerTarget && typeof pickerTarget === 'object' && 'manualTileId' in pickerTarget) {
      setDraftConfig((prev) => ({
        ...prev,
        tiles: (prev.tiles ?? []).map((t) =>
          t.id === pickerTarget.manualTileId ? { ...t, materialId: meta.id } : t
        ),
      }));
    }
    setPickerTarget(null);
  };

  const handleAddManualTile = () => {
    const newTile: WallTileZone = {
      id: `manual-${Date.now()}`,
      source: 'manual',
      start: 0,
      width: Math.min(1.2, wallWidth),
      bottom: 0.90,
      height: 0.60,
      materialId: draftConfig.defaultTileMaterialId || defaultGlobalTileId,
      color: '#e5e7eb',
    };
    setDraftConfig((prev) => ({
      ...prev,
      tiles: [...(prev.tiles ?? []), newTile],
    }));
  };

  const handleDeleteManualTile = (id: string) => {
    setDraftConfig((prev) => ({
      ...prev,
      tiles: (prev.tiles ?? []).filter((t) => t.id !== id),
    }));
  };

  const handleUpdateManualTile = (id: string, updates: Partial<WallTileZone>) => {
    setDraftConfig((prev) => ({
      ...prev,
      tiles: (prev.tiles ?? []).map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));
  };

  const handleSave = () => {
    setRoom3d((prev) => ({
      ...prev,
      walls: {
        ...prev.walls,
        [wallId]: draftConfig,
      },
    }));
    onClose();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, containerStyle]}>
          <FormPanel
            title={WALL_NAMES[wallId]}
            subtitle={`${wallWidth.toFixed(2)} m (ancho) × ${wallHeight.toFixed(2)} m (alto) · ${totalArea} m²`}
            tabs={[
              { key: 'base', label: 'Material Base' },
              { key: 'tiles', label: 'Azulejos / Salpicadero' },
            ]}
            activeTab={activeTab}
            onTabChange={(k) => setActiveTab(k as 'base' | 'tiles')}
            primaryAction={{ label: 'Guardar', onPress: handleSave }}
            secondaryAction={{ label: 'Cancelar', onPress: onClose }}
          >
            {activeTab === 'base' ? (
              <View style={styles.tabContent}>
                <Text style={inspectorStyles.sectionTitle}>Superficies</Text>
                <InspectorRow label="Dimensiones" value={`${wallWidth.toFixed(2)} m × ${wallHeight.toFixed(2)} m`} />
                <InspectorRow label="Área Total" value={`${totalArea} m²`} />
                <InspectorRow label="Área de Azulejos" value={`${totalTiledArea} m²`} />
                <InspectorRow label="Pared Neta Libre" value={`${netWallArea} m²`} />

                <Text style={[inspectorStyles.sectionTitle, { marginTop: 16 }]}>Revestimiento de Pared</Text>
                {baseMaterialMeta ? (
                  <View style={styles.materialSelectedCard}>
                    <Thumbnail uri={materialDataById?.[baseMaterialMeta.id]?.fileURL} size={54} radius={RADII.sm} />
                    <View style={styles.materialInfo}>
                      <Text style={styles.materialName} numberOfLines={1}>
                        {baseMaterialMeta.name}
                      </Text>
                      <Text style={styles.materialType}>
                        {resolveMaterialTypeName(baseMaterialMeta) ?? 'Revestimiento'}
                      </Text>
                    </View>
                    <Pressable
                      style={styles.actionBtn}
                      onPress={() => setPickerTarget('wall')}
                    >
                      <Text style={styles.actionBtnText}>Cambiar</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.actionBtn, styles.actionBtnDanger]}
                      onPress={() => setDraftConfig((prev) => ({ ...prev, materialId: undefined }))}
                    >
                      <Ionicons name="trash-outline" size={16} color={COLORS.error} />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    style={styles.pickMaterialPlaceholder}
                    onPress={() => setPickerTarget('wall')}
                  >
                    <Ionicons name="image-outline" size={24} color={GLASS.textMuted} />
                    <Text style={styles.pickPlaceholderText}>Seleccionar material de pared...</Text>
                  </Pressable>
                )}

                <Text style={[inspectorStyles.sectionTitle, { marginTop: 16 }]}>Color de Respaldo / Tono</Text>
                <View style={styles.swatchRow}>
                  {COLOR_SWATCHES.map((swatch) => (
                    <Pressable
                      key={swatch}
                      style={[
                        styles.swatch,
                        { backgroundColor: swatch },
                        draftConfig.color === swatch && styles.swatchActive,
                      ]}
                      onPress={() => setDraftConfig((prev) => ({ ...prev, color: swatch }))}
                    />
                  ))}
                  <TextInput
                    style={[formStyles.input, styles.colorInput]}
                    value={draftConfig.color || '#a9a58f'}
                    onChangeText={(txt) => setDraftConfig((prev) => ({ ...prev, color: txt }))}
                    placeholder="#hex"
                    autoCapitalize="none"
                  />
                </View>
              </View>
            ) : (
              <View style={styles.tabContent}>
                <View style={styles.toggleRow}>
                  <View style={styles.toggleInfo}>
                    <Text style={styles.toggleTitle}>Azulejos automáticos sobre mesadas</Text>
                    <Text style={styles.toggleDesc}>
                      Genera franjas sobre muebles bajo mesada (0.90 m a 1.50 m).
                    </Text>
                  </View>
                  <Switch
                    value={draftConfig.autoBacksplash !== false}
                    onValueChange={(val) => setDraftConfig((prev) => ({ ...prev, autoBacksplash: val }))}
                  />
                </View>

                {draftConfig.autoBacksplash !== false && (
                  <View style={styles.defaultTileBox}>
                    <Text style={formStyles.label}>Material por defecto para azulejos</Text>
                    {defaultTileMaterialMeta ? (
                      <View style={styles.materialSelectedCard}>
                        <Thumbnail uri={materialDataById?.[defaultTileMaterialMeta.id]?.fileURL} size={46} radius={RADII.sm} />
                        <View style={styles.materialInfo}>
                          <Text style={styles.materialName} numberOfLines={1}>
                            {defaultTileMaterialMeta.name}
                          </Text>
                          <Text style={styles.materialType}>
                            {resolveMaterialTypeName(defaultTileMaterialMeta) ?? 'Azulejo'}
                          </Text>
                        </View>
                        <Pressable
                          style={styles.actionBtn}
                          onPress={() => setPickerTarget('defaultTile')}
                        >
                          <Text style={styles.actionBtnText}>Cambiar</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable
                        style={styles.pickMaterialPlaceholder}
                        onPress={() => setPickerTarget('defaultTile')}
                      >
                        <Ionicons name="grid-outline" size={20} color={GLASS.textMuted} />
                        <Text style={styles.pickPlaceholderText}>Elegir azulejo para mesadas...</Text>
                      </Pressable>
                    )}
                  </View>
                )}

                <View style={styles.scaleSection}>
                  <Text style={formStyles.label}>Escala / Multiplicador de repetición</Text>
                  <View style={styles.scalePresetsRow}>
                    {[
                      { label: '0.5x (Grande)', value: 0.5 },
                      { label: '1x (Original)', value: 1 },
                      { label: '1.5x', value: 1.5 },
                      { label: '2x (Pequeño)', value: 2 },
                      { label: '3x', value: 3 },
                    ].map((preset) => {
                      const active = (draftConfig.defaultTileScale ?? 1) === preset.value;
                      return (
                        <Pressable
                          key={preset.value}
                          style={[styles.scalePresetChip, active && styles.scalePresetChipActive]}
                          onPress={() => setDraftConfig((prev) => ({ ...prev, defaultTileScale: preset.value }))}
                        >
                          <Text style={[styles.scalePresetText, active && styles.scalePresetTextActive]}>
                            {preset.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <View style={[formStyles.row, { marginTop: 8 }]}>
                    <Text style={[styles.controlLabel, { alignSelf: 'center', marginRight: 8 }]}>
                      Multiplicador:
                    </Text>
                    <TextInput
                      style={[styles.miniInput, { width: 80 }]}
                      keyboardType="decimal-pad"
                      value={String(draftConfig.defaultTileScale ?? 1)}
                      onChangeText={(txt) => {
                        const val = parseFloat(txt.replace(',', '.'));
                        setDraftConfig((prev) => ({ ...prev, defaultTileScale: isNaN(val) ? undefined : val }));
                      }}
                    />
                  </View>
                </View>

                <View style={styles.sectionHeader}>
                  <Text style={inspectorStyles.sectionTitle}>
                    Franjas de Azulejos ({activeTileZones.length})
                  </Text>
                  <Pressable style={styles.addBtn} onPress={handleAddManualTile}>
                    <Ionicons name="add" size={16} color={COLORS.primary} />
                    <Text style={styles.addBtnText}>Agregar franja</Text>
                  </Pressable>
                </View>

                {activeTileZones.length === 0 ? (
                  <Text style={styles.emptyNotice}>
                    No hay franjas de azulejos activas en esta pared.
                  </Text>
                ) : (
                  activeTileZones.map((tile) => {
                    const isManual = tile.source === 'manual';
                    const tileMat = materials.find((m) => m.id === tile.materialId);
                    return (
                      <View key={tile.id} style={styles.tileCard}>
                        <View style={styles.tileCardHeader}>
                          <View
                            style={[
                              styles.badge,
                              isManual ? styles.badgeManual : styles.badgeAuto,
                            ]}
                          >
                            <Text
                              style={[
                                styles.badgeText,
                                isManual ? styles.badgeTextManual : styles.badgeTextAuto,
                              ]}
                            >
                              {isManual ? 'Manual' : 'Auto (Mesada)'}
                            </Text>
                          </View>
                          {isManual && (
                            <Pressable
                              onPress={() => handleDeleteManualTile(tile.id)}
                              hitSlop={8}
                            >
                              <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                            </Pressable>
                          )}
                        </View>

                        {isManual ? (
                          <View style={styles.manualControls}>
                            <View style={formStyles.row}>
                              <View style={formStyles.rowItem}>
                                <Text style={styles.controlLabel}>Inicio (m)</Text>
                                <TextInput
                                  style={styles.miniInput}
                                  keyboardType="decimal-pad"
                                  value={String(tile.start)}
                                  onChangeText={(txt) =>
                                    handleUpdateManualTile(tile.id, {
                                      start: Number(txt.replace(',', '.')) || 0,
                                    })
                                  }
                                />
                              </View>
                              <View style={formStyles.rowItem}>
                                <Text style={styles.controlLabel}>Ancho (m)</Text>
                                <TextInput
                                  style={styles.miniInput}
                                  keyboardType="decimal-pad"
                                  value={String(tile.width)}
                                  onChangeText={(txt) =>
                                    handleUpdateManualTile(tile.id, {
                                      width: Number(txt.replace(',', '.')) || 0.1,
                                    })
                                  }
                                />
                              </View>
                              <View style={formStyles.rowItem}>
                                <Text style={styles.controlLabel}>Alto (m)</Text>
                                <TextInput
                                  style={styles.miniInput}
                                  keyboardType="decimal-pad"
                                  value={String(tile.height)}
                                  onChangeText={(txt) =>
                                    handleUpdateManualTile(tile.id, {
                                      height: Number(txt.replace(',', '.')) || 0.1,
                                    })
                                  }
                                />
                              </View>
                              <View style={formStyles.rowItem}>
                                <Text style={styles.controlLabel}>Escala (x)</Text>
                                <TextInput
                                  style={styles.miniInput}
                                  keyboardType="decimal-pad"
                                  value={String(tile.tileScale ?? draftConfig.defaultTileScale ?? 1)}
                                  onChangeText={(txt) =>
                                    handleUpdateManualTile(tile.id, {
                                      tileScale: Number(txt.replace(',', '.')) || 1,
                                    })
                                  }
                                />
                              </View>
                            </View>
                            <Pressable
                              style={styles.miniPickerBtn}
                              onPress={() => setPickerTarget({ manualTileId: tile.id })}
                            >
                              <Text style={styles.miniPickerText} numberOfLines={1}>
                                {tileMat?.name ? `Azulejo: ${tileMat.name}` : 'Seleccionar azulejo...'}
                              </Text>
                            </Pressable>
                          </View>
                        ) : (
                          <View style={styles.autoDetails}>
                            <Text style={styles.tileMetrics}>
                              Inicio: {tile.start.toFixed(2)} m · Ancho: {tile.width.toFixed(2)} m
                            </Text>
                            <Text style={styles.tileMetrics}>
                              Elevación: {tile.bottom.toFixed(2)} m a {(tile.bottom + tile.height).toFixed(2)} m (Alto: {tile.height.toFixed(2)} m)
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </View>
            )}
          </FormPanel>
        </View>
      </View>

      {pickerTarget !== null && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setPickerTarget(null)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.pickerModalContainer}>
              <MaterialPicker
                materials={pickerTarget === 'wall' ? wallMaterials : tileMaterials}
                categories={materialCategories}
                onSelect={handleSelectMaterial}
                onClose={() => setPickerTarget(null)}
              />
            </View>
          </View>
        </Modal>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: 440,
    maxWidth: '100%',
    maxHeight: '90%',
    backgroundColor: COLORS.surface,
    borderRadius: RADII.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  tabContent: {
    gap: 10,
  },
  materialSelectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: COLORS.bgAlt,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  thumb: {
    backgroundColor: COLORS.surfaceAlt,
  },
  materialInfo: {
    flex: 1,
  },
  materialName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  materialType: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADII.sm,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  actionBtnDanger: {
    borderColor: 'transparent',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  pickMaterialPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgAlt,
  },
  pickPlaceholderText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  swatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  swatchActive: {
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  colorInput: {
    width: 90,
    minHeight: 36,
    fontSize: 13,
    textAlign: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  toggleDesc: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  defaultTileBox: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  scaleSection: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  scalePresetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  scalePresetChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: RADII.sm,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  scalePresetChipActive: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
  },
  scalePresetText: {
    fontSize: 12,
    color: COLORS.text,
  },
  scalePresetTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  emptyNotice: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: 14,
  },
  tileCard: {
    padding: 12,
    backgroundColor: COLORS.bgAlt,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  tileCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: RADII.pill,
  },
  badgeAuto: {
    backgroundColor: COLORS.primarySoft,
  },
  badgeManual: {
    backgroundColor: COLORS.surfaceAlt,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  badgeTextAuto: {
    color: COLORS.primary,
  },
  badgeTextManual: {
    color: COLORS.textMuted,
  },
  autoDetails: {
    gap: 2,
  },
  tileMetrics: {
    fontSize: 12,
    color: COLORS.text,
  },
  manualControls: {
    gap: 8,
  },
  controlLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  miniInput: {
    height: 36,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.sm,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 8,
    fontSize: 13,
    color: COLORS.text,
  },
  miniPickerBtn: {
    padding: 8,
    borderRadius: RADII.sm,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  miniPickerText: {
    fontSize: 12,
    color: COLORS.text,
  },
  pickerModalContainer: {
    width: 440,
    maxWidth: '100%',
    maxHeight: '85%',
  },
});
