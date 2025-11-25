import { Button, ScrollView, StyleSheet, Text, View } from "react-native";
import { FurnitureProps } from "../3dView/DesignObjects";

export default function ListFurnitureModels({
  designObjectTypes,
  addObjectAction,
}: {
  designObjectTypes: FurnitureProps[],
  addObjectAction: (objectType: FurnitureProps) => void;
}){
    
    return (
        <ScrollView style={styles.container}>
            {designObjectTypes.map((obj, index) => (
                <View key={index} style={styles.element}>
                    <Text>
                        {obj.name}<br></br>
                        Width: {obj.width}   Height: {obj.height}   Depth: {obj.depth}<br></br>
                    </Text>
                    <Button title={"Add"} onPress={() => addObjectAction(obj)}></Button>
                </View>
            ))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#fff',
    },
    element: {
        margin: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 5,
    },
});