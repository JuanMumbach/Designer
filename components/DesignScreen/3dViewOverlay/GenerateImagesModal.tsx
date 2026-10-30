import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { generateUUID } from 'three/src/math/MathUtils.js';
import { COLORS, GLASS, RADII } from '../../../constants/theme';
import { SavedView, SavedViewResolution } from '../../../services/currentProject';
import {
  buildImageFilename,
  downloadImagesAsZip,
  downloadImagesIndividually,
  downloadSingleImage,
  ExportImageItem,
  sanitizeFilenamePart,
} from '../../../services/imageExport';
import { ThumbnailCaptureApi } from '../../../services/thumbnailCapture';
import GlassSurface from './GlassSurface';

export interface ResolutionPresetOption {
  key: string;
  label: string;
  subtitle: string;
  width: number;
  height: number;
}

export const RESOLUTION_PRESETS: ResolutionPresetOption[] = [
  { key: '1920x1080', label: '1920×1080', subtitle: '16:9 FHD', width: 1920, height: 1080 },
  { key: '1080x1920', label: '1080×1920', subtitle: '9:16 Vertical', width: 1080, height: 1920 },
  { key: '1080x1080', label: '1080×1080', subtitle: '1:1 Square', width: 1080, height: 1080 },
  { key: '2560x1440', label: '2560×1440', subtitle: '16:9 QHD', width: 2560, height: 1440 },
];

export interface FramingSessionState {
  mode: 'create' | 'edit';
  viewId: string;
  name: string;
  resolution: SavedViewResolution;
  returnToEditModal?: boolean;
  initialCamera: {
    position: [number, number, number];
    target: [number, number, number];
    fov: number;
    zoom?: number;
  };
}

interface GenerateImagesModalProps {
  visible: boolean;
  onClose: () => void;
  savedViews: SavedView[];
  setSavedViews: React.Dispatch<React.SetStateAction<SavedView[]>>;
  captureApi: ThumbnailCaptureApi;
  projectName: string;
  onStartFraming: (session: FramingSessionState) => void;
  reopenEditViewId?: string | null;
  onClearReopenEditView?: () => void;
}

