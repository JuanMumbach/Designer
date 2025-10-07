import { Button, ScrollView, StyleSheet, Text, View } from "react-native";
import { DesignObjectProps } from "../3dView/DesignObjects";

export default function ListInstantiableObjects({
  designObjectTypes,
  addObjectAction,
}: {
  designObjectTypes: DesignObjectProps[],
  addObjectAction: () => void
}){
    
    return (
        <ScrollView style={styles.container}>
            {designObjectTypes.map((obj, index) => (
                <View key={index} style={styles.element}>
                    <Text>
                        {obj.name}<br></br>
                        Width: {obj.width}   Height: {obj.height}   Depth: {obj.depth}<br></br>
                    </Text>
                    <Button title={"Add"} onPress={() => addObjectAction}></Button>
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