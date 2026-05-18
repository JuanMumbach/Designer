import { ScrollView, StyleSheet, Text, View } from "react-native";
import Button from "../../Button";
import { DesignObject } from "../3dView/DesignObjects";

interface FurnitureInstancesManagerProps {
    furnitureInstances: DesignObject[];
    onFurnitureSelect: (object: DesignObject) => void;
    onClose: () => void;
}

export default function FurnitureInstancesManager({
    furnitureInstances,
    onFurnitureSelect,
    onClose
}: FurnitureInstancesManagerProps) {

    return (
        <View style={styles.container}>
            <Text style={styles.headerTitle}>Objects in Room</Text>

            <ScrollView style={styles.scrollList} contentContainerStyle={{ paddingBottom: 10 }}>
                {furnitureInstances.length === 0 ? (
                    <Text style={styles.emptyText}>No objects added yet.</Text>
                ) : (
                    furnitureInstances.map((obj, index) => (
                        <View key={index} style={styles.cardItem}>
                            <View style={styles.infoContainer}>
                                <Text style={styles.itemName}>{obj.name}</Text>
                                <Text style={styles.itemType}>{obj.name}</Text>
                                <View style={styles.badgesRow}>
                                    <Text style={styles.badge}>
                                        {obj.dimensions[0]} x {obj.dimensions[1]} x {obj.dimensions[2]} m
                                    </Text>
                                </View>
                            </View>

                            <Button label="Edit" onPress={() => onFurnitureSelect(obj)} />
                        </View>
                    ))
                )}
            </ScrollView>

            <View style={styles.footer}>
                <Button label="Done" onPress={onClose} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: 300,
        maxHeight: '70%',
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 10,
        overflow: 'hidden',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 16,
        textAlign: 'center',
    },
    scrollList: {
        marginBottom: 10,
    },
    cardItem: {
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#f3f4f6',
    },
    infoContainer: {
        flex: 1,
        marginRight: 12,
    },
    itemName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    itemType: {
        fontSize: 12,
        color: '#6b7280',
        marginBottom: 4,
    },
    badgesRow: {
        flexDirection: 'row',
        marginTop: 4,
    },
    badge: {
        backgroundColor: '#e5e7eb',
        color: '#374151',
        fontSize: 10,
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 4,
        overflow: 'hidden',
    },
    emptyText: {
        textAlign: 'center',
        color: '#9ca3af',
        marginTop: 20,
        fontStyle: 'italic',
    },
    footer: {
        marginTop: 10,
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#f3f4f6',
        paddingTop: 16,
    }
});
