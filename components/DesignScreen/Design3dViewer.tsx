import { OrbitControls } from '@react-three/drei/native';
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import React, { useRef, useState } from 'react';
import * as THREE from 'three';
import DesignObjectsRenderer, { AppliedMaterial, DesignObject, GlobalMaterials } from "./3dView/DesignObjects";
import Room3d, { Room3dProps, RoomOrigin } from "./3dView/Room3d";
import { MaterialSlotInfo } from "../../services/materialSlots";
import { ObjectMaterialType } from "../../services/api";
import { COLORS } from "@/constants/theme";

const cameraControlsProps = {
    mouseButtons: {
      MIDDLE: THREE.MOUSE.ROTATE,
    },
    touches: {
      ONE: THREE.TOUCH.ROTATE,
    },
    enableDamping: false,
    minAzimuthAngle: -Math.PI / 4,
    maxAzimuthAngle: Math.PI / 4,
    minPolarAngle: Math.PI / 4+.3,
    maxPolarAngle: Math.PI / 4+.3,
    rotateSpeed: 0.25,
  };

function CameraController({room3d}: {room3d : Room3dProps}) {
  const { camera } = useThree();

  useFrame(() => {
    camera.lookAt(0, 1.5, room3d.depth / 2);
    camera.updateProjectionMatrix();
  });

  return null;
}

interface WallCulling {
  left: boolean;
  right: boolean;
}

function useWallCulling(room3d: Room3dProps): WallCulling {
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

  return culling;
}

const handleBoxClick = () => {
    console.log("Box clicked!");
  }

function SceneContent({
  room3d,
  designObjects,
  onObjectInteraction,
  onObjectEdited,
  onObjectDeleted,
  onEditObject,
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
  typeToDesignSlot
}: {
  room3d: Room3dProps,
  designObjects: DesignObject[],
  onObjectInteraction: (object: DesignObject) => void,
  onObjectEdited?: (id: string, updates: { name: string, position: [number, number, number], rotation?: number, hidden?: boolean }) => void,
  onObjectDeleted?: (id: string) => void,
  onEditObject?: (object: DesignObject) => void,
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
  typeToDesignSlot?: Record<string, string>
}) {
  const wallCulling = useWallCulling(room3d);
  let roomOrigin = RoomOrigin({room3d});

  return (
    <>
      <CameraController room3d={room3d}/>
      <Room3d {...room3d} culledLeft={wallCulling.left} culledRight={wallCulling.right}/>
      <DesignObjectsRenderer
          objects={designObjects}
          origin={roomOrigin}
          onObjectInteraction={onObjectInteraction}
          onObjectEdited={onObjectEdited}
          onObjectDeleted={onObjectDeleted}
          onEditObject={onEditObject}
          movingObjectId={movingObject?.id}
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
      />
      <OrbitControls {...cameraControlsProps} enabled={draggingRef.current === 0} />
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
  movingObject,
  setMovingObject,
  magnetEnabled,
  onDragStateChange,
  onSlotsDiscovered,
  globalMaterials,
  globalMaterialsRaw,
  materialDataById,
  slotTypesByModel,
  typeToDesignSlot}:
  {
  room3d: Room3dProps,
  designObjects: DesignObject[],
  onObjectInteraction: (object: DesignObject) => void,
  onObjectEdited?: (id: string, updates: { name: string, position: [number, number, number], rotation?: number }) => void,
  onObjectDeleted?: (id: string) => void,
  onEditObject?: (object: DesignObject) => void,
  movingObject?: DesignObject,
  setMovingObject?: (object?: DesignObject) => void,
  magnetEnabled: boolean,
  onDragStateChange?: (isDragging: boolean) => void,
  onSlotsDiscovered?: (id: string, slots: MaterialSlotInfo[]) => void,
  globalMaterials?: Record<string, AppliedMaterial>,
  globalMaterialsRaw?: GlobalMaterials,
  materialDataById?: Record<string, AppliedMaterial>,
  slotTypesByModel?: Record<string, ObjectMaterialType[]>,
  typeToDesignSlot?: Record<string, string>
})
{
  const isDragging = useRef(0);
  const [, forceUpdate] = useState(0);

  const handleDragStateChange = (dragging: boolean) => {
    isDragging.current += dragging ? 1 : -1;
    if (onDragStateChange) onDragStateChange(isDragging.current > 0);
    forceUpdate(n => n + 1);
  };

  console.log("Design3dView render, designObjects:", designObjects);
  return (
    <Canvas
    shadows
    style={{ background: COLORS.sceneBg }}
    camera={{ position: [0, 3, 3] }}
    onPointerMissed={() => {
        console.log("Canvas clicked. Deselecting objects.");
        if (setMovingObject) setMovingObject(undefined);
      }}
    >
        <ambientLight intensity={.25}/>
        <pointLight castShadow position={[0, 3, room3d.depth*.75]} intensity={(room3d.depth*room3d.width)*2} />
        <SceneContent
            room3d={room3d}
            designObjects={designObjects}
            onObjectInteraction={onObjectInteraction}
            onObjectEdited={onObjectEdited}
            onObjectDeleted={onObjectDeleted}
            onEditObject={onEditObject}
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
        />
        <fog attach="fog" args={[COLORS.sceneBg, 5, 20]} />
    </Canvas>
  );
}