function ResolutionSelector({
  value,
  onChange,
}: {
  value: SavedViewResolution;
  onChange: (next: SavedViewResolution) => void;
}) {
  const [customW, setCustomW] = useState(String(value.width));
  const [customH, setCustomH] = useState(String(value.height));

  useEffect(() => {
    setCustomW(String(value.width));
    setCustomH(String(value.height));
  }, [value.width, value.height]);

  const selectPreset = (preset: ResolutionPresetOption) => {
    setCustomW(String(preset.width));
    setCustomH(String(preset.height));
    onChange({
      preset: preset.key,
      width: preset.width,
      height: preset.height,
    });
  };

  const selectCustom = () => {
    const w = Math.max(64, Math.min(8192, parseInt(customW, 10) || value.width || 1920));
    const h = Math.max(64, Math.min(8192, parseInt(customH, 10) || value.height || 1080));
    onChange({
      preset: 'custom',
      width: w,
      height: h,
    });
  };

  const handleWidthText = (txt: string) => {
    setCustomW(txt);
    const parsed = parseInt(txt, 10);
    if (Number.isFinite(parsed) && parsed >= 64 && parsed <= 8192) {
      onChange({
        preset: 'custom',
        width: parsed,
        height: value.height,
      });
    }
  };

  const handleHeightText = (txt: string) => {
    setCustomH(txt);
    const parsed = parseInt(txt, 10);
    if (Number.isFinite(parsed) && parsed >= 64 && parsed <= 8192) {
      onChange({
        preset: 'custom',
        width: value.width,
        height: parsed,
      });
    }
  };

  return (
    <View style={styles.resolutionContainer}>
      <View style={styles.presetGrid}>
        {RESOLUTION_PRESETS.map((preset) => {
          const active = value.preset === preset.key;
          return (
            <Pressable
              key={preset.key}
              style={[styles.presetChip, active && styles.presetChipActive]}
              onPress={() => selectPreset(preset)}
            >
              <Text style={[styles.presetLabel, active && styles.presetLabelActive]}>
                {preset.label}
              </Text>
              <Text style={[styles.presetSubtitle, active && styles.presetSubtitleActive]}>
                {preset.subtitle}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          style={[styles.presetChip, value.preset === 'custom' && styles.presetChipActive]}
          onPress={selectCustom}
        >
          <Text style={[styles.presetLabel, value.preset === 'custom' && styles.presetLabelActive]}>
            Custom
          </Text>
          <Text
            style={[
              styles.presetSubtitle,
              value.preset === 'custom' && styles.presetSubtitleActive,
            ]}
          >
            Arbitrary px
          </Text>
        </Pressable>
      </View>

      {value.preset === 'custom' && (
        <View style={styles.customInputsRow}>
          <View style={styles.customInputField}>
            <Text style={styles.fieldMiniLabel}>Width (px)</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={customW}
              onChangeText={handleWidthText}
              placeholder="1920"
              placeholderTextColor={GLASS.textFaint}
            />
          </View>
          <Text style={styles.dimensionMultiply}>×</Text>
          <View style={styles.customInputField}>
            <Text style={styles.fieldMiniLabel}>Height (px)</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={customH}
              onChangeText={handleHeightText}
              placeholder="1080"
              placeholderTextColor={GLASS.textFaint}
            />
          </View>
        </View>
      )}
    </View>
  );
}

function SavedViewEditorModal({
  visible,
  mode,
  view,
  draftName,
  setDraftName,
  draftResolution,
  setDraftResolution,
  onClose,
  onSaveMetadata,
  onFrameCamera,
}: {
  visible: boolean;
  mode: 'create' | 'edit';
  view?: SavedView | null;
  draftName: string;
  setDraftName: (name: string) => void;
  draftResolution: SavedViewResolution;
  setDraftResolution: (res: SavedViewResolution) => void;
  onClose: () => void;
  onSaveMetadata: () => void;
  onFrameCamera: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.subModalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <GlassSurface style={styles.editorModalCard} blurIntensity={70}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons
                name={mode === 'create' ? 'add-circle-outline' : 'options-outline'}
                size={20}
                color={COLORS.primary}
              />
              <Text style={styles.headerTitle}>
                {mode === 'create' ? 'Create New Saved View' : `Edit View: ${view?.name || ''}`}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeIconBtn}>
              <Ionicons name="close" size={20} color={GLASS.text} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.editorModalBody}
            keyboardShouldPersistTaps="handled"
          >
            {mode === 'edit' && view && (
              <View style={styles.editorPreviewSection}>
                <View style={styles.editorPreviewFrame}>
                  {view.previewDataUrl ? (
                    <Image
                      source={{ uri: view.previewDataUrl }}
                      style={styles.editorPreviewImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.editorPreviewPlaceholder}>
                      <Ionicons name="image-outline" size={28} color={GLASS.textFaint} />
                      <Text style={styles.editorPreviewPlaceholderText}>Generating preview...</Text>
                    </View>
                  )}
                  <View style={styles.editorPreviewBadge}>
                    <Text style={styles.editorPreviewBadgeText}>
                      {draftResolution.width} × {draftResolution.height} px
                    </Text>
                  </View>
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.reframeCameraBtn,
                    pressed && styles.secondaryActionBtnPressed,
                  ]}
                  onPress={onFrameCamera}
                >
                  <Ionicons name="scan-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.secondaryActionBtnText}>
                    Adjust Camera Framing in 3D Viewport
                  </Text>
                </Pressable>
              </View>
            )}

            <View style={styles.editorFormField}>
              <Text style={styles.fieldLabel}>View Name</Text>
              <TextInput
                style={styles.input}
                value={draftName}
                onChangeText={setDraftName}
                placeholder="e.g., Kitchen Island Perspective"
                placeholderTextColor={GLASS.textFaint}
              />
            </View>

            <View style={styles.editorFormField}>
              <Text style={styles.fieldLabel}>Target Resolution & Aspect Ratio</Text>
              <ResolutionSelector value={draftResolution} onChange={setDraftResolution} />
            </View>
          </ScrollView>

          <View style={styles.editorModalFooter}>
            <Pressable
              style={({ pressed }) => [
                styles.cancelModalBtn,
                pressed && styles.secondaryActionBtnPressed,
              ]}
              onPress={onClose}
            >
              <Text style={styles.cancelModalBtnText}>Cancel</Text>
            </Pressable>

            {mode === 'create' ? (
              <Pressable
                style={({ pressed }) => [
                  styles.primaryActionBtn,
                  pressed && styles.primaryActionBtnPressed,
                ]}
                onPress={onFrameCamera}
              >
                <Ionicons name="scan-outline" size={17} color={COLORS.white} />
                <Text style={styles.primaryActionBtnText}>Frame Camera Position in 3D</Text>
              </Pressable>
            ) : (
              <Pressable
                style={({ pressed }) => [
                  styles.primaryActionBtn,
                  pressed && styles.primaryActionBtnPressed,
                ]}
                onPress={onSaveMetadata}
              >
                <Ionicons name="checkmark" size={17} color={COLORS.white} />
                <Text style={styles.primaryActionBtnText}>Save Changes</Text>
              </Pressable>
            )}
          </View>
        </GlassSurface>
      </View>
    </Modal>
  );
}

