import Button from "@/components/Button";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { DesignObjectInstanceProps } from "../3dView/DesignObjects";

export default function ObjectsManager({ designObjects, onObjectSelect }: { 
    designObjects: DesignObjectInstanceProps[],
    onObjectSelect: (object: DesignObjectInstanceProps) => void 
})
{
    return (
        <ScrollView style={styles.container}>
            {designObjects.map((obj, index) => (
                <View key={index} style={styles.element}>
                    <Text>
                        {obj.name}<br></br>
                        {obj.type.name}<br></br>
                        {obj.dimensions[0]} x {obj.dimensions[1]} x {obj.dimensions[2]}<br></br>
                        {obj.color}<br></br>
                    </Text>
                    <Button label="Edit" onPress={() => onObjectSelect(obj)} />
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
        // Opcional: añade una pequeña sombra o cambio visual en el TouchableOpacity
    },
});