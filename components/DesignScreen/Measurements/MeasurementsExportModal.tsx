import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  formatMeasurement,
  MeasurementWall,
  ModuleElevation,
  WallView,
} from '../../../services/measurements';
import type { Room3dProps } from '../3dView/Room3d';
import {
  computeDocumentDimensions,
  computeWallGeometry,
  MeasurementExportOptions,
  MeasurementResolutionPreset,
} from '../../../services/measurementsExport';

const RESOLUTION_PRESETS: {
  id: MeasurementResolutionPreset;
  label: string;
  subtitle: string;
  targetWidth: number;
}[] = [
  { id: 'standard', label: 'Standard (1x)', subtitle: '1280 px width', targetWidth: 1280 },
  { id: 'high', label: 'High (1.5x)', subtitle: '1920 px width', targetWidth: 1920 },
  { id: 'ultra', label: 'Ultra (2.25x)', subtitle: '2880 px width', targetWidth: 2880 },
  { id: 'custom', label: 'Custom Width', subtitle: 'Proportional height', targetWidth: 1600 },
];

export default function MeasurementsExportModal({
  visible,
  onClose,
  currentWall,
  allWalls,
  room,
  currentModules,
  getModulesForWall,
  projectName,
  onExportWalls,
}: {
  visible: boolean;
  onClose: () => void;
  currentWall: MeasurementWall;
  allWalls: MeasurementWall[];
  room: Room3dProps;
  currentModules: ModuleElevation[];
  getModulesForWall: (wall: MeasurementWall) => ModuleElevation[];
  projectName?: string;
  onExportWalls: (
    wallsToExport: MeasurementWall[],
    options: MeasurementExportOptions,
    mode: 'single' | 'individual' | 'zip'
  ) => Promise<void>;
}) {
  const [resolutionPreset, setResolutionPreset] = useState<MeasurementResolutionPreset>('high');
  const [customWidthInput, setCustomWidthInput] = useState('1920');
  const [exportScope, setExportScope] = useState<'current' | 'selected'>('current');
  const [selectedWallViews, setSelectedWallViews] = useState<WallView[]>(
    allWalls.map((w) => w.view)
  );
  const [isExporting, setIsExporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const parsedCustomWidth = useMemo(() => {
    const num = parseInt(customWidthInput, 10);
    return Number.isFinite(num) && num >= 480 ? Math.min(4096, num) : 1600;
  }, [customWidthInput]);

  const exportOptions: MeasurementExportOptions = useMemo(
    () => ({
      resolutionPreset,
      customWidth: parsedCustomWidth,
      projectName,
    }),
    [resolutionPreset, parsedCustomWidth, projectName]
  );

  const currentGeometry = useMemo(
    () => computeWallGeometry(currentWall, room, currentModules),
    [currentWall, room, currentModules]
  );

  const currentDocDims = useMemo(
    () => computeDocumentDimensions(currentGeometry, exportOptions),
    [currentGeometry, exportOptions]
  );

  const toggleWallSelection = (view: WallView) => {
    setSelectedWallViews((prev) =>
      prev.includes(view) ? prev.filter((item) => item !== view) : [...prev, view]
    );
  };

  const toggleSelectAllWalls = () => {
    if (selectedWallViews.length === allWalls.length) {
      setSelectedWallViews([currentWall.view]);
    } else {
      setSelectedWallViews(allWalls.map((w) => w.view));
    }
  };

  const targetWalls = useMemo(() => {
    if (exportScope === 'current') return [currentWall];
    return allWalls.filter((w) => selectedWallViews.includes(w.view));
  }, [exportScope, currentWall, allWalls, selectedWallViews]);

  const handleTriggerExport = async (mode: 'single' | 'individual' | 'zip') => {
    if (targetWalls.length === 0) return;
    setIsExporting(true);
    setStatusMessage(
      targetWalls.length === 1
        ? `Rendering ${targetWalls[0].name} (${targetWalls[0].label})...`
        : `Rendering ${targetWalls.length} wall elevations...`
    );
    try {
      await onExportWalls(targetWalls, exportOptions, mode);
      setStatusMessage('Export complete!');
      setTimeout(() => setStatusMessage(null), 2000);
    } catch (err) {
      console.warn('Measurements export error:', err);
      setStatusMessage('Failed to export measurements image.');
    } finally {
      setIsExporting(false);
    }
  };

  const aspectDisplay = useMemo(() => {
    const ratio = currentDocDims.aspectRatio;
    return `${ratio.toFixed(2)} : 1`;
  }, [currentDocDims.aspectRatio]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={isExporting ? undefined : onClose} />

        <View style={styles.modalCard}>
          <View style={styles.headerRow}>
            <View style={styles.headerTitleGroup}>
              <Ionicons name="scan-outline" size={20} color="#0f172a" />
              <View>
                <Text style={styles.headerTitle}>Export Measurements Diagram</Text>
                <Text style={styles.headerSubtitle}>
                  Clean elevation diagram with module sizes and spacing measurements
                </Text>
              </View>
            </View>
            <Pressable
              style={styles.closeBtn}
              onPress={onClose}
              disabled={isExporting}
              accessibilityRole="button"
              accessibilityLabel="Close measurements export modal"
            >
              <Ionicons name="close" size={20} color="#334155" />
            </Pressable>
          </View>

          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent}>
            <View style={styles.section}>
              <View style={styles.sectionHeaderInline}>
                <Text style={styles.sectionTitle}>Proportional Resolution</Text>
                <View style={styles.aspectBadge}>
                  <Ionicons name="lock-closed-outline" size={12} color="#0f172a" />
                  <Text style={styles.aspectBadgeText}>Aspect Ratio Locked ({aspectDisplay})</Text>
                </View>
              </View>
              <Text style={styles.sectionHint}>
                Height is automatically calculated from the visible elevation bounds so proportions are never distorted.
              </Text>

              <View style={styles.presetGrid}>
                {RESOLUTION_PRESETS.map((preset) => {
                  const active = resolutionPreset === preset.id;
                  return (
                    <Pressable
                      key={preset.id}
                      style={[styles.presetBtn, active && styles.presetBtnActive]}
                      onPress={() => setResolutionPreset(preset.id)}
                    >
                      <Text style={[styles.presetBtnTitle, active && styles.presetBtnTitleActive]}>
                        {preset.label}
                      </Text>
                      <Text style={[styles.presetBtnSub, active && styles.presetBtnSubActive]}>
                        {preset.subtitle}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {resolutionPreset === 'custom' && (
                <View style={styles.customDimensionsRow}>
                  <View style={styles.dimInputField}>
                    <Text style={styles.dimInputLabel}>Target Width (px)</Text>
                    <TextInput
                      style={styles.dimInput}
                      value={customWidthInput}
                      onChangeText={setCustomWidthInput}
                      keyboardType="numeric"
                      placeholder="1920"
                    />
                  </View>
                  <View style={styles.dimInputField}>
                    <Text style={styles.dimInputLabel}>Auto Height (px, locked)</Text>
                    <View style={[styles.dimInput, styles.dimInputLocked]}>
                      <Text style={styles.dimInputLockedText}>{currentDocDims.targetHeight}</Text>
                    </View>
                  </View>
                </View>
              )}

              <View style={styles.outputSummaryBox}>
                <Ionicons name="resize-outline" size={16} color="#0f172a" />
                <Text style={styles.outputSummaryText}>
                  Output Size for {currentWall.name} ({currentWall.label}):{' '}
                  <Text style={styles.outputSummaryBold}>
                    {currentDocDims.targetWidth} × {currentDocDims.targetHeight} px
                  </Text>
                </Text>
              </View>
            </View>

            {allWalls.length > 1 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Wall Elevations to Export</Text>
                <View style={styles.scopeTabs}>
                  <Pressable
                    style={[styles.scopeTab, exportScope === 'current' && styles.scopeTabActive]}
                    onPress={() => setExportScope('current')}
                  >
                    <Text
                      style={[
                        styles.scopeTabText,
                        exportScope === 'current' && styles.scopeTabTextActive,
                      ]}
                    >
                      Active Wall Only ({currentWall.name} · {currentWall.label})
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.scopeTab, exportScope === 'selected' && styles.scopeTabActive]}
                    onPress={() => setExportScope('selected')}
                  >
                    <Text
                      style={[
                        styles.scopeTabText,
                        exportScope === 'selected' && styles.scopeTabTextActive,
                      ]}
                    >
                      Multiple Walls ({selectedWallViews.length}/{allWalls.length})
                    </Text>
                  </Pressable>
                </View>

                {exportScope === 'selected' && (
                  <View style={styles.wallSelectionList}>
                    <View style={styles.wallListHeader}>
                      <Text style={styles.wallListHeaderLabel}>Select elevations to generate</Text>
                      <Pressable onPress={toggleSelectAllWalls}>
                        <Text style={styles.selectAllLink}>
                          {selectedWallViews.length === allWalls.length
                            ? 'Select Active Only'
                            : 'Select All Walls'}
                        </Text>
                      </Pressable>
                    </View>
                    {allWalls.map((item) => {
                      const checked = selectedWallViews.includes(item.view);
                      const wallMods = getModulesForWall(item);
                      return (
                        <Pressable
                          key={item.view}
                          style={[styles.wallOptionRow, checked && styles.wallOptionRowActive]}
                          onPress={() => toggleWallSelection(item.view)}
                        >
                          <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                            {checked && <Ionicons name="checkmark" size={14} color="#fff" />}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.wallOptionTitle}>
                              {item.name} · {item.label} elevation
                            </Text>
                            <Text style={styles.wallOptionMeta}>
                              {formatMeasurement(item.width)} × {formatMeasurement(room.height)} mm ·{' '}
                              {wallMods.length} {wallMods.length === 1 ? 'module' : 'modules'}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {statusMessage && (
              <View style={styles.statusBanner}>
                {isExporting && <ActivityIndicator size="small" color="#0f172a" />}
                <Text style={styles.statusBannerText}>{statusMessage}</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.footerRow}>
            <Pressable style={styles.cancelButton} onPress={onClose} disabled={isExporting}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>

            {targetWalls.length <= 1 ? (
              <Pressable
                style={[
                  styles.primaryExportButton,
                  (isExporting || targetWalls.length === 0) && styles.disabledBtn,
                ]}
                disabled={isExporting || targetWalls.length === 0}
                onPress={() => handleTriggerExport('single')}
              >
                <Ionicons name="download-outline" size={17} color="#ffffff" />
                <Text style={styles.primaryExportButtonText}>Export PNG Image</Text>
              </Pressable>
            ) : (
              <View style={styles.multiExportButtons}>
                <Pressable
                  style={[styles.secondaryExportButton, isExporting && styles.disabledBtn]}
                  disabled={isExporting}
                  onPress={() => handleTriggerExport('individual')}
                >
                  <Ionicons name="images-outline" size={16} color="#0f172a" />
                  <Text style={styles.secondaryExportButtonText}>
                    Download Individually ({targetWalls.length})
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.primaryExportButton, isExporting && styles.disabledBtn]}
                  disabled={isExporting}
                  onPress={() => handleTriggerExport('zip')}
                >
                  <Ionicons name="archive-outline" size={16} color="#ffffff" />
                  <Text style={styles.primaryExportButtonText}>
                    Download as .zip ({targetWalls.length})
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '92%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#0f172a',
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
  },
  bodyScroll: {
    flexGrow: 0,
  },
  bodyContent: {
    padding: 20,
    gap: 20,
  },
  section: {
    gap: 10,
  },
  sectionHeaderInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  sectionHint: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  aspectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  aspectBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0f172a',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#64748b',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  checkboxChecked: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetBtn: {
    flex: 1,
    minWidth: 130,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    gap: 2,
  },
  presetBtnActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  presetBtnTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  presetBtnTitleActive: {
    color: '#ffffff',
  },
  presetBtnSub: {
    fontSize: 11,
    color: '#64748b',
  },
  presetBtnSubActive: {
    color: '#cbd5e1',
  },
  customDimensionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  dimInputField: {
    flex: 1,
    gap: 4,
  },
  dimInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  dimInput: {
    height: 40,
    borderWidth: 1,
    borderColor: '#94a3b8',
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
  },
  dimInputLocked: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
  },
  dimInputLockedText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  outputSummaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  outputSummaryText: {
    fontSize: 12,
    color: '#334155',
  },
  outputSummaryBold: {
    fontWeight: '700',
    color: '#0f172a',
  },
  scopeTabs: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  scopeTab: {
    flex: 1,
    minWidth: 180,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  scopeTabActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  scopeTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  scopeTabTextActive: {
    color: '#ffffff',
  },
  wallSelectionList: {
    gap: 8,
    marginTop: 4,
  },
  wallListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wallListHeaderLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  selectAllLink: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  wallOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  wallOptionRowActive: {
    borderColor: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  wallOptionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  wallOptionMeta: {
    fontSize: 11,
    color: '#64748b',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  statusBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  multiExportButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  primaryExportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#0f172a',
  },
  primaryExportButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  secondaryExportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0f172a',
    backgroundColor: '#ffffff',
  },
  secondaryExportButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  disabledBtn: {
    opacity: 0.45,
  },
});
