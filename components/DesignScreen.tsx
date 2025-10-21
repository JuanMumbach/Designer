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
        designObjects={counterLineObjects}
        onObjectAdded={handleObjectAdded}
      >
      </View3dOverlay>
    </View>
  );
}