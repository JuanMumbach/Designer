import Design3dView, { counterLineObjects } from "@/components/Design3dViewer";
import View3dOverlay from "@/components/View3dOverlay";
import { View } from "react-native";

export default function Index() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Design3dView></Design3dView>
      <View3dOverlay designObjects={counterLineObjects}></View3dOverlay>
    </View>
  );
}
