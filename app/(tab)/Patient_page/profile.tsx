import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Image, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../../src/services/api';
import { uploadFile } from '../../../src/services/uploadService';
import { useTheme } from '../../_context/ThemeContext';
import { useUser } from '../../_context/UserContext';

export default function PatientProfile() {
    const router = useRouter();
    const { patientName, email, logout, profilePictureUrl, setProfilePictureUrl } = useUser();
    const { colors, isDark, toggle } = useTheme();

    const pickPhoto = async () => {
        const result = await DocumentPicker.getDocumentAsync({ type: 'image/*' });
        if (!result.canceled && result.assets?.[0]) {
            try {
                const serverUrl = await uploadFile(result.assets[0].uri, result.assets[0].mimeType || 'image/jpeg');
                await api.put('profile/picture', { ProfilePictureUrl: serverUrl });
                setProfilePictureUrl(serverUrl);
            } catch (e) {
                console.error('Failed to upload profile picture:', e);
                Alert.alert('Error', 'Failed to upload profile picture. Please try again.');
            }
        }
    };

    const handleLogout = () => {
        Alert.alert(
            "Log Out",
            "Are you sure you want to log out?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Log Out",
                    style: "destructive",
                    onPress: async () => {
                        await logout();
                        router.replace('/');
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
            </View>

            <View style={styles.content}>

                {/* Profile Brief */}
                <View style={[styles.profileBox, { backgroundColor: colors.card }]}>
                    <View style={{ position: 'relative' }}>
                        <View style={[styles.avatar, { backgroundColor: isDark ? colors.primaryLight : '#DBEAFE' }]}>
                            {profilePictureUrl ? (
                                <Image source={{ uri: profilePictureUrl }} style={{ width: 56, height: 56, borderRadius: 28 }} />
                            ) : (
                                <Text style={[styles.avatarText, { color: colors.primary }]}>{patientName.split(' ').map(n => n[0]).join('')}</Text>
                            )}
                        </View>
                        <TouchableOpacity
                            style={{ position: 'absolute', bottom: -2, right: -2, backgroundColor: colors.primary, width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.card }}
                            onPress={pickPhoto}
                        >
                            <Ionicons name="camera" size={12} color="white" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.profileText}>
                        <Text style={[styles.name, { color: colors.text }]}>{patientName}</Text>
                        <Text style={[styles.email, { color: colors.textMuted }]}>{email}</Text>
                    </View>
                </View>

                {/* Settings Links */}
                <View style={[styles.menuGroup, { backgroundColor: colors.card }]}>
                    <TouchableOpacity
                        style={[styles.menuItem, { borderBottomColor: colors.separator }]}
                        onPress={() => router.push('/Patient_subpage/personal_info' as any)}
                    >
                        <View style={[styles.iconBox, { backgroundColor: isDark ? colors.primaryLight : '#EFF6FF' }]}>
                            <Ionicons name="person-outline" size={20} color={colors.primary} />
                        </View>
                        <Text style={[styles.menuText, { color: colors.text }]}>Personal Info</Text>
                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.menuItem, { borderBottomColor: colors.separator }]}
                        onPress={() => router.push('/Patient_subpage/privacy_settings' as any)}
                    >
                        <View style={[styles.iconBox, { backgroundColor: isDark ? '#312E81' : '#F5F3FF' }]}>
                            <Ionicons name="shield-checkmark-outline" size={20} color={isDark ? '#A78BFA' : '#8B5CF6'} />
                        </View>
                        <Text style={[styles.menuText, { color: colors.text }]}>Privacy & Security</Text>
                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    </TouchableOpacity>

                </View>

                <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: isDark ? '#3B1414' : '#FEF2F2' }]} onPress={handleLogout}>
                    <Ionicons name="log-out-outline" size={20} color={colors.danger} />
                    <Text style={[styles.logoutText, { color: colors.danger }]}>Log Out</Text>
                </TouchableOpacity>

            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { padding: 20, paddingTop: 10 },
    headerTitle: { fontSize: 24, fontWeight: '700', color: '#0F172A' },
    content: { flex: 1, paddingHorizontal: 20 },

    profileBox: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#FFF',
        borderRadius: 16,
        marginBottom: 24,
        elevation: 2,
        shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    },
    avatar: {
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: '#DBEAFE',
        justifyContent: 'center', alignItems: 'center',
    },
    avatarText: { fontSize: 18, fontWeight: 'bold', color: '#3B82F6' },
    profileText: { flex: 1, marginLeft: 16 },
    name: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
    email: { fontSize: 13, color: '#64748B', marginTop: 2 },

    menuGroup: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        paddingHorizontal: 16,
        marginBottom: 24,
        elevation: 2,
        shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    iconBox: {
        width: 36, height: 36, borderRadius: 10,
        justifyContent: 'center', alignItems: 'center', marginRight: 12,
    },
    menuText: { flex: 1, fontSize: 15, fontWeight: '500', color: '#1E293B' },

    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        backgroundColor: '#FEF2F2',
        borderRadius: 12,
        gap: 8,
    },
    logoutText: { fontSize: 15, fontWeight: '600', color: '#EF4444' }
});
