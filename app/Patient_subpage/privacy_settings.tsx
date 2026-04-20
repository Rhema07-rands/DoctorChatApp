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
import { useAppLock } from '../_context/AppLockContext';
import { useUser } from '../_context/UserContext';
import { mediaCacheService } from '../../src/services/mediaCacheService';

export default function PatientPrivacySettingsScreen() {
    const router = useRouter();
    const {
        email, setEmail,
        phone, setPhone,
        password, setPassword
    } = useUser();

    const [confirmPassword, setConfirmPassword] = React.useState('');

    const {
        appLockPin,
        timeoutOption,
        enablePin,
        disablePin,
        setTimeoutOption
    } = useAppLock();

    const [pinInput, setPinInput] = React.useState('');
    const [isSettingPin, setIsSettingPin] = React.useState(false);
    const [cacheSize, setCacheSize] = React.useState<string>('Calculating...');

    React.useEffect(() => {
        const fetchCacheSize = async () => {
            const bytes = await mediaCacheService.getCacheSize();
            setCacheSize((bytes / 1024 / 1024).toFixed(1) + ' MB');
        };
        fetchCacheSize();
    }, []);

    const handleClearCache = async () => {
        Alert.alert(
            "Clear Media Cache",
            "This will remove all locally stored voice notes and images. They will be re-downloaded from the server when you view them again.",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Clear", 
                    style: "destructive", 
                    onPress: async () => {
                        await mediaCacheService.clearCache();
                        setCacheSize('0.0 MB');
                        Alert.alert("Success", "Media cache cleared.");
                    }
                }
            ]
        );
    };

    const handleSave = () => {
        if (password !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match. Please try again.');
            return;
        }
        Alert.alert("Success", "Privacy settings updated.");
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
                    <Text style={styles.infoText}>Manage your health account's primary contact and security information.</Text>

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

                {/* App Lock Settings Segment */}
                <View style={[styles.formSection, { marginTop: 24, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 24 }]}>
                    <Text style={[styles.headerTitle, { fontSize: 16 }]}>App Security Lock</Text>
                    <Text style={styles.infoText}>Protect sensitive data by requiring a 4-digit PIN when returning to the app.</Text>

                    {appLockPin ? (
                        <View style={styles.lockContainer}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981' }} />
                                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#1E293B' }}>App Lock Enabled</Text>
                                </View>
                                <TouchableOpacity onPress={() => disablePin()} style={{ padding: 6, backgroundColor: '#FEF2F2', borderRadius: 8 }}>
                                    <Text style={{ color: '#EF4444', fontWeight: '500', fontSize: 13 }}>Remove PIN</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.label}>Auto-Lock Timeout</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                                {[
                                    { label: 'Immediately', value: 0 },
                                    { label: '5 seconds', value: 5000 },
                                    { label: '1 minute', value: 60000 },
                                    { label: '5 minutes', value: 300000 }
                                ].map((opt) => (
                                    <TouchableOpacity
                                        key={opt.value}
                                        onPress={() => setTimeoutOption(opt.value as any)}
                                        style={[
                                            styles.timeoutOption,
                                            timeoutOption === opt.value && styles.timeoutOptionActive
                                        ]}
                                    >
                                        <Text style={[
                                            styles.timeoutOptionText,
                                            timeoutOption === opt.value && styles.timeoutOptionTextActive
                                        ]}>{opt.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    ) : (
                        <View style={styles.lockContainer}>
                            {!isSettingPin ? (
                                <TouchableOpacity 
                                    style={styles.setupPinBtn}
                                    onPress={() => setIsSettingPin(true)}
                                >
                                    <Ionicons name="lock-closed-outline" size={20} color="#FFF" />
                                    <Text style={styles.setupPinText}>Setup 4-Digit PIN</Text>
                                </TouchableOpacity>
                            ) : (
                                <View style={{ gap: 12 }}>
                                    <Text style={styles.label}>Enter a new 4-digit PIN</Text>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <TextInput
                                            style={[styles.input, { flex: 1, letterSpacing: 8, fontSize: 18, textAlign: 'center' }]}
                                            value={pinInput}
                                            onChangeText={(t) => setPinInput(t.replace(/[^0-9]/g, '').slice(0, 4))}
                                            keyboardType="number-pad"
                                            secureTextEntry
                                            placeholder="••••"
                                            autoFocus
                                        />
                                        <TouchableOpacity 
                                            style={[styles.setupPinBtn, { flex: 0, paddingHorizontal: 20, opacity: pinInput.length === 4 ? 1 : 0.5 }]}
                                            disabled={pinInput.length !== 4}
                                            onPress={async () => {
                                                await enablePin(pinInput);
                                                setIsSettingPin(false);
                                                setPinInput('');
                                                Alert.alert('Success', 'App Lock PIN has been securely set.');
                                            }}
                                        >
                                            <Text style={styles.setupPinText}>Save</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity 
                                            style={{ justifyContent: 'center', paddingHorizontal: 10 }}
                                            onPress={() => setIsSettingPin(false)}
                                        >
                                            <Ionicons name="close" size={24} color="#64748B" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </View>
                    )}
                </View>

                {/* Storage & Cache Segment */}
                <View style={[styles.formSection, { marginTop: 24, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 24 }]}>
                    <Text style={[styles.headerTitle, { fontSize: 16 }]}>Storage & Cache</Text>
                    <Text style={styles.infoText}>Manage the space used by downloaded media files like voice notes and images.</Text>
                    
                    <View style={styles.lockContainer}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View>
                                <Text style={styles.label}>Media Cache Size</Text>
                                <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B' }}>{cacheSize}</Text>
                            </View>
                            <TouchableOpacity 
                                onPress={handleClearCache}
                                style={{ paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#F1F5F9', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' }}
                            >
                                <Text style={{ color: '#475569', fontWeight: '600', fontSize: 13 }}>Clear Cache</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
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
    lockContainer: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#F1F5F9' },
    setupPinBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#3B82F6', paddingVertical: 12, borderRadius: 10, gap: 8 },
    setupPinText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
    timeoutOption: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
    timeoutOptionActive: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
    timeoutOptionText: { fontSize: 13, color: '#64748B', fontWeight: '500' },
    timeoutOptionTextActive: { color: '#2563EB', fontWeight: '600' },
});
