import { Dimensions, StyleSheet, View } from "react-native";
import Button from "../Button";

const debugColors = false;

export default function View3dOverlay() {
  return (
    <View style={styles.overlay}>
        
        {(Dimensions.get('window').width > 768) && 
        (
          <View style={[styles.column, {backgroundColor: debugColors ? 'rgba(255, 0, 0, 0.25)' : 'transparent'}]}>
            <Button label="Left Button 1" onPress={() => console.log("Left Button 1 Pressed")} />
            <Button label="Left Button 2" onPress={() => console.log("Left Button 2 Pressed")} />
          </View>
        )}

        <View style={[styles.middleColumn, {backgroundColor: debugColors ? 'rgba(4, 0, 255, 0.25)' : 'transparent'}]}>
          <View style={[styles.mainControls, {backgroundColor: debugColors ? 'rgba(51, 255, 0, 0.25)' : 'transparent'}]}>
            <Button label="Main Button 1" onPress={() => console.log("Main Button 1 Pressed")} />
          </View>
        </View>

        {(Dimensions.get('window').width > 768) && 
        (
          <View style={[styles.column, {backgroundColor: debugColors ? 'rgba(255, 0, 0, 0.25)' : 'transparent'}]}>
          <Button label="Right Button 1" onPress={() => console.log("Right Button 1 Pressed")} />
          <Button label="Right Button 2" onPress={() => console.log("Right Button 2 Pressed")} />
          </View>
        )}
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
    alignItems: 'center',
    pointerEvents: "box-none",      
    paddingBottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  column: {
    width: "auto",
    justifyContent: 'flex-end',
    padding: 10,
    height: '100%',
    flex: .5,
    pointerEvents: "box-none"
  },
  middleColumn: {
    width: "auto",
    justifyContent: 'flex-end',
    padding: 10,
    height: '100%',
    flex: 1,
    pointerEvents: "box-none"
  },
  mainControls: {
    height: "auto",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 30, 
    pointerEvents: "box-none"
  }
});