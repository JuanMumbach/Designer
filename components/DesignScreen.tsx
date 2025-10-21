import Design3dView, { defaultCounterObjects, defaultCupboardObjects } from "@/components/DesignScreen/Design3dViewer";
import View3dOverlay from "@/components/DesignScreen/View3dOverlay";
import { useState } from "react";
import { View } from "react-native";
import { DesignObjectInstanceProps, DesignObjectType, NewInstance, objectTypes } from "./DesignScreen/3dView/DesignObjects";
import { Room3dProps } from "./DesignScreen/3dView/Room3d";


const initialRoom3d: Room3dProps = {
  width: 5,
  height: 3,
  depth: 4,
  leftWall: true,
  rightWall: true
};


defaultCounterObjects.push(NewInstance(objectTypes[0], .6));
defaultCounterObjects.push(NewInstance(objectTypes[1]));
defaultCounterObjects.push(NewInstance(objectTypes[1]));
defaultCounterObjects.push(NewInstance(objectTypes[0], .6));
defaultCupboardObjects.push(NewInstance(objectTypes[2]));
defaultCupboardObjects.push(NewInstance(objectTypes[3]));
defaultCupboardObjects.push(NewInstance(objectTypes[2]));
defaultCupboardObjects.push(NewInstance(objectTypes[2]));
defaultCupboardObjects.push(NewInstance(objectTypes[3], .6));

export default function DesignScreen() {
  const [room3d, setRoom3d] = useState<Room3dProps>(initialRoom3d);
  const [counterLineObjects, setCounterObjects] = useState<DesignObjectInstanceProps[]>(defaultCounterObjects);
  const [cupboardLineObjects, setCupboardObjects] = useState<DesignObjectInstanceProps[]>(defaultCupboardObjects);

  const handleObjectAdded = (newObject: DesignObjectInstanceProps) => {
    if (newObject.type.type === DesignObjectType.Counter) {
      setCounterObjects(prevObjects => [...prevObjects, newObject]);
    }

    if (newObject.type.type === DesignObjectType.Cupboard) {
      setCupboardObjects(prevObjects => [...prevObjects, newObject]);
    }
  };
  
  // 1. NUEVA FUNCIÓN PARA EDITAR OBJETOS
  const handleObjectEdited = (id: string, updates: { name: string, xdistance: number }) => {
    
    // Función de ayuda para encontrar y actualizar un objeto en un array de estado
    const updateObjects = (prevObjects: DesignObjectInstanceProps[]) => {
      // 1.1 Mapear el array para encontrar el objeto por ID
      return prevObjects.map(obj => {
        if (obj.id === id) {
          // 1.2 Actualizar el objeto de forma inmutable
          return {
            ...obj,
            name: updates.name,
            xdistance: updates.xdistance,
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
      <Design3dView {...{ room3d }} counterObjects={counterLineObjects} cupboardObjects={cupboardLineObjects}></Design3dView>
      <View3dOverlay
        room3dProps={room3d}
        setRoom3d={setRoom3d}
        // Nota: designObjects solo se está usando para ObjectsManager, que debe mostrar ambos arrays. 
        // Por simplicidad, aquí sigues pasando solo counterLineObjects.
        designObjects={counterLineObjects} 
        onObjectAdded={handleObjectAdded}
        // 2. PASAR LA NUEVA FUNCIÓN DE EDICIÓN AL OVERLAY
        onObjectEdited={handleObjectEdited} 
      >
      </View3dOverlay>
    </View>
  );
}