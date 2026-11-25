import { OrbitControls } from '@react-three/drei/native';
import { Canvas, events, useFrame, useThree, type RootStore } from "@react-three/fiber";
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import DesignObjectsRenderer, { AppliedMaterial, DesignObject, GlobalMaterials } from "./3dView/DesignObjects";
import Room3d, { Room3dProps, RoomOrigin } from "./3dView/Room3d";
import { MaterialSlotInfo } from "../../services/materialSlots";
import { ObjectMaterialType } from "../../services/api";
import { COLORS } from "@/constants/theme";
import {
  ThumbnailCaptureApi,
  ThumbnailCaptureHost,
} from "../../services/thumbnailCapture";

function getEffectiveRenderOrder(object: THREE.Object3D): number {
  let current: THREE.Object3D | null = object;
  let maxOrder = 0;
  while (current) {
    if (current.renderOrder > maxOrder) {
      maxOrder = current.renderOrder;
    }
    current = current.parent;
  }
  return maxOrder;
}

function createLayeredEvents(store: RootStore) {
  const defaultEvents = events(store);
  return {
    ...defaultEvents,
    filter: (intersections: THREE.Intersection[]) => {
      return [...intersections].sort((a, b) => {
        const orderA = getEffectiveRenderOrder(a.object);
        const orderB = getEffectiveRenderOrder(b.object);
        if (orderA !== orderB) {
          return orderB - orderA;
        }
        return a.distance - b.distance;
      });
    },
  };
}

const cameraControlsProps = {
  mouseButtons: {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.ROTATE,
  },
  touches: {
    ONE: THREE.TOUCH.ROTATE,
  },
  enableDamping: false,
  minAzimuthAngle: -Math.PI / 4,
  maxAzimuthAngle: Math.PI / 4,
  minPolarAngle: Math.PI / 4 + 0.3,
  maxPolarAngle: Math.PI / 4 + 0.3,
  rotateSpeed: 0.25,
};

const framingCameraControlsProps = {
  mouseButtons: {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.ROTATE,
    RIGHT: THREE.MOUSE.PAN,
  },
  touches: {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN,
  },
  enableDamping: false,
  enableZoom: true,
  enablePan: true,
  minAzimuthAngle: -Infinity,
  maxAzimuthAngle: Infinity,
  minPolarAngle: 0.05,
  maxPolarAngle: Math.PI - 0.05,
  rotateSpeed: 0.4,
};

function CameraController({
  room3d,
  isFraming,
  controlsRef,
}: {
  room3d: Room3dProps;
  isFraming?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  controlsRef: React.RefObject<any>;
}) {
  const { camera } = useThree();

  useEffect(() => {
    if (!isFraming && controlsRef.current?.target) {
      controlsRef.current.target.set(0, 1.5, room3d.depth / 2);
      controlsRef.current.update?.();
    }
  }, [room3d.depth, isFraming, controlsRef]);

  useFrame(() => {
    if (controlsRef.current?.target) {
      camera.lookAt(controlsRef.current.target);
    } else {
      camera.lookAt(0, 1.5, room3d.depth / 2);
    }
    camera.updateProjectionMatrix();
  });

  return null;
}

interface WallCulling {
  left: boolean;
  right: boolean;
}

function useWallCulling(room3d: Room3dProps, override?: WallCulling | null): WallCulling {
  const { camera } = useThree();
  const [culling, setCulling] = useState<WallCulling>({ left: false, right: false });

  useFrame(() => {
    const camX = camera.position.x;
    const left = camX < -room3d.width / 2;
    const right = camX > room3d.width / 2;
    if (left !== culling.left || right !== culling.right) {
      setCulling({ left, right });
    }
  });

  return override ?? culling;
}

