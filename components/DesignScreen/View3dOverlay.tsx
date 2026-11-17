import { COLORS, GLASS, RADII } from "@/constants/theme";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Dimensions, LayoutChangeEvent, Pressable, ScaledSize, StyleSheet, Text, View, ViewProps } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { MaterialCategory, MaterialMeta, MaterialType, ObjectCategory, ObjectMaterialType } from "../../services/api";
import { SavedView } from "../../services/currentProject";
import { DesignMaterialSlot } from "../../services/designMaterialDefaults";
import {
  collectActiveHandleUsages,
  collectAvailableHandleTypes,
  isHandleVariant,
  isHandleVariantGroup,
  parseVariantProperties,
} from "../../services/variants";
import { CameraStateSnapshot, ThumbnailCaptureApi } from "../../services/thumbnailCapture";
import { AppliedMaterial, createDesignObject, DesignObject, getInitialPosition, GlobalMaterials, MaterialOverrides, ObjectTemplate } from "./3dView/DesignObjects";
import { Room3dProps, WallIdentifier } from "./3dView/Room3d";
import BottomSheet from "./3dViewOverlay/BottomSheet";
import CategoryBrowser from "./3dViewOverlay/CategoryBrowser";
import EditFurnitureInstanceMenu from "./3dViewOverlay/EditFurnitureInstanceMenu";
import EditMeasurementModal, { ActiveMeasurementEdit, MeasurementSide } from "./3dViewOverlay/EditMeasurementModal";
import EditWallModal from "./3dViewOverlay/EditWallModal";
import FurnitureInstancesManager from "./3dViewOverlay/FurnitureInstancesManager";
import GenerateImagesModal, { FramingSessionState } from "./3dViewOverlay/GenerateImagesModal";
import GlassSurface from "./3dViewOverlay/GlassSurface";
import MaterialPicker from "./3dViewOverlay/MaterialPicker";
import MaterialsWidget from "./3dViewOverlay/MaterialsWidget";
import ModuleCatalogue from "./3dViewOverlay/ModuleCatalogue";
import RoomManager from "./3dViewOverlay/RoomManager";
import { computeNewPositionFromMeasurement } from "./3dView/ObjectMeasurements3D";

interface View3dOverlayProps {
  objectTemplates: ObjectTemplate[];
  categories: ObjectCategory[];
  designObjects: DesignObject[];
  room3dProps: Room3dProps;
  setRoom3d: React.Dispatch<React.SetStateAction<Room3dProps>>;
  onObjectAdded: (newObject: DesignObject) => void;
  onObjectEdited: (id: string, updates: { name: string; position: [number, number, number]; rotation?: number; materialOverrides?: MaterialOverrides; dimensions?: [number, number, number]; selectedVariants?: Record<string, string | null> }) => void;
  onObjectDeleted: (id: string) => void;
  onObjectDuplicate?: (object: DesignObject) => void;
  movingObject?: DesignObject;
  setMovingObject: (object?: DesignObject) => void;
  magnetEnabled: boolean;
  forceEditObject?: DesignObject;
  clearForceEdit: () => void;
  activeMeasurementEdit?: ActiveMeasurementEdit;
  onClearMeasurementEdit?: () => void;
  materials: MaterialMeta[];
  materialCategories: MaterialCategory[];
  materialTypes?: MaterialType[];
  globalMaterials: GlobalMaterials;
  setGlobalMaterials: React.Dispatch<React.SetStateAction<GlobalMaterials>>;
  defaultHandleType: string | null;
  setDefaultHandleType: React.Dispatch<React.SetStateAction<string | null>>;
  onReplaceHandleType?: (sourceHandleKey: string, targetHandleKey: string) => void;
  onClearHandleOverrides: () => void;
  materialDataById: Record<string, AppliedMaterial>;
  designSlots: DesignMaterialSlot[];
  slotTypesByModel: Record<string, ObjectMaterialType[]>;
  typeToDesignSlot: Record<string, string>;
  onSaveProject: () => void;
  onLoadProject: () => void;
  onSaveProjectCloud: () => void;
  onExport3d: () => void;
  isExporting: boolean;
  wallContextMenu?: { wallId: WallIdentifier; x: number; y: number } | null;
  onClearWallContextMenu?: () => void;
  editingWall?: WallIdentifier | null;
  setEditingWall?: (wall: WallIdentifier | null) => void;
  onMaterialDataResolved?: (id: string, data: AppliedMaterial) => void;
  savedViews: SavedView[];
  setSavedViews: React.Dispatch<React.SetStateAction<SavedView[]>>;
  captureApi: ThumbnailCaptureApi;
  projectName: string;
  onFramingModeChange?: (isFraming: boolean) => void;
}

function useWindowDimensions() {
  const [windowDimensions, setWindowDimensions] = useState(Dimensions.get("window"));

  useEffect(() => {
    const onChange = ({ window }: { window: ScaledSize }) => {
      setWindowDimensions(window);
    };

    const subscription = Dimensions.addEventListener("change", onChange);

    return () => {
      subscription.remove();
    };
  }, []);

  return windowDimensions;
}

function ToolbarButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <GlassSurface style={styles.toolbarButton}>
      <Pressable
        style={({ pressed }) => [styles.toolbarButtonInner, pressed && styles.toolbarButtonPressed]}
        onPress={onPress}
      >
        <Ionicons name="menu-outline" size={15} color={GLASS.text} style={styles.toolbarIcon} />
        <Text style={styles.toolbarButtonText}>{label}</Text>
      </Pressable>
    </GlassSurface>
  );
}