export default function GenerateImagesModal({
  visible,
  onClose,
  savedViews,
  setSavedViews,
  captureApi,
  projectName,
  onStartFraming,
  reopenEditViewId,
  onClearReopenEditView,
}: GenerateImagesModalProps) {
  const [activeTab, setActiveTab] = useState<'views' | 'current'>('views');
  const [currentResolution, setCurrentResolution] = useState<SavedViewResolution>({
    preset: '1920x1080',
    width: 1920,
    height: 1080,
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editorModalMode, setEditorModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftResolution, setDraftResolution] = useState<SavedViewResolution>({
    preset: '1920x1080',
    width: 1920,
    height: 1080,
  });

  const [busy, setBusy] = useState(false);
  const [progressText, setProgressText] = useState<string | null>(null);
  const generatingPreviewsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (visible && reopenEditViewId) {
      const target = savedViews.find((v) => v.id === reopenEditViewId);
      if (target) {
        setDraftName(target.name);
        setDraftResolution({ ...target.resolution });
        setEditingViewId(target.id);
        setEditorModalMode('edit');
      }
      onClearReopenEditView?.();
    }
  }, [visible, reopenEditViewId, savedViews, onClearReopenEditView]);

  useEffect(() => {
    if (!visible || busy) return;
    let cancelled = false;

    const generateMissingPreviews = async () => {
      for (const view of savedViews) {
        if (cancelled) break;
        if (view.previewDataUrl || generatingPreviewsRef.current.has(view.id)) continue;
        generatingPreviewsRef.current.add(view.id);
        try {
          const aspect = view.resolution.width / Math.max(1, view.resolution.height);
          const thumbW = aspect >= 1 ? 320 : Math.max(120, Math.round(320 * aspect));
          const thumbH = aspect >= 1 ? Math.max(120, Math.round(320 / aspect)) : 320;
          const captured = await captureApi.captureImage({
            width: thumbW,
            height: thumbH,
            cameraPosition: view.cameraPosition,
            cameraTarget: view.cameraTarget,
            fov: view.fov,
            zoom: view.zoom,
          });
          if (captured && !cancelled) {
            const dataUrl = `data:image/png;base64,${captured.base64}`;
            setSavedViews((prev) =>
              prev.map((v) => (v.id === view.id ? { ...v, previewDataUrl: dataUrl } : v))
            );
          }
        } catch (err) {
          console.warn('Could not generate view preview:', err);
        } finally {
          generatingPreviewsRef.current.delete(view.id);
        }
      }
    };

    generateMissingPreviews();
    return () => {
      cancelled = true;
    };
  }, [visible, busy, savedViews, captureApi, setSavedViews]);

  const validSelectedIds = useMemo(() => {
    const valid = new Set<string>();
    for (const view of savedViews) {
      if (selectedIds.has(view.id)) valid.add(view.id);
    }
    return valid;
  }, [savedViews, selectedIds]);

  const allSelected = savedViews.length > 0 && validSelectedIds.size === savedViews.length;

  const toggleSelectView = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(savedViews.map((v) => v.id)));
    }
  };

  const handleCaptureCurrentView = async () => {
    setBusy(true);
    setProgressText('Capturing current viewport...');
    try {
      const captured = await captureApi.captureImage({
        width: currentResolution.width,
        height: currentResolution.height,
      });
      if (!captured) {
        Alert.alert('Error', 'Could not capture the current viewport.');
        return;
      }
      const filename = buildImageFilename(
        projectName,
        'CurrentView',
        captured.width,
        captured.height
      );
      await downloadSingleImage({
        filename,
        bytes: captured.bytes,
        base64: captured.base64,
        dataUrl: captured.uri,
      });
    } catch (err) {
      console.error('Current view capture error:', err);
      Alert.alert('Error', 'Failed to export image.');
    } finally {
      setBusy(false);
      setProgressText(null);
    }
  };

  const beginCreateView = () => {
    const nextNumber = savedViews.length + 1;
    setDraftName(`View ${nextNumber}`);
    setDraftResolution({
      preset: '1920x1080',
      width: 1920,
      height: 1080,
    });
    setEditingViewId(null);
    setEditorModalMode('create');
  };

  const beginEditView = (view: SavedView) => {
    setDraftName(view.name);
    setDraftResolution({ ...view.resolution });
    setEditingViewId(view.id);
    setEditorModalMode('edit');
  };

  const closeEditorModal = () => {
    setEditorModalMode(null);
    setEditingViewId(null);
  };

  const handleSaveEditedMetadata = async () => {
    if (!editingViewId) return;
    const existing = savedViews.find((v) => v.id === editingViewId);
    const trimmed = draftName.trim() || 'Untitled View';
    const aspectChanged =
      existing &&
      (existing.resolution.width !== draftResolution.width ||
        existing.resolution.height !== draftResolution.height);

    let updatedPreview = existing?.previewDataUrl;
    if (existing && aspectChanged) {
      try {
        const aspect = draftResolution.width / Math.max(1, draftResolution.height);
        const thumbW = aspect >= 1 ? 320 : Math.max(120, Math.round(320 * aspect));
        const thumbH = aspect >= 1 ? Math.max(120, Math.round(320 / aspect)) : 320;
        const captured = await captureApi.captureImage({
          width: thumbW,
          height: thumbH,
          cameraPosition: existing.cameraPosition,
          cameraTarget: existing.cameraTarget,
          fov: existing.fov,
          zoom: existing.zoom,
        });
        if (captured) {
          updatedPreview = `data:image/png;base64,${captured.base64}`;
        }
      } catch (err) {
        console.warn('Could not refresh preview for new aspect ratio:', err);
      }
    }

    setSavedViews((prev) =>
      prev.map((v) =>
        v.id === editingViewId
          ? {
              ...v,
              name: trimmed,
              resolution: { ...draftResolution },
              previewDataUrl: updatedPreview,
            }
          : v
      )
    );
    closeEditorModal();
  };

  const handleEnterFramingFromModal = () => {
    if (editorModalMode === 'create') {
      const cam = captureApi.getCameraState();
      const trimmed = draftName.trim() || `View ${savedViews.length + 1}`;
      closeEditorModal();
      onStartFraming({
        mode: 'create',
        viewId: generateUUID(),
        name: trimmed,
        resolution: { ...draftResolution },
        returnToEditModal: false,
        initialCamera: {
          position: cam.position,
          target: cam.target,
          fov: cam.fov,
          zoom: cam.zoom,
        },
      });
      return;
    }

    const target = savedViews.find((v) => v.id === editingViewId);
    if (!target) return;
    const trimmed = draftName.trim() || target.name;
    const nextRes = { ...draftResolution };
    closeEditorModal();
    onStartFraming({
      mode: 'edit',
      viewId: target.id,
      name: trimmed,
      resolution: nextRes,
      returnToEditModal: true,
      initialCamera: {
        position: [...target.cameraPosition],
        target: [...target.cameraTarget],
        fov: target.fov,
        zoom: target.zoom,
      },
    });
  };

  const handleEnterFramingDirect = (view: SavedView) => {
    closeEditorModal();
    onStartFraming({
      mode: 'edit',
      viewId: view.id,
      name: view.name,
      resolution: { ...view.resolution },
      returnToEditModal: false,
      initialCamera: {
        position: [...view.cameraPosition],
        target: [...view.cameraTarget],
        fov: view.fov,
        zoom: view.zoom,
      },
    });
  };

  const handleDeleteView = (id: string) => {
    setSavedViews((prev) => prev.filter((v) => v.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (editingViewId === id) {
      closeEditorModal();
    }
  };

  const generateViewsBatch = async (
    viewsToRender: SavedView[],
    exportMode: 'individual' | 'zip'
  ) => {
    if (viewsToRender.length === 0) return;
    setBusy(true);
    try {
      const generatedItems: ExportImageItem[] = [];
      for (let i = 0; i < viewsToRender.length; i++) {
        const view = viewsToRender[i];
        setProgressText(`Rendering "${view.name}" (${i + 1}/${viewsToRender.length})...`);
        await new Promise((r) => setTimeout(r, 40));
        const captured = await captureApi.captureImage({
          width: view.resolution.width,
          height: view.resolution.height,
          cameraPosition: view.cameraPosition,
          cameraTarget: view.cameraTarget,
          fov: view.fov,
          zoom: view.zoom,
        });
        if (captured) {
          generatedItems.push({
            filename: buildImageFilename(
              projectName,
              view.name,
              captured.width,
              captured.height
            ),
            bytes: captured.bytes,
            base64: captured.base64,
            dataUrl: captured.uri,
          });
        }
      }

      if (generatedItems.length === 0) {
        Alert.alert('Error', 'No images could be generated.');
        return;
      }

      setProgressText(
        exportMode === 'zip' ? 'Creating .zip archive...' : 'Downloading images...'
      );

      if (exportMode === 'zip') {
        const safeProj = sanitizeFilenamePart(projectName || 'Project', 'Project');
        await downloadImagesAsZip(generatedItems, `${safeProj}_Views.zip`);
      } else if (generatedItems.length === 1) {
        await downloadSingleImage(generatedItems[0]);
      } else {
        await downloadImagesIndividually(generatedItems);
      }
    } catch (err) {
      console.error('Batch view export error:', err);
      Alert.alert('Error', 'Failed to export camera views.');
    } finally {
      setBusy(false);
      setProgressText(null);
    }
  };

  const selectedViewsList = useMemo(
    () => savedViews.filter((v) => validSelectedIds.has(v.id)),
    [savedViews, validSelectedIds]
  );

  const activeEditingView = useMemo(
    () => savedViews.find((v) => v.id === editingViewId) ?? null,
    [savedViews, editingViewId]
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <GlassSurface style={styles.modalCard} blurIntensity={65}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="camera-outline" size={20} color={COLORS.primary} />
              <Text style={styles.headerTitle}>Camera Views & Image Generation</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeIconBtn} disabled={busy}>
              <Ionicons name="close" size={20} color={GLASS.text} />
            </Pressable>
          </View>

          <View style={styles.tabsRow}>
            <Pressable
              style={[styles.tabBtn, activeTab === 'views' && styles.tabBtnActive]}
              onPress={() => setActiveTab('views')}
            >
              <Ionicons
                name="albums-outline"
                size={15}
                color={activeTab === 'views' ? COLORS.primary : GLASS.textMuted}
              />
              <Text style={[styles.tabBtnText, activeTab === 'views' && styles.tabBtnTextActive]}>
                Saved Views ({savedViews.length})
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tabBtn, activeTab === 'current' && styles.tabBtnActive]}
              onPress={() => setActiveTab('current')}
            >
              <Ionicons
                name="aperture-outline"
                size={15}
                color={activeTab === 'current' ? COLORS.primary : GLASS.textMuted}
              />
              <Text style={[styles.tabBtnText, activeTab === 'current' && styles.tabBtnTextActive]}>
                Capture Current View
              </Text>
            </Pressable>
          </View>

          {busy && (
            <View style={styles.busyBanner}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.busyBannerText}>{progressText || 'Processing...'}</Text>
            </View>
          )}

          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {activeTab === 'current' ? (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>Active Viewport Snapshot</Text>
                <Text style={styles.sectionHint}>
                  Take an immediate snapshot from the current 3D camera angle at your chosen pixel resolution. UI gizmos and selection highlights are automatically hidden.
                </Text>

                <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Output Resolution</Text>
                <ResolutionSelector value={currentResolution} onChange={setCurrentResolution} />

                <View style={styles.summaryPill}>
                  <Ionicons name="image-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.summaryPillText}>
                    Output: {currentResolution.width} × {currentResolution.height} px (PNG)
                  </Text>
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryActionBtn,
                    pressed && styles.primaryActionBtnPressed,
                    busy && styles.btnDisabled,
                  ]}
                  onPress={handleCaptureCurrentView}
                  disabled={busy}
                >
                  <Ionicons name="download-outline" size={18} color={COLORS.white} />
                  <Text style={styles.primaryActionBtnText}>Capture & Download PNG</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.sectionBlock}>
                <View style={styles.toolbarRow}>
                  <View style={styles.selectionControls}>
                    {savedViews.length > 0 && (
                      <Pressable style={styles.selectAllBtn} onPress={toggleSelectAll}>
                        <Ionicons
                          name={allSelected ? 'checkbox' : 'square-outline'}
                          size={18}
                          color={allSelected ? COLORS.primary : GLASS.textMuted}
                        />
                        <Text style={styles.selectAllText}>
                          {allSelected ? 'Deselect All' : 'Select All'}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                  <Pressable
                    style={({ pressed }) => [
                      styles.newViewBtn,
                      pressed && styles.primaryActionBtnPressed,
                    ]}
                    onPress={beginCreateView}
                  >
                    <Ionicons name="add" size={17} color={COLORS.white} />
                    <Text style={styles.newViewBtnText}>New Saved View</Text>
                  </Pressable>
                </View>

                {savedViews.length === 0 ? (
                  <View style={styles.emptyViewsBox}>
                    <Ionicons name="videocam-outline" size={32} color={GLASS.textFaint} />
                    <Text style={styles.emptyViewsTitle}>No saved camera views yet</Text>
                    <Text style={styles.emptyViewsSubtitle}>
                      Create saved camera angles with custom aspect ratios and resolutions. They are automatically saved with your project.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.viewsList}>
                    {savedViews.map((view) => {
                      const isSelected = validSelectedIds.has(view.id);
                      return (
                        <View
                          key={view.id}
                          style={[styles.viewCard, isSelected && styles.viewCardSelected]}
                        >
                          <Pressable
                            style={styles.checkboxHit}
                            onPress={() => toggleSelectView(view.id)}
                          >
                            <Ionicons
                              name={isSelected ? 'checkbox' : 'square-outline'}
                              size={20}
                              color={isSelected ? COLORS.primary : GLASS.textMuted}
                            />
                          </Pressable>

                          <Pressable
                            style={styles.viewThumbWrap}
                            onPress={() => beginEditView(view)}
                          >
                            {view.previewDataUrl ? (
                              <Image
                                source={{ uri: view.previewDataUrl }}
                                style={styles.viewThumbImage}
                                resizeMode="cover"
                              />
                            ) : (
                              <View style={styles.viewThumbPlaceholder}>
                                <ActivityIndicator size="small" color={COLORS.primary} />
                              </View>
                            )}
                          </Pressable>

                          <Pressable
                            style={styles.viewInfoCol}
                            onPress={() => toggleSelectView(view.id)}
                          >
                            <Text style={styles.viewNameText} numberOfLines={1}>
                              {view.name}
                            </Text>
                            <Text style={styles.viewMetaText}>
                              {view.resolution.width} × {view.resolution.height} px ·{' '}
                              {view.resolution.preset === 'custom'
                                ? 'Custom'
                                : view.resolution.preset}
                            </Text>
                          </Pressable>

                          <View style={styles.viewItemActions}>
                            <Pressable
                              style={styles.iconActionBtn}
                              onPress={() => handleEnterFramingDirect(view)}
                              accessibilityLabel={`Frame camera for ${view.name}`}
                            >
                              <Ionicons name="scan-outline" size={16} color={COLORS.primary} />
                            </Pressable>
                            <Pressable
                              style={styles.iconActionBtn}
                              onPress={() => beginEditView(view)}
                              accessibilityLabel={`Edit ${view.name}`}
                            >
                              <Ionicons name="create-outline" size={16} color={GLASS.text} />
                            </Pressable>
                            <Pressable
                              style={styles.iconActionBtn}
                              onPress={() => generateViewsBatch([view], 'individual')}
                              disabled={busy}
                              accessibilityLabel={`Download ${view.name}`}
                            >
                              <Ionicons name="download-outline" size={16} color={COLORS.primary} />
                            </Pressable>
                            <Pressable
                              style={[styles.iconActionBtn, styles.iconActionBtnDanger]}
                              onPress={() => handleDeleteView(view.id)}
                              accessibilityLabel={`Delete ${view.name}`}
                            >
                              <Ionicons
                                name="trash-outline"
                                size={16}
                                color={COLORS.dangerStrong}
                              />
                            </Pressable>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                {savedViews.length > 0 && (
                  <View style={styles.batchExportFooter}>
                    <Text style={styles.batchFooterLabel}>
                      {selectedViewsList.length > 0
                        ? `Export Selected (${selectedViewsList.length} ${
                            selectedViewsList.length === 1 ? 'view' : 'views'
                          })`
                        : `Export All Views (${savedViews.length})`}
                    </Text>

                    <View style={styles.batchButtonsRow}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.secondaryActionBtn,
                          { flex: 1 },
                          pressed && styles.secondaryActionBtnPressed,
                          busy && styles.btnDisabled,
                        ]}
                        disabled={busy}
                        onPress={() =>
                          generateViewsBatch(
                            selectedViewsList.length > 0 ? selectedViewsList : savedViews,
                            'individual'
                          )
                        }
                      >
                        <Ionicons name="images-outline" size={16} color={COLORS.primary} />
                        <Text style={styles.secondaryActionBtnText}>Download Individually</Text>
                      </Pressable>

                      <Pressable
                        style={({ pressed }) => [
                          styles.primaryActionBtn,
                          { flex: 1 },
                          pressed && styles.primaryActionBtnPressed,
                          busy && styles.btnDisabled,
                        ]}
                        disabled={busy}
                        onPress={() =>
                          generateViewsBatch(
                            selectedViewsList.length > 0 ? selectedViewsList : savedViews,
                            'zip'
                          )
                        }
                      >
                        <Ionicons name="archive-outline" size={16} color={COLORS.white} />
                        <Text style={styles.primaryActionBtnText}>Download as .zip</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </GlassSurface>

        <SavedViewEditorModal
          visible={editorModalMode !== null}
          mode={editorModalMode || 'create'}
          view={activeEditingView}
          draftName={draftName}
          setDraftName={setDraftName}
          draftResolution={draftResolution}
          setDraftResolution={setDraftResolution}
          onClose={closeEditorModal}
          onSaveMetadata={handleSaveEditedMetadata}
          onFrameCamera={handleEnterFramingFromModal}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: GLASS.scrim,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  subModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: 640,
    maxWidth: '100%',
    maxHeight: '90%',
    borderRadius: RADII.xl,
    backgroundColor: GLASS.bgStrong,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  editorModalCard: {
    width: 540,
    maxWidth: '100%',
    maxHeight: '88%',
    borderRadius: RADII.xl,
    backgroundColor: GLASS.bgStrong,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: GLASS.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: GLASS.text,
  },
  closeIconBtn: {
    padding: 4,
    borderRadius: RADII.sm,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: GLASS.border,
    gap: 8,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: COLORS.primary,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: GLASS.textMuted,
  },
  tabBtnTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  busyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.primarySoft,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primaryBorder,
  },
  busyBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  bodyScroll: {
    flexGrow: 0,
  },
  bodyContent: {
    padding: 20,
  },
  editorModalBody: {
    padding: 20,
    gap: 16,
  },
  editorPreviewSection: {
    gap: 10,
  },
  editorPreviewFrame: {
    width: '100%',
    height: 170,
    borderRadius: RADII.lg,
    backgroundColor: '#1e293b',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: GLASS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorPreviewImage: {
    width: '100%',
    height: '100%',
  },
  editorPreviewPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  editorPreviewPlaceholderText: {
    fontSize: 12,
    color: GLASS.textFaint,
  },
  editorPreviewBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADII.sm,
  },
  editorPreviewBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.white,
  },
  reframeCameraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: RADII.md,
  },
  editorFormField: {
    gap: 6,
  },
  editorModalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: GLASS.border,
  },
  cancelModalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: GLASS.border,
    backgroundColor: GLASS.bgInput,
  },
  cancelModalBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: GLASS.text,
  },
  sectionBlock: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: GLASS.text,
  },
  sectionHint: {
    fontSize: 12,
    lineHeight: 18,
    color: GLASS.textMuted,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: GLASS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldMiniLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: GLASS.textMuted,
    marginBottom: 4,
  },
  resolutionContainer: {
    gap: 10,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: GLASS.border,
    backgroundColor: GLASS.bgInput,
    minWidth: 100,
  },
  presetChipActive: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
  },
  presetLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: GLASS.text,
  },
  presetLabelActive: {
    color: COLORS.primary,
  },
  presetSubtitle: {
    fontSize: 10,
    color: GLASS.textMuted,
    marginTop: 2,
  },
  presetSubtitleActive: {
    color: COLORS.primary,
  },
  customInputsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  customInputField: {
    flex: 1,
  },
  dimensionMultiply: {
    fontSize: 16,
    fontWeight: '700',
    color: GLASS.textMuted,
    paddingBottom: 10,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: GLASS.border,
    borderRadius: RADII.md,
    paddingHorizontal: 12,
    backgroundColor: COLORS.white,
    fontSize: 13,
    color: GLASS.text,
  },
  summaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADII.md,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    marginTop: 4,
  },
  summaryPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: RADII.md,
  },
  primaryActionBtnPressed: {
    backgroundColor: COLORS.primaryPressed,
  },
  primaryActionBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: RADII.md,
  },
  secondaryActionBtnPressed: {
    opacity: 0.8,
  },
  secondaryActionBtnText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  selectionControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  selectAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: GLASS.text,
  },
  newViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: RADII.full,
  },
  newViewBtnText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyViewsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: GLASS.borderStrong,
    gap: 6,
  },
  emptyViewsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: GLASS.text,
  },
  emptyViewsSubtitle: {
    fontSize: 12,
    color: GLASS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  viewsList: {
    gap: 8,
  },
  viewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: GLASS.border,
    backgroundColor: COLORS.white,
    gap: 12,
  },
  viewCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surfaceActive,
  },
  checkboxHit: {
    padding: 2,
  },
  viewThumbWrap: {
    width: 84,
    height: 52,
    borderRadius: RADII.sm,
    backgroundColor: '#1e293b',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: GLASS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewThumbImage: {
    width: '100%',
    height: '100%',
  },
  viewThumbPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewInfoCol: {
    flex: 1,
    minWidth: 0,
  },
  viewNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: GLASS.text,
  },
  viewMetaText: {
    fontSize: 11,
    color: GLASS.textMuted,
    marginTop: 2,
  },
  viewItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconActionBtn: {
    width: 32,
    height: 32,
    borderRadius: RADII.sm,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActionBtnDanger: {
    backgroundColor: COLORS.errorSoft,
  },
  batchExportFooter: {
    marginTop: 8,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: GLASS.border,
    gap: 10,
  },
  batchFooterLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: GLASS.text,
  },
  batchButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
});
