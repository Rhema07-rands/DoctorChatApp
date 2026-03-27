import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
    Alert,
    Image,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../../src/services/api';
import { uploadFile } from '../../../src/services/uploadService';
import { useTheme } from '../../_context/ThemeContext';
import { useUser } from '../../_context/UserContext';

export default function ProfileScreen() {
    const router = useRouter();

    const {
        status, setStatus,
        consultationType, setConsultationType,
        startTime, setStartTime,
        endTime, setEndTime,
        firstName, lastName, bio, profilePictureUrl, setProfilePictureUrl,
        logout
    } = useUser();
    const { colors, isDark, toggle } = useTheme();

    // Auto-save availability settings
    const initiallyLoaded = useRef(false);
    useEffect(() => {
        if (!initiallyLoaded.current) {
            initiallyLoaded.current = true;
            return;
        }

        const saveAvailability = async () => {
            try {
                await api.patch('/doctor/availability', {
                    StartTime: startTime,
                    EndTime: endTime,
                    ConsultationType: consultationType
                });
            } catch (error) {
                console.error('Failed to auto-save availability:', error);
            }
        };

        const timeoutId = setTimeout(saveAvailability, 1500); // 1.5s debounce
        return () => clearTimeout(timeoutId);
    }, [startTime, endTime, consultationType]);

    const pickPhoto = async () => {
        const result = await DocumentPicker.getDocumentAsync({ type: 'image/*' });
        if (!result.canceled && result.assets?.[0]) {
            try {
                // 1. Upload image file to server
                const serverUrl = await uploadFile(result.assets[0].uri, result.assets[0].mimeType || 'image/jpeg');
                // 2. Save the server URL to the database
                await api.put('profile/picture', { ProfilePictureUrl: serverUrl });
                // 3. Update local state with permanent server URL
                setProfilePictureUrl(serverUrl);
            } catch (e) {
                console.error('Failed to upload profile picture:', e);
                Alert.alert('Error', 'Failed to upload profile picture. Please try again.');
            }
        }
    };

    const handleStatusChange = async (newStatus: 'Available' | 'Busy') => {
        setStatus(newStatus);
        try {
            await api.patch('/doctor/availability', { Availability: newStatus });
        } catch (error) {
            console.error('Failed to update status on server:', error);
        }
    };

    const getStatusColor = (s: string) => {
        switch (s) {
            case 'Available': return '#16A34A'; // Green
            case 'Busy': return '#EAB308'; // Yellow/Orange
            default: return '#64748B';
        }
    };

    const parseTimeStr = (timeStr: string) => {
        const [time, period] = timeStr.split(' ');
        return { time: time || '', period: period || 'AM' };
    };

    const updateTimeValue = (setter: (v: string) => void, oldStr: string, newTime?: string, newPeriod?: string) => {
        const { time, period } = parseTimeStr(oldStr);
        setter(`${newTime !== undefined ? newTime : time} ${newPeriod !== undefined ? newPeriod : period}`);
    };

    const PeriodPicker = ({ period, onSelect }: { period: string, onSelect: (p: string) => void }) => {
        const periods = ['AM', 'PM'];
        const KeyedTouchableOpacity = TouchableOpacity as any;
        return (
            <View style={[styles.periodContainer, { backgroundColor: isDark ? colors.surfaceAlt : '#E2E8F0' }]}>
                {periods.map((p) => (
                    <KeyedTouchableOpacity
                        key={p}
                        style={[styles.periodBtn as any, period === p && styles.periodBtnActive, period === p && { backgroundColor: colors.surface }]}
                        onPress={() => onSelect(p)}
                    >
                        <Text style={[styles.periodText, { color: period === p ? colors.text : colors.textMuted }]}>{p}</Text>
                    </KeyedTouchableOpacity>
                ))}
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['right', 'left']}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                stickyHeaderIndices={[0]}
            >

                {/* White Profile Header */}
                <View style={[styles.whiteHeader, { backgroundColor: colors.surface, borderBottomColor: colors.separator }]}>
                    <View style={styles.headerTop}>
                        <Text style={[styles.headerTitleDark, { color: colors.text }]}>Settings</Text>
                    </View>

                    <View style={styles.profileSection}>
                        <View style={styles.avatarContainer}>
                            <View style={styles.avatar}>
                                {profilePictureUrl ? (
                                    <Image source={{ uri: profilePictureUrl }} style={{ width: 64, height: 64, borderRadius: 32 }} />
                                ) : (
                                    <Text style={styles.avatarText}>{firstName[0] || ''}{lastName[0] || ''}</Text>
                                )}
                            </View>
                            <TouchableOpacity
                                style={{ position: 'absolute', bottom: -2, right: -2, backgroundColor: colors.primary, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.surface }}
                                onPress={pickPhoto}
                            >
                                <Ionicons name="camera" size={13} color="white" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.profileInfo}>
                            <Text style={[styles.profileNameDark, { color: colors.text }]}>{firstName} {lastName}</Text>
                        </View>
                    </View>
                </View>

                {/* Sectioned List*/}
                <View style={[styles.sectionContainer, { backgroundColor: colors.background }]}>

                    {/* Navigation Button: Professional Info */}
                    <TouchableOpacity
                        style={[styles.navCardButton, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                        onPress={() => router.push('/Doctor_subpage/professional_info')}
                    >
                        <View style={styles.menuItemLeft}>
                            <View style={[styles.iconBox, { backgroundColor: isDark ? colors.primaryLight : '#F0F9FF' }]}>
                                <Ionicons name="person" size={24} color={isDark ? colors.primary : '#0EA5E9'} />
                            </View>
                            <View style={styles.menuTextContent}>
                                <Text style={[styles.menuLabel, { color: colors.text }]}>Professional Information</Text>
                                <Text style={[styles.menuDescription, { color: colors.textMuted }]}>Update your personal and medical info</Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    </TouchableOpacity>

                    {/* Navigation Button: Fees & Practice */}
                    <TouchableOpacity
                        style={[styles.navCardButton, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                        onPress={() => router.push('/Doctor_subpage/fees_practice')}
                    >
                        <View style={styles.menuItemLeft}>
                            <View style={[styles.iconBox, { backgroundColor: isDark ? colors.primaryLight : '#F0F9FF' }]}>
                                <Ionicons name="card" size={24} color={isDark ? colors.primary : '#0EA5E9'} />
                            </View>
                            <View style={styles.menuTextContent}>
                                <Text style={[styles.menuLabel, { color: colors.text }]}>Fees & Practice</Text>
                                <Text style={[styles.menuDescription, { color: colors.textMuted }]}>Manage consultation pricing & clinics</Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    </TouchableOpacity>

                    {/* Navigation Button: Privacy Settings */}
                    <TouchableOpacity
                        style={[styles.navCardButton, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                        onPress={() => router.push('/Doctor_subpage/privacy_settings')}
                    >
                        <View style={styles.menuItemLeft}>
                            <View style={[styles.iconBox, { backgroundColor: isDark ? colors.primaryLight : '#F0F9FF' }]}>
                                <Ionicons name="shield-checkmark" size={24} color={isDark ? colors.primary : '#0EA5E9'} />
                            </View>
                            <View style={styles.menuTextContent}>
                                <Text style={[styles.menuLabel, { color: colors.text }]}>Privacy Settings</Text>
                                <Text style={[styles.menuDescription, { color: colors.textMuted }]}>Change email, phone and password</Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    </TouchableOpacity>


                    <View style={[styles.formCard, { backgroundColor: colors.card }]}>
                        {/* Nesting Availability Title inside the card */}
                        <View style={[styles.menuItemLeft, { marginBottom: 15 }]}>
                            <Ionicons name="time-outline" size={24} color={colors.textMuted} />
                            <View style={styles.menuTextContent}>
                                <Text style={[styles.menuLabel, { color: colors.text }]}>Availability Settings</Text>
                                <Text style={[styles.menuDescription, { color: colors.textMuted }]}>Working hours, Types, Status</Text>
                            </View>
                        </View>

                        <View style={[styles.divider, { marginBottom: 15, backgroundColor: colors.cardBorder }]} />

                        {/* Working Hours */}
                        <View style={styles.availabilityRow}>
                            <Text style={[styles.settingLabel, { color: colors.text }]}>Working{'\n'}Hours</Text>
                            <View style={styles.timeStack}>
                                <View style={styles.timeRowItem}>
                                    <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>From</Text>
                                    <View style={[styles.timeGroup, { backgroundColor: colors.background, borderColor: colors.cardBorder }]}>
                                        <View style={styles.timeBoxSmall}>
                                            <TextInput
                                                style={[styles.timeInputProfile, { color: colors.text }]}
                                                value={parseTimeStr(startTime).time}
                                                onChangeText={(text) => updateTimeValue(setStartTime, startTime, text)}
                                                placeholder="00:00"
                                                placeholderTextColor={colors.textMuted}
                                                keyboardType="numbers-and-punctuation"
                                                maxLength={5}
                                            />
                                        </View>
                                        <PeriodPicker
                                            period={parseTimeStr(startTime).period}
                                            onSelect={(p) => updateTimeValue(setStartTime, startTime, undefined, p)}
                                        />
                                    </View>
                                </View>

                                <View style={styles.timeRowItem}>
                                    <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>To</Text>
                                    <View style={[styles.timeGroup, { backgroundColor: colors.background, borderColor: colors.cardBorder }]}>
                                        <View style={styles.timeBoxSmall}>
                                            <TextInput
                                                style={[styles.timeInputProfile, { color: colors.text }]}
                                                value={parseTimeStr(endTime).time}
                                                onChangeText={(text) => updateTimeValue(setEndTime, endTime, text)}
                                                placeholder="00:00"
                                                placeholderTextColor={colors.textMuted}
                                                keyboardType="numbers-and-punctuation"
                                                maxLength={5}
                                            />
                                        </View>
                                        <PeriodPicker
                                            period={parseTimeStr(endTime).period}
                                            onSelect={(p) => updateTimeValue(setEndTime, endTime, undefined, p)}
                                        />
                                    </View>
                                </View>
                            </View>
                        </View>

                        <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />

                        {/* Consultation Types */}
                        <View style={styles.availabilityRow}>
                            <Text style={[styles.settingLabel, { color: colors.text }]}>Consults{'\n'}Types</Text>
                            <View style={styles.rowNowrap}>
                                {[
                                    { type: 'Video', icon: '📹' },
                                    { type: 'Audio', icon: '📞' },
                                    { type: 'Chat', icon: '💬' }
                                ].map((item) => {
                                    const KeyedTouchableOpacity = TouchableOpacity as any;
                                    return (
                                        <KeyedTouchableOpacity
                                            key={item.type}
                                            style={[
                                                styles.typeBadge,
                                                { backgroundColor: colors.background, borderColor: colors.cardBorder },
                                                consultationType === item.type && [styles.typeBadgeActive, isDark && { backgroundColor: 'rgba(59,130,246,0.2)' }]
                                            ]}
                                            onPress={() => setConsultationType(item.type)}
                                        >
                                            <Text style={styles.typeIcon}>{item.icon}</Text>
                                            <Text style={[styles.typeText, { color: consultationType === item.type ? colors.primary : colors.textSecondary }, consultationType === item.type && styles.typeTextActive]}>{item.type}</Text>
                                        </KeyedTouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />

                        {/* Quick Status */}
                        <View style={styles.availabilityRow}>
                            <Text style={[styles.settingLabel, { color: colors.text }]}>Quick Status</Text>
                            <View style={[styles.statusToggleContainer, { backgroundColor: isDark ? colors.surfaceAlt : '#F1F5F9' }]}>
                                {['Available', 'Busy'].map((s) => {
                                    const KeyedTouchableOpacity = TouchableOpacity as any;
                                    return (
                                        <KeyedTouchableOpacity
                                            key={s}
                                            style={[styles.statusBtn, status === s && [styles.statusBtnActive, { backgroundColor: colors.surface }]]}
                                            onPress={() => handleStatusChange(s as any)}
                                        >
                                            <Text style={[styles.statusDot, { color: getStatusColor(s) }]}>●</Text>
                                            <Text style={[styles.statusBtnText, { color: status === s ? colors.text : colors.textMuted }, status === s && styles.statusBtnTextActive]}>{s}</Text>
                                        </KeyedTouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    </View>

                    {/* Logout Section */}
                    <TouchableOpacity
                        style={[styles.logoutButton, { backgroundColor: isDark ? '#3B1414' : '#FFF1F2' }]}
                        onPress={() => {
                            Alert.alert(
                                "Logout",
                                "Are you sure you want to log out?",
                                [
                                    { text: "Cancel", style: "cancel" },
                                    {
                                        text: "Logout",
                                        style: "destructive",
                                        onPress: async () => {
                                            await logout();
                                            router.replace('/');
                                        }
                                    }
                                ]
                            );
                        }}
                    >
                        <Text style={[styles.logoutText, { color: colors.danger }]}>Logout</Text>
                    </TouchableOpacity>

                </View>
                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    scrollContent: { paddingBottom: 20 },

    // White Header Styles
    whiteHeader: {
        backgroundColor: 'white',
        paddingTop: 35, // Increased slightly to bring title down
        paddingBottom: 25,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 25,
    },
    headerTitleDark: {
        fontSize: 20,
        color: '#1E293B',
        fontWeight: 'bold',
    },
    profileSection: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarContainer: {
        position: 'relative',
    },
    avatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#3B82F6', // Brighter blue for light theme
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: 24,
        color: 'white',
        fontWeight: 'bold',
    },
    profileInfo: {
        flex: 1,
        marginLeft: 16,
    },
    profileNameDark: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 4,
    },
    profileSubtitle: {
        fontSize: 14,
        color: '#94A3B8',
    },
    addIcon: {
        marginLeft: 8,
    },

    // List Styles (Jumia inspired)
    sectionContainer: {
        marginTop: 20, // Added space between header and buttons
        backgroundColor: '#F8FAFC',
        borderTopLeftRadius: 15,
        borderTopRightRadius: 15,
        paddingHorizontal: 16,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        marginTop: 8,
    },
    menuItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    menuTextContent: {
        marginLeft: 16,
    },
    menuLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B',
    },
    menuDescription: {
        fontSize: 13,
        color: '#64748B',
        marginTop: 2,
    },

    // Navigation Buttons
    navCardButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 1,
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },

    formCard: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 20,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
        marginBottom: 10,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748B',
        marginBottom: 8,
        marginTop: 12,
    },
    inputBackground: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 10,
        padding: 12,
        fontSize: 15,
        color: '#1E293B',
    },
    rowGap: {
        flexDirection: 'row',
        gap: 12,
    },
    flex1: {
        flex: 1,
    },
    moneyInput: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 10,
        paddingHorizontal: 12,
    },
    currency: {
        fontSize: 16,
        color: '#64748B',
        marginRight: 4,
    },
    flexInput: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 15,
        color: '#1E293B',
        fontWeight: '600',
    },

    // Availability Settings Styles (PRESERVED)
    availabilityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
    settingLabel: { fontSize: 14, color: '#1E293B', fontWeight: '500', flex: 1.2 },
    rowNowrap: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end' },
    timeStack: { flexDirection: 'column', flex: 2, gap: 8 },
    timeRowItem: { flexDirection: 'row', alignItems: 'center', gap: 6, width: '100%' },
    timeLabel: { fontSize: 12, fontWeight: '500', color: '#64748B', width: 35 },
    subText: { color: '#64748B', marginHorizontal: 4 },
    divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 4 },
    statusBtnTextActive: { color: '#1E293B' },

    // Time Period Picker Styles
    timeGroup: { flexDirection: 'row', alignItems: 'center', flex: 1, backgroundColor: '#F1F5F9', borderRadius: 8, padding: 2, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'space-between' },
    timeBoxSmall: { width: 50, paddingHorizontal: 4, justifyContent: 'center' },
    timeInputProfile: { fontSize: 13, color: '#1E293B', textAlign: 'center', padding: 0 },
    periodContainer: { flexDirection: 'row', backgroundColor: '#E2E8F0', borderRadius: 6, padding: 1 },
    periodBtn: { paddingHorizontal: 6, paddingVertical: 4, borderRadius: 5 },
    periodBtnActive: { backgroundColor: 'white' },
    periodText: { fontSize: 10, color: '#64748B', fontWeight: 'bold' },
    periodTextActive: { color: '#1E293B' },

    typeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', marginLeft: 6 },
    typeBadgeActive: { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' },
    typeIcon: { fontSize: 14, marginRight: 4 },
    typeText: { fontSize: 12, color: '#475569' },
    typeTextActive: { color: '#3B82F6', fontWeight: 'bold' },
    statusToggleContainer: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 8, padding: 4 },
    statusBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
    statusBtnActive: { backgroundColor: 'white', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
    statusDot: { fontSize: 10, marginRight: 6 },
    statusBtnText: { fontSize: 12, color: '#64748B', fontWeight: '500' },

    logoutButton: {
        marginTop: 30,
        paddingVertical: 16,
        alignItems: 'center',
        backgroundColor: '#FFF1F2',
        borderRadius: 12,
    },
    logoutText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#E11D48',
    },
});
