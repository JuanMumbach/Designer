import { useEffect, useState } from "react";
import { Dimensions, ScaledSize, StyleSheet, View } from "react-native";
import { DesignObjectInstanceProps, objectTypes } from "../3dView/DesignObjects";
import Button from "../Button";
import AddObjectMenu from "./AddObjectMenu";
import ObjectsManager from "./ObjectsManager";

const debugColors = false;


function useWindowDimensions() {
    const [windowDimensions, setWindowDimensions] = useState(Dimensions.get('window'));

    useEffect(() => {
        const onChange = ({ window }: { window: ScaledSize }) => {
            setWindowDimensions(window);
        };

        const subscription = Dimensions.addEventListener('change', onChange);
        
        return () => {
            subscription.remove();
        };
    }, []);

    return windowDimensions;
}

export default function View3dOverlay({designObjects}: {designObjects : DesignObjectInstanceProps[]}) {
  const { width } = useWindowDimensions();
  const [isObjectsManagerVisible, setIsObjectsManagerVisible] = useState(false);
  const [isAddObjectMenuVisible, setIsAddObjectMenuVisible] = useState(false);
  return (
    <View style={styles.overlay}>
        
        {(width > 768) && 
        (
          <View style={[styles.column, {backgroundColor: debugColors ? 'rgba(255, 0, 0, 0.25)' : 'transparent'}]}>
            <Button label="Edit Room" onPress={() => ""} />
          </View>
        )}

        <View style={[styles.middleColumn, {backgroundColor: debugColors ? 'rgba(4, 0, 255, 0.25)' : 'transparent'}]}>
          {(width <= 768) && 
          (
            isObjectsManagerVisible && (
            <ObjectsManager designObjects={designObjects}/>
          )
          )}
          
          {isAddObjectMenuVisible && (<AddObjectMenu designObjectTypes={objectTypes}/>)}
          
          <View style={[styles.mainControls, {backgroundColor: debugColors ? 'rgba(51, 255, 0, 0.25)' : 'transparent'}]}>
            <Button label="Add Object" onPress={() => setIsAddObjectMenuVisible(!isAddObjectMenuVisible)} />
          </View>
        </View>

        {(width > 768) && 
        (
          <View style={[styles.column, {backgroundColor: debugColors ? 'rgba(255, 0, 0, 0.25)' : 'transparent'}]}>
          {isObjectsManagerVisible && (
            <ObjectsManager designObjects={designObjects}/>
          )}
          <Button label="Edit Objects" onPress={() => setIsObjectsManagerVisible(!isObjectsManagerVisible)}/>
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