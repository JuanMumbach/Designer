import { ScrollView, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import Button from "../../Button";
import { DesignObject } from "../3dView/DesignObjects";
import { GLASS, RADII } from "@/constants/theme";
import GlassSurface from "./GlassSurface";

interface FurnitureInstancesManagerProps {
    furnitureInstances: DesignObject[];
    onFurnitureSelect: (object: DesignObject) => void;
    onClose: () => void;
    containerStyle?: StyleProp<ViewStyle>;
}

export default function FurnitureInstancesManager({
    furnitureInstances,
    onFurnitureSelect,
    onClose,
    containerStyle
}: FurnitureInstancesManagerProps) {

    return (
        <GlassSurface style={[styles.container, containerStyle]}>
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
        </GlassSurface>
    );
}

const styles = StyleSheet.create({
    container: {
        width: 300,
        maxHeight: '70%',
        borderRadius: RADII.xl,
        padding: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 10,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: GLASS.text,
        marginBottom: 16,
        textAlign: 'center',
    },
    scrollList: {
        marginBottom: 10,
    },
    cardItem: {
        backgroundColor: GLASS.bgInput,
        borderRadius: RADII.lg,
        padding: 12,
        marginBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: GLASS.border,
    },
    infoContainer: {
        flex: 1,
        marginRight: 12,
    },
    itemName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: GLASS.text,
    },
    itemType: {
        fontSize: 12,
        color: GLASS.textMuted,
        marginBottom: 4,
    },
    badgesRow: {
        flexDirection: 'row',
        marginTop: 4,
    },
    badge: {
        backgroundColor: 'rgba(255, 255, 255, 0.18)',
        color: GLASS.text,
        fontSize: 10,
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: RADII.sm,
        overflow: 'hidden',
    },
    emptyText: {
        textAlign: 'center',
        color: GLASS.textFaint,
        marginTop: 20,
        fontStyle: 'italic',
    },
    footer: {
        marginTop: 10,
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: GLASS.border,
        paddingTop: 16,
    }
});
