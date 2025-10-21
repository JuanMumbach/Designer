import { ScrollView, StyleSheet, Text, View } from "react-native";
import { DesignObjectInstanceProps } from "../3dView/DesignObjects";

export default function ObjectsManager({ designObjects }: { designObjects: DesignObjectInstanceProps[] })
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