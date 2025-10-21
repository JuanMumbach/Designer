import Design3dView, { counterLineObjects } from "@/components/DesignScreen/Design3dViewer";
import View3dOverlay from "@/components/DesignScreen/View3dOverlay";
import { useState } from "react";
import { View } from "react-native";
import { Room3dProps } from "./3dView/Room3d";


const initialRoom3d: Room3dProps = {
    width: 5,
    height: 3,
    depth: 4,
    leftWall: true,
    rightWall: true
};

export default function DesignScreen(){
    const [room3d, setRoom3d] = useState<Room3dProps>(initialRoom3d);

    return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Design3dView {...room3d}></Design3dView>
      <View3dOverlay room3dProps={room3d} setRoom3d={setRoom3d} designObjects={counterLineObjects}></View3dOverlay>
    </View>
  );
}