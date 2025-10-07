import { useState } from "react";
import { TextInput, View } from "react-native";
import { DesignObjectProps, NewInstance } from "../3dView/DesignObjects";
import Button from "../Button";
import { counterLineObjects } from "../Design3dViewer";


const [name, onChangeName] = useState("");
const [width, onChangeWidth] = useState(1);
const [height, onChangeHeight] = useState(1);
const [depth, onChangeDepth] = useState(1);
const [color, onChangeColor] = useState("#ffffff");
const [xdistance, onChangeXDistance] = useState("0");


/*
export interface DesignObjectInstanceProps {
  id: string;
  type: DesignObjectTypeProps;
  name: string;
  xdistance: number;
  dimensions: [number, number, number];
  color: string;
}
*/
export default function AddObjectMenu({newObjectType}: {newObjectType: DesignObjectProps}) {
    onChangeName(newObjectType.name);
    onChangeWidth(newObjectType.width);
    onChangeHeight(newObjectType.height);
    onChangeDepth(newObjectType.depth);
    onChangeColor("#ffffff");
    onChangeXDistance("0");

    return(
            <View>
                {newObjectType.name}<br></br>
                <TextInput onChangeText={onChangeName} value={name} placeholder={name}/>
                <Button label="Add Object" onPress={() => counterLineObjects.push(NewInstance(newObjectType))} />
            </View>
    )
}