function DropdownItem({
  label,
  onPress,
  busy,
  chevronOpen,
  submenu,
}: {
  label: string;
  onPress?: () => void;
  busy?: boolean;
  chevronOpen?: boolean;
  submenu?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.dropdownItem,
        submenu && styles.dropdownSubmenuItem,
        pressed && !busy && styles.dropdownItemPressed,
      ]}
      onPress={onPress}
      disabled={busy}
    >
      {busy ? (
        <ActivityIndicator size="small" color={COLORS.primary} />
      ) : (
        <Text style={styles.dropdownItemText}>{label}</Text>
      )}
      {chevronOpen !== undefined && (
        <Text style={styles.dropdownChevron}>{chevronOpen ? "▾" : "▸"}</Text>
      )}
    </Pressable>
  );
}

export default function View3dOverlay({
  objectTemplates,
  categories,
  designObjects,
  room3dProps,
  setRoom3d,
  onObjectAdded,
  onObjectEdited,
  onObjectDeleted,
  onObjectDuplicate,
  movingObject,
  setMovingObject,
  forceEditObject,
  clearForceEdit,
  activeMeasurementEdit,
  onClearMeasurementEdit,
  materials,
  materialCategories,
  materialTypes,
  globalMaterials,
  setGlobalMaterials,
  defaultHandleType,
  setDefaultHandleType,
  onReplaceHandleType,
  onClearHandleOverrides,
  materialDataById,
  designSlots,
  slotTypesByModel,
  typeToDesignSlot,
  onSaveProject,
  onLoadProject,
  onSaveProjectCloud,
  onExport3d,
  isExporting,
  wallContextMenu,
  onClearWallContextMenu,
  editingWall,
  setEditingWall,
  onMaterialDataResolved,
  savedViews,
  setSavedViews,
  captureApi,
  projectName,
  onFramingModeChange,
}: View3dOverlayProps) {
  const router = useRouter();
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const [overlaySize, setOverlaySize] = useState<{ width: number; height: number } | null>(null);
  const width = overlaySize?.width || winWidth;
  const height = overlaySize?.height || winHeight;
  const isDesktop = width > 768;

  const [isObjectsManagerVisible, setIsObjectsManagerVisible] = useState(false);
  const [isListInstantiableObjectsVisible, setIsListInstantiableObjectsVisible] = useState(false);
  const [isRoomSettingsVisible, setIsRoomSettingsVisible] = useState(false);
  const [isGlobalMaterialsVisible, setIsGlobalMaterialsVisible] = useState(false);
  const [isMaterialsPreviewsVisible, setIsMaterialsPreviewsVisible] = useState(false);
  const [isOptionsMenuVisible, setIsOptionsMenuVisible] = useState(false);
  const [isExportMenuVisible, setIsExportMenuVisible] = useState(false);
  const [materialsInitialSlot, setMaterialsInitialSlot] = useState<string | null>(null);
  const [activeMaterialCardId, setActiveMaterialCardId] = useState<string | null>(null);

  const [isEditObjectMenuVisible, setIsEditObjectMenuVisible] = useState(false);
  const [selectedObjectState, setSelectedObjectState] = useState<DesignObject | undefined>(undefined);

  const [isGenerateImagesModalVisible, setIsGenerateImagesModalVisible] = useState(false);
  const [framingSession, setFramingSession] = useState<FramingSessionState | null>(null);
  const [reopenEditViewId, setReopenEditViewId] = useState<string | null>(null);
  const preFramingCameraRef = useRef<CameraStateSnapshot | null>(null);

  const handleOverlayLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (w > 0 && h > 0) {
      setOverlaySize({ width: w, height: h });
    }
  };

  useEffect(() => {
    if (forceEditObject) {
      handleEditObject(forceEditObject);
      clearForceEdit();
    }
  }, [forceEditObject]);

  useEffect(() => {
    if (activeMeasurementEdit) {
      setIsListInstantiableObjectsVisible(false);
      setIsRoomSettingsVisible(false);
      setIsObjectsManagerVisible(false);
      setIsEditObjectMenuVisible(false);
      setIsGlobalMaterialsVisible(false);
      setIsMaterialsPreviewsVisible(false);
    }
  }, [activeMeasurementEdit]);

  useEffect(() => {
    if (selectedObjectState) {
      const updated = designObjects.find(o => o.id === selectedObjectState.id);
      if (updated && updated !== selectedObjectState) {
        setSelectedObjectState(updated);
      }
    }
  }, [designObjects, selectedObjectState]);

  const closeAllPanels = () => {
    setIsEditObjectMenuVisible(false);
    setIsObjectsManagerVisible(false);
    setIsListInstantiableObjectsVisible(false);
    setIsRoomSettingsVisible(false);
    setIsGlobalMaterialsVisible(false);
    setIsMaterialsPreviewsVisible(false);
    setMaterialsInitialSlot(null);
    setActiveMaterialCardId(null);
    setIsOptionsMenuVisible(false);
    setIsExportMenuVisible(false);
    onClearMeasurementEdit?.();
    onClearWallContextMenu?.();
  };

  const openGenerateImagesModal = () => {
    closeAllPanels();
    setMovingObject(undefined);
    setIsGenerateImagesModalVisible(true);
  };

  const handleStartFraming = (session: FramingSessionState) => {
    preFramingCameraRef.current = captureApi.getCameraState();
    setIsGenerateImagesModalVisible(false);
    closeAllPanels();
    setMovingObject(undefined);
    setFramingSession(session);
    onFramingModeChange?.(true);

    captureApi.setCameraState({
      position: session.initialCamera.position,
      target: session.initialCamera.target,
      fov: session.initialCamera.fov,
      zoom: session.initialCamera.zoom,
    });
  };

  const handleConfirmFraming = async () => {
    if (!framingSession) return;
    const currentCam = captureApi.getCameraState();
    const aspect =
      framingSession.resolution.width / Math.max(1, framingSession.resolution.height);
    const thumbW = aspect >= 1 ? 320 : Math.max(120, Math.round(320 * aspect));
    const thumbH = aspect >= 1 ? Math.max(120, Math.round(320 / aspect)) : 320;

    let previewDataUrl: string | undefined;
    try {
      const thumb = await captureApi.captureImage({
        width: thumbW,
        height: thumbH,
        cameraPosition: currentCam.position,
        cameraTarget: currentCam.target,
        fov: currentCam.fov,
        zoom: currentCam.zoom,
      });
      if (thumb) {
        previewDataUrl = `data:image/png;base64,${thumb.base64}`;
      }
    } catch (err) {
      console.warn('Preview thumbnail capture failed:', err);
    }

    const newView: SavedView = {
      id: framingSession.viewId,
      name: framingSession.name,
      cameraPosition: currentCam.position,
      cameraTarget: currentCam.target,
      fov: currentCam.fov,
      zoom: currentCam.zoom,
      resolution: framingSession.resolution,
      ...(previewDataUrl ? { previewDataUrl } : {}),
    };

    if (framingSession.mode === 'create') {
      setSavedViews(prev => [...prev, newView]);
      setReopenEditViewId(null);
    } else {
      setSavedViews(prev =>
        prev.map(v =>
          v.id === newView.id
            ? { ...newView, previewDataUrl: previewDataUrl ?? v.previewDataUrl }
            : v
        )
      );
      setReopenEditViewId(framingSession.returnToEditModal ? newView.id : null);
    }

    setFramingSession(null);
    onFramingModeChange?.(false);
    setIsGenerateImagesModalVisible(true);
  };

  const handleCancelFraming = () => {
    if (preFramingCameraRef.current) {
      captureApi.setCameraState(preFramingCameraRef.current);
      preFramingCameraRef.current = null;
    }
    const shouldReopenEdit =
      framingSession?.mode === 'edit' && framingSession.returnToEditModal
        ? framingSession.viewId
        : null;
    setReopenEditViewId(shouldReopenEdit);
    setFramingSession(null);
    onFramingModeChange?.(false);
    setIsGenerateImagesModalVisible(true);
  };

  const handleAddObject = (objectType: ObjectTemplate) => {
    setIsEditObjectMenuVisible(false);
    setIsObjectsManagerVisible(false);
    setIsListInstantiableObjectsVisible(false);
    setIsGlobalMaterialsVisible(false);
    setIsMaterialsPreviewsVisible(false);
    onClearMeasurementEdit?.();
    onObjectAdded(createDesignObject(objectType, getInitialPosition(objectType)));
  };

  const handleEditObject = (object: DesignObject) => {
    setIsListInstantiableObjectsVisible(false);
    setIsRoomSettingsVisible(false);
    setIsObjectsManagerVisible(false);
    setIsGlobalMaterialsVisible(false);
    setIsMaterialsPreviewsVisible(false);
    onClearMeasurementEdit?.();

    setSelectedObjectState(object);
    setIsEditObjectMenuVisible(true);
  };

  const closeEditMenu = () => {
    setIsEditObjectMenuVisible(false);
    setSelectedObjectState(undefined);
  };

  const handleObjectEditAndClose = (
    id: string,
    updates: { name: string; position: [number, number, number]; rotation?: number; materialOverrides?: MaterialOverrides; dimensions?: [number, number, number]; selectedVariants?: Record<string, string | null> }
  ) => {
    onObjectEdited(id, updates);
    closeEditMenu();
  };

  const handleDimensionPreview = (id: string, dimensions: [number, number, number]) => {
    const target = designObjects.find(o => o.id === id);
    if (!target) return;
    onObjectEdited(id, { name: target.name, position: target.position, dimensions });
  };

  const handleObjectDeleteAndClose = (id: string) => {
    onObjectDeleted(id);
    closeEditMenu();
  };

  const handleObjectDuplicateAndClose = (object: DesignObject) => {
    if (onObjectDuplicate) onObjectDuplicate(object);
    closeEditMenu();
  };

  const handleMeasurementApply = (side: MeasurementSide, newDistance: number) => {
    if (!activeMeasurementEdit) return;
    const targetObj = designObjects.find(o => o.id === activeMeasurementEdit.objectId);
    if (!targetObj) {
      onClearMeasurementEdit?.();
      return;
    }
    const newPosition = computeNewPositionFromMeasurement(
      targetObj,
      designObjects,
      room3dProps,
      side,
      newDistance
    );
    onObjectEdited(targetObj.id, {
      name: targetObj.name,
      position: newPosition,
    });
    onClearMeasurementEdit?.();
  };

  const toggleRoomSettings = () => {
    const newState = !isRoomSettingsVisible;
    setIsRoomSettingsVisible(newState);

    if (newState) {
      setIsListInstantiableObjectsVisible(false);
      setIsObjectsManagerVisible(false);
      setIsEditObjectMenuVisible(false);
      setIsGlobalMaterialsVisible(false);
      setIsMaterialsPreviewsVisible(false);
      setMaterialsInitialSlot(null);
      onClearMeasurementEdit?.();
    }
  };

  const closePanelsForMaterials = () => {
    setIsRoomSettingsVisible(false);
    setIsListInstantiableObjectsVisible(false);
    setIsObjectsManagerVisible(false);
    setIsEditObjectMenuVisible(false);
    onClearMeasurementEdit?.();
  };

  const toggleMaterialsPreviews = () => {
    const shouldOpen = !isMaterialsPreviewsVisible;
    setIsMaterialsPreviewsVisible(shouldOpen);

    if (shouldOpen) {
      setIsGlobalMaterialsVisible(false);
      setMaterialsInitialSlot(null);
      closePanelsForMaterials();
    }
  };

  const openMaterialsPanel = (slotKey?: string) => {
    setIsMaterialsPreviewsVisible(false);
    setIsGlobalMaterialsVisible(true);
    setMaterialsInitialSlot(slotKey ?? null);
    setActiveMaterialCardId(null);
    closePanelsForMaterials();
  };

  const closeMaterialsPanel = () => {
    setIsGlobalMaterialsVisible(false);
    setMaterialsInitialSlot(null);
  };

  const handleMaterialSelect = async (materialMeta: MaterialMeta) => {
    const slot = materialsInitialSlot;
    if (!slot) return;
    setGlobalMaterials(prev => ({ ...prev, [slot]: materialMeta.id }));
    closeMaterialsPanel();
  };

  const handleMaterialReset = (slotKey: string) => {
    setGlobalMaterials(prev => {
      const next = { ...prev };
      delete next[slotKey];
      return next;
    });
    setActiveMaterialCardId(null);
  };

  const toggleAddObjectList = () => {
    const newState = !isListInstantiableObjectsVisible;
    setIsListInstantiableObjectsVisible(newState);

    if (newState) {
      setIsRoomSettingsVisible(false);
      setIsObjectsManagerVisible(false);
      setIsEditObjectMenuVisible(false);
      setIsGlobalMaterialsVisible(false);
      setIsMaterialsPreviewsVisible(false);
      setMaterialsInitialSlot(null);
      onClearMeasurementEdit?.();
    }
  };

  const toggleObjectsManager = () => {
    const newState = !isObjectsManagerVisible;
    setIsObjectsManagerVisible(newState);

    if (newState) {
      setIsRoomSettingsVisible(false);
      setIsListInstantiableObjectsVisible(false);
      setIsEditObjectMenuVisible(false);
      setIsGlobalMaterialsVisible(false);
      setIsMaterialsPreviewsVisible(false);
      setMaterialsInitialSlot(null);
      onClearMeasurementEdit?.();
    }
  };

  const toggleOptionsMenu = () => {
    const newState = !isOptionsMenuVisible;
    setIsOptionsMenuVisible(newState);
    if (!newState) setIsExportMenuVisible(false);
  };

  const toggleExportMenu = () => {
    setIsExportMenuVisible(prev => !prev);
  };

  const exportHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (exportHoverTimer.current) clearTimeout(exportHoverTimer.current);
    };
  }, []);

  const handleExportHoverIn = () => {
    if (exportHoverTimer.current) {
      clearTimeout(exportHoverTimer.current);
      exportHoverTimer.current = null;
    }
    setIsExportMenuVisible(true);
  };

  const handleExportHoverOut = () => {
    if (exportHoverTimer.current) clearTimeout(exportHoverTimer.current);
    exportHoverTimer.current = setTimeout(() => {
      exportHoverTimer.current = null;
      setIsExportMenuVisible(false);
    }, 200);
  };

  const closeOptionsMenu = () => {
    setIsOptionsMenuVisible(false);
    setIsExportMenuVisible(false);
  };

  const closeMobileSheet = () => {
    setIsObjectsManagerVisible(false);
    setIsRoomSettingsVisible(false);
    setIsGlobalMaterialsVisible(false);
    setIsMaterialsPreviewsVisible(false);
    setMaterialsInitialSlot(null);
    setIsListInstantiableObjectsVisible(false);
    onClearMeasurementEdit?.();
    closeEditMenu();
  };

  const sheetMaxHeight = Math.round(height * 0.75);
  const desktopPanelMaxHeight = Math.max(260, Math.min(720, Math.round(height * 0.78), height - 168));
  const widePanelStyle = [styles.widePanel, { maxHeight: desktopPanelMaxHeight }];
  const sheetPanelStyle = [styles.sheetPanel, { maxHeight: sheetMaxHeight - 56 }];

  const handleOptions = React.useMemo(() => {
    const lists = [
      ...designObjects.map(o => o.variants),
      ...objectTemplates.map(t => t.variants),
    ];
    return collectAvailableHandleTypes(lists);
  }, [designObjects, objectTemplates]);

  const activeHandleUsages = React.useMemo(
    () => collectActiveHandleUsages(designObjects, defaultHandleType, handleOptions),
    [designObjects, defaultHandleType, handleOptions]
  );

  const hasHandleInstanceOverrides = React.useMemo(() => {
    return designObjects.some(obj => {
      if (!obj.selectedVariants) return false;
      for (const g of Object.keys(obj.selectedVariants)) {
        if (obj.selectedVariants[g] !== undefined && isHandleVariantGroup(g)) return true;
      }
      for (const v of obj.variants ?? []) {
        if (isHandleVariant(v)) {
          const g = parseVariantProperties(v.variantProperties).group;
          if (obj.selectedVariants[g] !== undefined) return true;
        }
      }
      return false;
    });
  }, [designObjects]);

  if (framingSession) {
    const targetAspect =
      framingSession.resolution.width / Math.max(1, framingSession.resolution.height);
    const viewportAspect = width / Math.max(1, height);

    let frameW = width;
    let frameH = height;
    if (viewportAspect > targetAspect) {
      frameH = height;
      frameW = height * targetAspect;
    } else {
      frameW = width;
      frameH = width / targetAspect;
    }

    const maskTopBottom = Math.max(0, (height - frameH) / 2);
    const maskLeftRight = Math.max(0, (width - frameW) / 2);

    return (
      <View style={styles.overlay} onLayout={handleOverlayLayout} pointerEvents="box-none">
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {maskTopBottom > 0 && (
            <>
              <View
                style={[
                  styles.framingMaskBar,
                  { top: 0, left: 0, right: 0, height: maskTopBottom },
                ]}
              />
              <View
                style={[
                  styles.framingMaskBar,
                  { bottom: 0, left: 0, right: 0, height: maskTopBottom },
                ]}
              />
            </>
          )}
          {maskLeftRight > 0 && (
            <>
              <View
                style={[
                  styles.framingMaskBar,
                  {
                    top: maskTopBottom,
                    bottom: maskTopBottom,
                    left: 0,
                    width: maskLeftRight,
                  },
                ]}
              />
              <View
                style={[
                  styles.framingMaskBar,
                  {
                    top: maskTopBottom,
                    bottom: maskTopBottom,
                    right: 0,
                    width: maskLeftRight,
                  },
                ]}
              />
            </>
          )}
          <View
            style={[
              styles.framingViewportBorder,
              {
                top: maskTopBottom,
                left: maskLeftRight,
                width: frameW,
                height: frameH,
              },
            ]}
          />
          <View style={styles.framingBadgeWrap}>
            <View style={styles.framingBadge}>
              <Ionicons name="scan-outline" size={14} color={COLORS.white} />
              <Text style={styles.framingBadgeText}>
                {framingSession.name} · {framingSession.resolution.width}×{framingSession.resolution.height}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.framingActionsBottom} pointerEvents="box-none">
          <GlassSurface style={styles.framingActionsSurface} blurIntensity={60}>
            <Pressable
              style={({ pressed }) => [
                styles.framingCancelBtn,
                pressed && styles.dockButtonPressed,
              ]}
              onPress={handleCancelFraming}
            >
              <Ionicons name="close" size={18} color={GLASS.text} />
              <Text style={styles.framingCancelText}>Cancel</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.framingConfirmBtn,
                pressed && styles.dockPrimaryActionActive,
              ]}
              onPress={handleConfirmFraming}
            >
              <Ionicons name="checkmark" size={18} color={COLORS.white} />
              <Text style={styles.framingConfirmText}>Confirm Position</Text>
            </Pressable>
          </GlassSurface>
        </View>
      </View>
    );
  }

  const measurementTargetObj = activeMeasurementEdit
    ? designObjects.find(o => o.id === activeMeasurementEdit.objectId)
    : undefined;

  const materialsPanel = (
    <MaterialPicker
      key={materialsInitialSlot ?? "material-picker"}
      materials={materials}
      categories={materialCategories}
      onSelect={handleMaterialSelect}
      onClose={closeMaterialsPanel}
      containerStyle={styles.widgetPanel}
    />
  );

  const mobilePanel =
    (isObjectsManagerVisible && (
      <FurnitureInstancesManager
        furnitureInstances={designObjects}
        onFurnitureSelect={handleEditObject}
        onClose={() => setIsObjectsManagerVisible(false)}
        containerStyle={sheetPanelStyle}
      />
    )) ||
    (isRoomSettingsVisible && (
      <RoomManager
        room3dProps={room3dProps}
        setRoom3d={setRoom3d}
        onClose={() => setIsRoomSettingsVisible(false)}
        onEditWall={(wId) => {
          setIsRoomSettingsVisible(false);
          setEditingWall?.(wId);
        }}
        containerStyle={sheetPanelStyle}
      />
    )) ||
    (isGlobalMaterialsVisible && (
      <MaterialPicker
        key={materialsInitialSlot ?? "material-picker"}
        materials={materials}
        categories={materialCategories}
        onSelect={handleMaterialSelect}
        onClose={closeMaterialsPanel}
        containerStyle={sheetPanelStyle}
      />
    )) ||
    (isListInstantiableObjectsVisible && (
      <CategoryBrowser
        objectTemplates={objectTemplates}
        categories={categories}
        addObjectAction={handleAddObject}
        onClose={() => setIsListInstantiableObjectsVisible(false)}
        containerStyle={sheetPanelStyle}
      />
    )) ||
    (isEditObjectMenuVisible && selectedObjectState && (
      <EditFurnitureInstanceMenu
        key={selectedObjectState.id}
        object={selectedObjectState}
        onEditComplete={handleObjectEditAndClose}
        onDimensionPreview={handleDimensionPreview}
        onDelete={handleObjectDeleteAndClose}
        onDuplicate={handleObjectDuplicateAndClose}
        onClose={closeEditMenu}
        materials={materials}
        materialCategories={materialCategories}
        globalMaterials={globalMaterials}
        designSlots={designSlots}
        slotTypesByModel={slotTypesByModel}
        typeToDesignSlot={typeToDesignSlot}
        defaultHandleType={defaultHandleType}
        containerStyle={sheetPanelStyle}
      />
    ));

  return (
    <View style={styles.overlay} onLayout={handleOverlayLayout}>
      {isOptionsMenuVisible && (
        <Pressable style={styles.menuBackdrop} onPress={closeOptionsMenu} />
      )}
      <View style={[styles.optionsContainer, styles.optionsContainerLeft]}>
        <ToolbarButton label="Options" onPress={toggleOptionsMenu} />
        {isOptionsMenuVisible && (
          <GlassSurface style={styles.dropdownPanel}>
            <DropdownItem label="Save project" onPress={() => { closeOptionsMenu(); onSaveProjectCloud(); }} />
            <DropdownItem label="Load project" onPress={() => { closeOptionsMenu(); router.push("/projectManager"); }} />
            <View style={styles.dropdownDivider} />
            <DropdownItem label="Generate Images" onPress={() => { closeOptionsMenu(); openGenerateImagesModal(); }} />
            <DropdownItem label="Import from file" onPress={() => { closeOptionsMenu(); onLoadProject(); }} />
            <View
              style={styles.dropdownExportItem}
              {...({ onMouseEnter: handleExportHoverIn, onMouseLeave: handleExportHoverOut } as unknown as ViewProps)}
            >
              <DropdownItem label="Export" chevronOpen={isExportMenuVisible} onPress={toggleExportMenu} />
              {isExportMenuVisible && isDesktop && (
                <View style={styles.dropdownSideSubmenu}>
                  <DropdownItem label="Generate Images..." onPress={() => { closeOptionsMenu(); openGenerateImagesModal(); }} />
                  <DropdownItem label="Project file" onPress={() => { closeOptionsMenu(); onSaveProject(); }} />
                  <DropdownItem label="3D model (.glb)" busy={isExporting} onPress={() => { closeOptionsMenu(); onExport3d(); }} />
                </View>
              )}
            </View>
            {isExportMenuVisible && !isDesktop && (
              <View style={styles.dropdownSubmenu}>
                <DropdownItem submenu label="Generate Images..." onPress={() => { closeOptionsMenu(); openGenerateImagesModal(); }} />
                <DropdownItem submenu label="Project file" onPress={() => { closeOptionsMenu(); onSaveProject(); }} />
                <DropdownItem submenu label="3D model (.glb)" busy={isExporting} onPress={() => { closeOptionsMenu(); onExport3d(); }} />
              </View>
            )}
          </GlassSurface>
        )}
      </View>

      <View style={styles.centerContainer}>
        <View
          style={[
            styles.modalArea,
            isListInstantiableObjectsVisible && styles.modalAreaAboveDock,
          ]}
        >
          {activeMeasurementEdit && measurementTargetObj && (
            <EditMeasurementModal
              key={`${activeMeasurementEdit.objectId}:${activeMeasurementEdit.side}`}
              activeEdit={activeMeasurementEdit}
              objectName={measurementTargetObj.name}
              onApply={handleMeasurementApply}
              onClose={() => onClearMeasurementEdit?.()}
            />
          )}
          {isDesktop && !activeMeasurementEdit && (
            (isListInstantiableObjectsVisible && (
              <ModuleCatalogue
                objectTemplates={objectTemplates}
                categories={categories}
                addObjectAction={handleAddObject}
                onClose={() => setIsListInstantiableObjectsVisible(false)}
              />
            )) ||
            (isRoomSettingsVisible && (
              <RoomManager
                room3dProps={room3dProps}
                setRoom3d={setRoom3d}
                onClose={() => setIsRoomSettingsVisible(false)}
              />
            )) ||
            (isObjectsManagerVisible && (
              <FurnitureInstancesManager
                furnitureInstances={designObjects}
                onFurnitureSelect={handleEditObject}
                onClose={() => setIsObjectsManagerVisible(false)}
              />
            )) ||
            (isEditObjectMenuVisible && selectedObjectState && (
              <EditFurnitureInstanceMenu
                key={selectedObjectState.id}
                object={selectedObjectState}
                onEditComplete={handleObjectEditAndClose}
                onDimensionPreview={handleDimensionPreview}
                onDelete={handleObjectDeleteAndClose}
                onDuplicate={handleObjectDuplicateAndClose}
                onClose={closeEditMenu}
                materials={materials}
                materialCategories={materialCategories}
                globalMaterials={globalMaterials}
                designSlots={designSlots}
                slotTypesByModel={slotTypesByModel}
                typeToDesignSlot={typeToDesignSlot}
                defaultHandleType={defaultHandleType}
                containerStyle={widePanelStyle}
              />
            ))
          )}
        </View>

        <View style={styles.dockWrap} pointerEvents="box-none">
          <GlassSurface style={styles.dockSurface}>
            <Pressable
              style={({ pressed }) => [
                styles.dockPrimaryAction,
                isListInstantiableObjectsVisible && styles.dockPrimaryActionActive,
                pressed && styles.dockButtonPressed,
              ]}
              onPress={toggleAddObjectList}
            >
              <Ionicons name="add" size={18} color={COLORS.white} />
              <Text style={styles.dockPrimaryText}>Add Module</Text>
            </Pressable>

            <View style={styles.dockDivider} />

            <Pressable
              style={({ pressed }) => [
                styles.dockAction,
                isRoomSettingsVisible && styles.dockActionActive,
                pressed && styles.dockButtonPressed,
              ]}
              onPress={toggleRoomSettings}
            >
              <Ionicons
                name="expand-outline"
                size={16}
                color={isRoomSettingsVisible ? COLORS.primary : GLASS.text}
              />
              <Text style={[styles.dockActionText, isRoomSettingsVisible && styles.dockActionTextActive]}>
                Room
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.dockAction,
                isObjectsManagerVisible && styles.dockActionActive,
                pressed && styles.dockButtonPressed,
              ]}
              onPress={toggleObjectsManager}
            >
              <Ionicons
                name="layers-outline"
                size={16}
                color={isObjectsManagerVisible ? COLORS.primary : GLASS.text}
              />
              <Text style={[styles.dockActionText, isObjectsManagerVisible && styles.dockActionTextActive]}>
                Objects
              </Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{designObjects.length}</Text>
              </View>
            </Pressable>

            <View style={styles.dockDivider} />

            <Pressable
              style={({ pressed }) => [
                styles.dockAction,
                isGenerateImagesModalVisible && styles.dockActionActive,
                pressed && styles.dockButtonPressed,
              ]}
              onPress={openGenerateImagesModal}
            >
              <Ionicons
                name="camera-outline"
                size={16}
                color={isGenerateImagesModalVisible ? COLORS.primary : GLASS.text}
              />
              <Text style={[styles.dockActionText, isGenerateImagesModalVisible && styles.dockActionTextActive]}>
                Generate Images
              </Text>
              {savedViews.length > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{savedViews.length}</Text>
                </View>
              )}
            </Pressable>
          </GlassSurface>
        </View>
      </View>

      {activeMaterialCardId && !isGlobalMaterialsVisible && (
        <Pressable style={styles.materialCardBackdrop} onPress={() => setActiveMaterialCardId(null)} />
      )}
      <View style={styles.widgetAnchor} pointerEvents="box-none">
        <MaterialsWidget
          designSlots={designSlots}
          globalMaterials={globalMaterials}
          materialDataById={materialDataById}
          materials={materials}
          expanded={isMaterialsPreviewsVisible}
          onToggleExpanded={toggleMaterialsPreviews}
          activeCardId={activeMaterialCardId}
          onCardActivate={setActiveMaterialCardId}
          onCardDismiss={() => setActiveMaterialCardId(null)}
          onRequestPicker={openMaterialsPanel}
          onResetSlot={handleMaterialReset}
          handleOptions={handleOptions}
          activeHandleUsages={activeHandleUsages}
          defaultHandleType={defaultHandleType}
          onSelectDefaultHandleType={setDefaultHandleType}
          onReplaceHandleType={onReplaceHandleType}
          hasHandleInstanceOverrides={hasHandleInstanceOverrides}
          onClearHandleOverrides={onClearHandleOverrides}
          compact={!isDesktop}
        />
        {isDesktop && isGlobalMaterialsVisible && materialsPanel}
      </View>

      {!isDesktop && mobilePanel && (
        <BottomSheet onClose={closeMobileSheet} maxHeight={sheetMaxHeight}>
          {mobilePanel}
        </BottomSheet>
      )}

      {wallContextMenu && (
        <>
          <Pressable style={styles.menuBackdrop} onPress={onClearWallContextMenu} />
          <GlassSurface
            style={[
              styles.dropdownPanel,
              {
                position: "absolute",
                marginTop: 0,
                left: Math.max(8, Math.min(wallContextMenu.x, width - 228)),
                top: Math.max(8, Math.min(wallContextMenu.y, height - 160)),
                zIndex: 150,
              },
            ]}
          >
            <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderColor: GLASS.border }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: GLASS.text }}>
                {wallContextMenu.wallId === "back"
                  ? "Pared Trasera"
                  : wallContextMenu.wallId === "left"
                  ? "Pared Izquierda"
                  : "Pared Derecha"}
              </Text>
            </View>
            <DropdownItem
              label="Editar pared"
              onPress={() => {
                const wId = wallContextMenu.wallId;
                onClearWallContextMenu?.();
                setEditingWall?.(wId);
              }}
            />
            {wallContextMenu.wallId !== "back" && (
              <DropdownItem
                label={
                  wallContextMenu.wallId === "left"
                    ? room3dProps.leftWall
                      ? "Ocultar pared"
                      : "Mostrar pared"
                    : room3dProps.rightWall
                    ? "Ocultar pared"
                    : "Mostrar pared"
                }
                onPress={() => {
                  const wId = wallContextMenu.wallId;
                  setRoom3d((prev) => ({
                    ...prev,
                    [wId === "left" ? "leftWall" : "rightWall"]:
                      wId === "left" ? !prev.leftWall : !prev.rightWall,
                  }));
                  onClearWallContextMenu?.();
                }}
              />
            )}
          </GlassSurface>
        </>
      )}

      {editingWall && (
        <EditWallModal
          wallId={editingWall}
          room3d={room3dProps}
          setRoom3d={setRoom3d}
          materials={materials}
          materialCategories={materialCategories}
          materialTypes={materialTypes}
          materialDataById={materialDataById}
          globalMaterials={globalMaterials}
          designObjects={designObjects}
          onMaterialDataResolved={onMaterialDataResolved}
          onClose={() => setEditingWall?.(null)}
        />
      )}

      <GenerateImagesModal
        visible={isGenerateImagesModalVisible}
        onClose={() => {
          setIsGenerateImagesModalVisible(false);
          setReopenEditViewId(null);
        }}
        savedViews={savedViews}
        setSavedViews={setSavedViews}
        captureApi={captureApi}
        projectName={projectName}
        onStartFraming={handleStartFraming}
        reopenEditViewId={reopenEditViewId}
        onClearReopenEditView={() => setReopenEditViewId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "box-none",
  },
  centerContainer: {
    width: "100%",
    height: "100%",
    flexDirection: "column",
    alignItems: "center",
    pointerEvents: "box-none",
  },
  modalArea: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingTop: 64,
    paddingBottom: 20,
    pointerEvents: "box-none",
  },
  modalAreaAboveDock: {
    justifyContent: "flex-end",
    paddingBottom: 8,
  },
  widePanel: {
    width: "88%",
    maxWidth: 780,
  },
  sheetPanel: {
    width: "100%",
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
    shadowOpacity: 0,
    elevation: 0,
  },
  dockWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    zIndex: 100,
  },
  dockSurface: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "center",
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: RADII.full,
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
  },
  dockPrimaryAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: RADII.full,
  },
  dockPrimaryActionActive: {
    backgroundColor: COLORS.primaryPressed,
  },
  dockPrimaryText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  dockDivider: {
    width: 1,
    height: 22,
    backgroundColor: GLASS.border,
    marginHorizontal: 4,
  },
  dockAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: RADII.full,
  },
  dockActionActive: {
    backgroundColor: GLASS.bgPressed,
  },
  dockButtonPressed: {
    opacity: 0.85,
  },
  dockActionText: {
    fontSize: 13,
    fontWeight: "600",
    color: GLASS.text,
  },
  dockActionTextActive: {
    color: COLORS.primary,
    fontWeight: "700",
  },
  countBadge: {
    backgroundColor: GLASS.bgInput,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: RADII.sm,
    borderWidth: 1,
    borderColor: GLASS.border,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: GLASS.textMuted,
  },
  widgetAnchor: {
    position: "absolute",
    top: 24,
    right: 24,
    alignItems: "flex-end",
    zIndex: 130,
  },
  materialCardBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 120,
  },
  widgetPanel: {
    marginTop: 12,
  },
  menuBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 90,
  },
  optionsContainer: {
    position: "absolute",
    top: 24,
    zIndex: 100,
    flexDirection: "column",
    alignItems: "center",
    pointerEvents: "box-none",
  },
  optionsContainerLeft: {
    left: 24,
    alignItems: "flex-start",
  },
  dropdownPanel: {
    marginTop: 8,
    minWidth: 220,
    borderRadius: RADII.lg,
    overflow: "visible",
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  dropdownItemPressed: {
    backgroundColor: GLASS.bgPressed,
  },
  dropdownSubmenuItem: {
    paddingLeft: 28,
  },
  dropdownItemText: {
    fontSize: 14,
    fontWeight: "600",
    color: GLASS.text,
    letterSpacing: 0.3,
  },
  dropdownChevron: {
    fontSize: 12,
    color: GLASS.textMuted,
    marginLeft: 8,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: GLASS.border,
    marginVertical: 4,
  },
  dropdownSubmenu: {
    backgroundColor: GLASS.bgInput,
    borderTopWidth: 1,
    borderTopColor: GLASS.border,
    marginHorizontal: 8,
    marginBottom: 6,
    borderRadius: RADII.md,
    paddingVertical: 4,
  },
  dropdownExportItem: {
    position: "relative",
  },
  dropdownSideSubmenu: {
    position: "absolute",
    left: "100%",
    top: 0,
    marginLeft: 8,
    minWidth: 200,
    backgroundColor: GLASS.bg,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: GLASS.border,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  toolbarButton: {
    borderRadius: RADII.full,
  },
  toolbarButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  toolbarIcon: {
    marginRight: 2,
  },
  toolbarButtonPressed: {
    backgroundColor: GLASS.bgPressed,
  },
  toolbarButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: GLASS.text,
    letterSpacing: 0.3,
  },
  framingMaskBar: {
    position: "absolute",
    backgroundColor: "rgba(30, 35, 45, 0.58)",
  },
  framingViewportBorder: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.85)",
  },
  framingBadgeWrap: {
    position: "absolute",
    top: 20,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  framingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(17, 24, 39, 0.78)",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: RADII.full,
  },
  framingBadgeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "700",
  },
  framingActionsBottom: {
    position: "absolute",
    bottom: 28,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 200,
  },
  framingActionsSurface: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: RADII.full,
    backgroundColor: GLASS.bgStrong,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  framingCancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: RADII.full,
    backgroundColor: GLASS.bgInput,
    borderWidth: 1,
    borderColor: GLASS.border,
  },
  framingCancelText: {
    fontSize: 13,
    fontWeight: "700",
    color: GLASS.text,
  },
  framingConfirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: RADII.full,
    backgroundColor: COLORS.primary,
  },
  framingConfirmText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.white,
  },
});