function SceneContent({
  room3d,
  designObjects,
  onObjectInteraction,
  onObjectEdited,
  onObjectDeleted,
  onEditObject,
  onObjectDuplicate,
  movingObject,
  setMovingObject,
  magnetEnabled,
  draggingRef,
  onDragStateChange,
  onSlotsDiscovered,
  globalMaterials,
  globalMaterialsRaw,
  materialDataById,
  slotTypesByModel,
  typeToDesignSlot,
  activeMeasurementSide,
  onSelectMeasurement,
  onWallContextMenu,
  isFraming,
  controlsRef,
  defaultHandleType,
  wallCullingOverride,
}: {
  room3d: Room3dProps,
  designObjects: DesignObject[],
  onObjectInteraction: (object: DesignObject) => void,
  onObjectEdited?: (id: string, updates: { name: string, position: [number, number, number], rotation?: number, hidden?: boolean }) => void,
  onObjectDeleted?: (id: string) => void,
  onEditObject?: (object: DesignObject) => void,
  onObjectDuplicate?: (object: DesignObject) => void,
  movingObject?: DesignObject,
  setMovingObject?: (object?: DesignObject) => void,
  magnetEnabled: boolean,
  draggingRef: React.MutableRefObject<number>,
  onDragStateChange?: (isDragging: boolean) => void,
  onSlotsDiscovered?: (id: string, slots: MaterialSlotInfo[]) => void,
  globalMaterials?: Record<string, AppliedMaterial>,
  globalMaterialsRaw?: GlobalMaterials,
  materialDataById?: Record<string, AppliedMaterial>,
  slotTypesByModel?: Record<string, ObjectMaterialType[]>,
  typeToDesignSlot?: Record<string, string>,
  activeMeasurementSide?: import('./3dViewOverlay/EditMeasurementModal').MeasurementSide,
  onSelectMeasurement?: (object: DesignObject, side: import('./3dViewOverlay/EditMeasurementModal').MeasurementSide, currentValue: number) => void,
  onWallContextMenu?: (wallId: import('./3dView/Room3d').WallIdentifier, event: any) => void,
  isFraming?: boolean,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  controlsRef: React.RefObject<any>,
  defaultHandleType?: string | null,
  wallCullingOverride?: WallCulling | null,
}) {
  const wallCulling = useWallCulling(room3d, wallCullingOverride);
  let roomOrigin = RoomOrigin({ room3d });

  return (
    <>
      <CameraController room3d={room3d} isFraming={isFraming} controlsRef={controlsRef} />
      <Room3d
        {...room3d}
        culledLeft={wallCulling.left}
        culledRight={wallCulling.right}
        materialDataById={materialDataById}
        globalMaterials={globalMaterials}
        globalMaterialsRaw={globalMaterialsRaw}
        designObjects={designObjects}
        onWallContextMenu={isFraming ? undefined : onWallContextMenu}
      />
      <DesignObjectsRenderer
        objects={designObjects}
        origin={roomOrigin}
        onObjectInteraction={isFraming ? () => {} : onObjectInteraction}
        onDeselect={() => setMovingObject?.(undefined)}
        onObjectEdited={isFraming ? undefined : onObjectEdited}
        onObjectDeleted={isFraming ? undefined : onObjectDeleted}
        onEditObject={isFraming ? undefined : onEditObject}
        onObjectDuplicate={isFraming ? undefined : onObjectDuplicate}
        movingObjectId={isFraming ? undefined : movingObject?.id}
        room3d={room3d}
        magnetEnabled={magnetEnabled}
        allObjects={designObjects}
        onDragStateChange={onDragStateChange}
        onSlotsDiscovered={onSlotsDiscovered}
        globalMaterials={globalMaterials}
        globalMaterialsRaw={globalMaterialsRaw}
        materialDataById={materialDataById}
        slotTypesByModel={slotTypesByModel}
        typeToDesignSlot={typeToDesignSlot}
        wallCulling={wallCulling}
        activeMeasurementSide={isFraming ? undefined : activeMeasurementSide}
        onSelectMeasurement={isFraming ? undefined : onSelectMeasurement}
        defaultHandleType={defaultHandleType}
      />
      <OrbitControls
        ref={controlsRef}
        {...(isFraming ? framingCameraControlsProps : cameraControlsProps)}
        enabled={draggingRef.current === 0}
      />
    </>
  );
}

