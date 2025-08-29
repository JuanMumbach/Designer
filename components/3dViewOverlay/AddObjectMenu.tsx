import { Button, ScrollView, StyleSheet, Text, View } from "react-native";
import { DesignObjectTypeProps } from "../3dView/DesignObjects";

export default function AddObjectMenu({ designObjectTypes }: { designObjectTypes: DesignObjectTypeProps[] })
{
    return (
        <ScrollView style={styles.container}>
            {designObjectTypes.map((obj, index) => (
                <View key={index} style={styles.element}>
                    <Text>
                        {obj.name}<br></br>
                        Width: {obj.width}   Height: {obj.height}   Depth: {obj.depth}<br></br>
                    </Text>
                    <Button title={"Add"}></Button>
                </View>
                
                /*
                < 
                    key={index} 
                    type={obj.type} 
                    scale={obj.scale} 
                    position={obj.position} 
                    rotation={obj.rotation} 
                    onClick={obj.onClick} 
                />
                */
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