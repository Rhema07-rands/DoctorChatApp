import * as Device from 'expo-device';
import { Text, View } from 'react-native';

export default function TestResolve() {
    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text>Is Device: {Device.isDevice ? 'Yes' : 'No'}</Text>
        </View>
    );
}
