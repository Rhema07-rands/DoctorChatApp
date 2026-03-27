import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import {
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../../src/services/api';
import { useTheme } from '../../_context/ThemeContext';
import { useUser } from '../../_context/UserContext';

const DAYS_SHORT: Record<string, string> = {
    Monday: 'Mon',
    Tuesday: 'Tue',
    Wednesday: 'Wed',
    Thursday: 'Thu',
    Friday: 'Fri',
    Saturday: 'Sat',
    Sunday: 'Sun',
};

export default function PatientPrescriptions() {
    const { prescriptions, setPrescriptions } = useUser();
    const router = useRouter();
    const { colors, isDark } = useTheme();

    // Load prescriptions from backend on mount
    useEffect(() => {
        (async () => {
            try {
                const response = await api.get('/prescriptions');
                if (response.data && Array.isArray(response.data)) {
                    const mapped = response.data.map((p: any) => ({
                        id: p.id,
                        drugOrActivity: p.drugOrActivity || p.medicationName || '',
                        alarmTime: p.alarmTime || (p.alarmTimes?.length ? p.alarmTimes[0] : ''),
                        intervalType: p.intervalType || 'everyday',
                        specificDays: p.specificDays || [],
                        doctorName: p.doctorName || '',
                        doctorId: p.prescribingDoctorId || '',
                        condition: p.condition || '',
                        createdAt: p.dateCreated,
                    }));
                    setPrescriptions(mapped);

                    // Cleanup ghost notifications for already deleted prescriptions
                    try {
                        const scheduledTokens = await Notifications.getAllScheduledNotificationsAsync();
                        for (const req of scheduledTokens) {
                            const body = req.content.body || '';
                            if (body.includes('It is time to take your')) {
                                const stillExists = mapped.some((mp: any) => body.includes(mp.drugOrActivity));
                                if (!stillExists) {
                                    await Notifications.cancelScheduledNotificationAsync(req.identifier);
                                }
                            }
                        }
                    } catch (err) {
                        console.error('Failed to cleanup ghost notifications:', err);
                    }
                }
            } catch (err) {
                console.error('Failed to load prescriptions from API:', err);
            }
        })();
    }, []);

    const handleDelete = (id: string, name: string) => {
        Alert.alert(
            "Delete Prescription",
            `Are you sure you want to delete the prescription for ${name}?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await api.delete(`/prescriptions/${id}`);
                        } catch (err) {
                            console.error('Failed to delete prescription from API:', err);
                        }

                        setPrescriptions(prev => prev.filter(p => p.id !== id));

                        try {
                            const scheduledTokens = await Notifications.getAllScheduledNotificationsAsync();
                            for (const req of scheduledTokens) {
                                if (req.content.body && req.content.body.includes(name)) {
                                    await Notifications.cancelScheduledNotificationAsync(req.identifier);
                                }
                            }
                        } catch (err) {
                            console.error('Failed to cancel notifications:', err);
                        }
                    }
                }
            ]
        );
    };

    const renderItem = ({ item }: any) => (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
            {/* Header row */}
            <View style={styles.cardHeader}>
                <View style={styles.pillBadge}>
                    <Ionicons name="medkit" size={16} color="#fff" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.drugName, { color: colors.text }]}>{item.drugOrActivity}</Text>
                    <Text style={[styles.condition, { color: colors.textMuted }]}>{item.condition}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => router.push({ pathname: '/Patient_subpage/create_prescription', params: { id: item.id } } as any)} style={styles.editButton}>
                        <Ionicons name="pencil-outline" size={20} color="#3B82F6" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item.id, item.drugOrActivity)} style={styles.deleteButton}>
                        <Ionicons name="trash-outline" size={20} color="#EF4444" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Details */}
            <View style={styles.detailRow}>
                <Ionicons name="alarm-outline" size={16} color={colors.secondary} />
                <Text style={[styles.detailText, { color: colors.textSecondary }]}>{item.alarmTime}</Text>
            </View>

            <View style={styles.detailRow}>
                <Ionicons name="calendar-outline" size={16} color={colors.secondary} />
                <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                    {item.intervalType === 'everyday'
                        ? 'Everyday'
                        : item.specificDays.map((d: string) => DAYS_SHORT[d] || d).join(', ')}
                </Text>
            </View>

            <View style={styles.detailRow}>
                <Ionicons name="person-outline" size={16} color={colors.secondary} />
                <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                    Dr. {item.doctorName}  •  ID: {item.doctorId}
                </Text>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Title */}
            <Text style={[styles.pageTitle, { color: colors.text }]}>My Prescriptions</Text>

            {prescriptions.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="document-text-outline" size={64} color="#CBD5E1" />
                    <Text style={styles.emptyTitle}>No Prescriptions Yet</Text>
                    <Text style={styles.emptySubtitle}>
                        Tap the + button to create your first prescription reminder.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={prescriptions}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}

            {/* FAB */}
            <TouchableOpacity
                style={styles.fab}
                activeOpacity={0.85}
                onPress={() => router.push('/Patient_subpage/create_prescription' as any)}
            >
                <Ionicons name="add" size={28} color="#fff" />
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    pageTitle: {
        fontSize: 26,
        fontWeight: '800',
        color: '#0F172A',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 8,
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 100,
    },

    /* Card */
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 14,
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    pillBadge: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: '#6366F1',
        justifyContent: 'center',
        alignItems: 'center',
    },
    drugName: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1E293B',
    },
    condition: {
        fontSize: 13,
        color: '#94A3B8',
        marginTop: 2,
    },

    /* Detail rows */
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    detailText: {
        fontSize: 14,
        color: '#475569',
        marginLeft: 8,
    },
    editButton: {
        padding: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    deleteButton: {
        padding: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },

    /* Empty state */
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#334155',
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#94A3B8',
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 20,
    },

    /* FAB */
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 24,
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: '#6366F1',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 6,
    },
});