export default function Design3dView({
  room3d,
  designObjects,
  onObjectInteraction,
  onObjectEdited,
  onObjectDeleted,
  onEditObject,
  onObjectDuplicate,
  movingObject,
  setMovingObject,
  magnetEnabled,
  onDragStateChange,
  onSlotsDiscovered,
  globalMaterials,
  globalMaterialsRaw,
  materialDataById,
  slotTypesByModel,
  typeToDesignSlot,
  captureApi,
  activeMeasurementSide,
  onSelectMeasurement,
  onWallContextMenu,
  isFraming,
  defaultHandleType,
}: {
  room3d: Room3dProps,
  designObjects: DesignObject[],
  onObjectInteraction: (object: DesignObject) => void,
  onObjectEdited?: (id: string, updates: { name: string, position: [number, number, number], rotation?: number }) => void,
  onObjectDeleted?: (id: string) => void,
  onEditObject?: (object: DesignObject) => void,
  onObjectDuplicate?: (object: DesignObject) => void,
  movingObject?: DesignObject,
  setMovingObject?: (object?: DesignObject) => void,
  magnetEnabled: boolean,
  onDragStateChange?: (isDragging: boolean) => void,
  onSlotsDiscovered?: (id: string, slots: MaterialSlotInfo[]) => void,
  globalMaterials?: Record<string, AppliedMaterial>,
  globalMaterialsRaw?: GlobalMaterials,
  materialDataById?: Record<string, AppliedMaterial>,
  slotTypesByModel?: Record<string, ObjectMaterialType[]>,
  typeToDesignSlot?: Record<string, string>,
  captureApi?: ThumbnailCaptureApi,
  activeMeasurementSide?: import('./3dViewOverlay/EditMeasurementModal').MeasurementSide,
  onSelectMeasurement?: (object: DesignObject, side: import('./3dViewOverlay/EditMeasurementModal').MeasurementSide, currentValue: number) => void,
  onWallContextMenu?: (wallId: import('./3dView/Room3d').WallIdentifier, event: any) => void,
  isFraming?: boolean,
  defaultHandleType?: string | null,
}) {
  const isDragging = useRef(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const [wallCullingOverride, setWallCullingOverride] = useState<WallCulling | null>(null);
  const [, forceUpdate] = useState(0);

  const handleDragStateChange = (dragging: boolean) => {
    isDragging.current = Math.max(0, isDragging.current + (dragging ? 1 : -1));
    if (onDragStateChange) onDragStateChange(isDragging.current > 0);
    forceUpdate(n => n + 1);
  };

  return (
    <Canvas
      shadows
      events={createLayeredEvents}
      style={{ background: COLORS.sceneBg }}
      camera={{ position: [0, 3, 3] }}
      onPointerDown={(e: any) => {
        const clientX = e.clientX ?? e.nativeEvent?.pageX ?? 0;
        const clientY = e.clientY ?? e.nativeEvent?.pageY ?? 0;
        pointerDownPosRef.current = { x: clientX, y: clientY };
      }}
      onPointerMissed={(e: any) => {
        if (pointerDownPosRef.current) {
          const clientX = e.clientX ?? e.nativeEvent?.pageX ?? 0;
          const clientY = e.clientY ?? e.nativeEvent?.pageY ?? 0;
          const dx = Math.abs(clientX - pointerDownPosRef.current.x);
          const dy = Math.abs(clientY - pointerDownPosRef.current.y);
          if (Math.sqrt(dx * dx + dy * dy) > 5) {
            return;
          }
        }
        if (setMovingObject) setMovingObject(undefined);
      }}
    >
      <ambientLight intensity={0.25} />
      <pointLight castShadow position={[0, 3, room3d.depth * 0.75]} intensity={(room3d.depth * room3d.width) * 2} />
      <SceneContent
        onWallContextMenu={onWallContextMenu}
        room3d={room3d}
        designObjects={designObjects}
        onObjectInteraction={onObjectInteraction}
        onObjectEdited={onObjectEdited}
        onObjectDeleted={onObjectDeleted}
        onEditObject={onEditObject}
        onObjectDuplicate={onObjectDuplicate}
        movingObject={movingObject}
        setMovingObject={setMovingObject}
        magnetEnabled={magnetEnabled}
        draggingRef={isDragging}
        onDragStateChange={handleDragStateChange}
        onSlotsDiscovered={onSlotsDiscovered}
        globalMaterials={globalMaterials}
        globalMaterialsRaw={globalMaterialsRaw}
        materialDataById={materialDataById}
        slotTypesByModel={slotTypesByModel}
        typeToDesignSlot={typeToDesignSlot}
        activeMeasurementSide={activeMeasurementSide}
        onSelectMeasurement={onSelectMeasurement}
        isFraming={isFraming}
        controlsRef={controlsRef}
        defaultHandleType={defaultHandleType}
        wallCullingOverride={wallCullingOverride}
      />
      {captureApi && (
        <ThumbnailCaptureHost
          captureApi={captureApi}
          defaultTarget={[0, 1.5, room3d.depth / 2]}
          controlsRef={controlsRef}
          roomWidth={room3d.width}
          onWallCullingOverride={setWallCullingOverride}
        />
      )}
      <fog attach="fog" args={[COLORS.sceneBg, 5, 20]} />
    </Canvas>
  );
}
