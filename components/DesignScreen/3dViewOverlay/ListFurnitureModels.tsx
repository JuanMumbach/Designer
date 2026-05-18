import { ScrollView, StyleSheet, Text, View } from "react-native";
import Button from "../../Button";
import { ObjectTemplate } from "../3dView/DesignObjects";

export default function ListFurnitureModels({
  designObjectTypes,
  addObjectAction,
}: {
  designObjectTypes: ObjectTemplate[],
  addObjectAction: (objectType: ObjectTemplate) => void;
}){
    if (designObjectTypes.length === 0) {
        return (
            <View style={styles.container}>
                <Text style={styles.emptyText}>No furniture models available.</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            {designObjectTypes.map((obj, index) => (
                <View key={index} style={styles.element}>
                    <Text>
                        {obj.name}<br></br>
                        Width: {obj.width}   Height: {obj.height}   Depth: {obj.depth}<br></br>
                    </Text>
                    <Button label="Select" onPress={() => addObjectAction(obj)} />
                </View>
            ))}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
      width: 300,
      backgroundColor: '#f9fafb',
      borderRadius: 16,
      padding: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 10,
    },
    element: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'white',
        marginBottom: 10,
        padding: 16,
        borderRadius: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    textContainer: {
        flex: 1,
        marginRight: 10,
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 4,
    },
    details: {
        fontSize: 12,
        color: '#6b7280',
    },
    emptyText: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
        padding: 20,
    }
});
