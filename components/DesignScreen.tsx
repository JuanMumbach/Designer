import Design3dView, { defaultCounterObjects, defaultCupboardObjects } from "@/components/DesignScreen/Design3dViewer";
import View3dOverlay from "@/components/DesignScreen/View3dOverlay";
import { useState } from "react";
import { View } from "react-native";
import { FurnitureInstanceProps, FurnitureType, NewFurnitureInstance, furnitureModels } from "./DesignScreen/3dView/DesignObjects";
import { Room3dProps } from "./DesignScreen/3dView/Room3d";


const initialRoom3d: Room3dProps = {
  width: 5,
  height: 3,
  depth: 4,
  leftWall: true,
  rightWall: true
};


defaultCounterObjects.push(NewFurnitureInstance(furnitureModels[0], [0.6, 0, 0]));
defaultCounterObjects.push(NewFurnitureInstance(furnitureModels[1]));
defaultCounterObjects.push(NewFurnitureInstance(furnitureModels[1]));
defaultCounterObjects.push(NewFurnitureInstance(furnitureModels[0], [0.6, 0, 0]));
defaultCupboardObjects.push(NewFurnitureInstance(furnitureModels[2]));
defaultCupboardObjects.push(NewFurnitureInstance(furnitureModels[3]));
defaultCupboardObjects.push(NewFurnitureInstance(furnitureModels[2]));
defaultCupboardObjects.push(NewFurnitureInstance(furnitureModels[2]));
defaultCupboardObjects.push(NewFurnitureInstance(furnitureModels[3], [0.6, 0, 0]));

export default function DesignScreen() {
  const [room3d, setRoom3d] = useState<Room3dProps>(initialRoom3d);
  const [counterLineObjects, setCounterObjects] = useState<FurnitureInstanceProps[]>(defaultCounterObjects);
  const [cupboardLineObjects, setCupboardObjects] = useState<FurnitureInstanceProps[]>(defaultCupboardObjects);
  const [movingObject, setMovingObject] = useState<FurnitureInstanceProps | undefined>(undefined);

  const handleObjectInteraction = (object: FurnitureInstanceProps) => {
    console.log("Interacted with object:", object.id);
    setMovingObject(object);
  };

  const handleObjectAdded = (newObject: FurnitureInstanceProps) => {
    if (newObject.type.type === FurnitureType.Counter) {
      setCounterObjects(prevObjects => [...prevObjects, newObject]);
    }

    if (newObject.type.type === FurnitureType.Cupboard) {
      setCupboardObjects(prevObjects => [...prevObjects, newObject]);
    }
  };

  // 1. NUEVA FUNCIÓN PARA EDITAR OBJETOS
  const handleObjectEdited = (id: string, updates: { name: string, position: [number, number, number] }) => {

    // Función de ayuda para encontrar y actualizar un objeto en un array de estado
    const updateObjects = (prevObjects: FurnitureInstanceProps[]) => {
      // 1.1 Mapear el array para encontrar el objeto por ID
      return prevObjects.map(obj => {
        if (obj.id === id) {
          // 1.2 Actualizar el objeto de forma inmutable
          return {
            ...obj,
            name: updates.name,
            position: updates.position,
            // Opcional: actualizar otras propiedades si las estás editando
          };
        }
        return obj; // Devolver los objetos no modificados
      });
    };

    // 1.3 Comprobar en qué array existe el objeto y aplicar la actualización
    const isCounterObject = counterLineObjects.some(obj => obj.id === id);

    if (isCounterObject) {
      setCounterObjects(updateObjects);
    } else {
      // Si no está en Counter, asumimos que está en Cupboard (se puede mejorar la lógica de búsqueda)
      setCupboardObjects(updateObjects);
    }
  };

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Design3dView {...{ room3d }} counterObjects={counterLineObjects} cupboardObjects={cupboardLineObjects} onObjectInteraction={handleObjectInteraction} onObjectEdited={handleObjectEdited}></Design3dView>
      <View3dOverlay
        room3dProps={room3d}
        setRoom3d={setRoom3d}
        // Nota: designObjects solo se está usando para ObjectsManager, que debe mostrar ambos arrays. 
        // Por simplicidad, aquí sigues pasando solo counterLineObjects.
        designObjects={counterLineObjects}
        onObjectAdded={handleObjectAdded}
        // 2. PASAR LA NUEVA FUNCIÓN DE EDICIÓN AL OVERLAY
        onObjectEdited={handleObjectEdited}
        movingObject={movingObject}
        setMovingObject={setMovingObject}
      >
      </View3dOverlay>
    </View>
  );
}