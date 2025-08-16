import { StyleSheet, View } from "react-native";
import Button from "./Button";

export default function View3dOverlay() {
  return (
    <View style={styles.overlay}>
        <Button label="Add Room" onPress={() => console.log("Add Room Pressed")} />
        <Button label="Add Room" onPress={() => console.log("Add Room Pressed")} />
        <Button label="Add Room" onPress={() => console.log("Add Room Pressed")} />
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
    justifyContent: 'flex-end', 
    alignItems: 'center',      
    paddingBottom: 30,
  }
});