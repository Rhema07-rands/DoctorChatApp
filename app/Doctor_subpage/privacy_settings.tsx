import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
    Alert,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../_context/UserContext';

export default function PrivacySettingsScreen() {
    const router = useRouter();
    const {
        email, setEmail,
        phone, setPhone,
        password, setPassword
    } = useUser();

    const [confirmPassword, setConfirmPassword] = React.useState('');

    const handleSave = () => {
        if (password !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match. Please try again.');
            return;
        }

        // In a real app, you would verify email/phone formatting here too
        router.back();
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Privacy Settings</Text>
                <TouchableOpacity onPress={handleSave}>
                    <Text style={styles.saveText}>Save</Text>
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <View style={styles.formSection}>
                    <Text style={styles.infoText}>Manage your account's primary contact and security information.</Text>

                    <Text style={styles.label}>Email Address</Text>
                    <TextInput
                        style={styles.input}
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                    />

                    <Text style={styles.label}>Phone Number</Text>
                    <TextInput
                        style={styles.input}
                        value={phone}
                        onChangeText={setPhone}
                        keyboardType="phone-pad"
                    />

                    <Text style={styles.label}>New Password</Text>
                    <TextInput
                        style={styles.input}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        placeholder="Enter new password"
                    />

                    <Text style={styles.label}>Confirm New Password</Text>
                    <TextInput
                        style={styles.input}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                        placeholder="Confirm your new password"
                    />
                    <Text style={styles.hint}>Ensure your password is at least 8 characters long.</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'white' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
    saveText: { fontSize: 16, color: '#3B82F6', fontWeight: '600' },
    scrollContent: { padding: 20 },
    formSection: { gap: 16 },
    infoText: { fontSize: 14, color: '#64748B', marginBottom: 8 },
    label: { fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 4 },
    input: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 10,
        padding: 12,
        fontSize: 15,
        color: '#1E293B',
    },
    hint: { fontSize: 12, color: '#94A3B8', marginTop: -8 },
});
