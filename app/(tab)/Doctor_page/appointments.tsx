import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Appointment, AppointmentStatus } from '../../_context/AppointmentContext';
import { useAppointments } from '../../_context/AppointmentContext';
import { useTheme } from '../../_context/ThemeContext';

type FilterType = 'All' | 'Upcoming' | 'Past' | 'Cancelled';

export default function AppointmentsScreen() {
    const router = useRouter();
    const {
        appointments,
        updateAppointmentStatus,
        startConsultation,
        getPatientById,
        refreshAppointments
    } = useAppointments();
    const { colors: themeColors, isDark } = useTheme();

    const [filter, setFilter] = useState<FilterType>('Upcoming');
    const [searchQuery, setSearchQuery] = useState('');

    useFocusEffect(
        useCallback(() => {
            refreshAppointments();
        }, [])
    );

    // Filter appointments based on selected filter
    const filteredAppointments = useMemo(() => {
        let filtered = appointments;

        // Apply filter
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        switch (filter) {
            case 'Upcoming':
                filtered = appointments.filter(appt => {
                    const apptDate = new Date(appt.date);
                    return apptDate >= today && (appt.status === 'Confirmed' || appt.status === 'Pending');
                });
                break;
            case 'Past':
                filtered = appointments.filter(appt => {
                    const apptDate = new Date(appt.date);
                    return apptDate < today || appt.status === 'Completed';
                });
                break;
            case 'Cancelled':
                filtered = appointments.filter(appt => appt.status === 'Cancelled');
                break;
            default:
                filtered = appointments;
        }

        // Apply search
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(appt =>
                appt.patientName.toLowerCase().includes(query) ||
                appt.reason.toLowerCase().includes(query)
            );
        }

        // Sort by date
        return filtered.sort((a, b) => {
            const dateA = new Date(a.date + ' ' + a.time);
            const dateB = new Date(b.date + ' ' + b.time);
            return filter === 'Past' ? dateB.getTime() - dateA.getTime() : dateA.getTime() - dateB.getTime();
        });
    }, [appointments, filter, searchQuery]);

    const getStatusColor = (status: AppointmentStatus) => {
        switch (status) {
            case 'Confirmed': return '#16A34A';
            case 'Pending': return '#F59E0B';
            case 'Completed': return '#3B82F6';
            case 'Cancelled': return '#EF4444';
            default: return '#64748B';
        }
    };

    const getStatusBgColor = (status: AppointmentStatus) => {
        switch (status) {
            case 'Confirmed': return '#DCFCE7';
            case 'Pending': return '#FEF3C7';
            case 'Completed': return '#DBEAFE';
            case 'Cancelled': return '#FEE2E2';
            default: return '#F1F5F9';
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'Video': return '📹';
            case 'Audio': return '🎙️';
            case 'Chat': return '💬';
            default: return '📋';
        }
    };

    const handleConfirm = (id: string) => {
        updateAppointmentStatus(id, 'Confirmed');
    };

    const handleCancel = (id: string) => {
        updateAppointmentStatus(id, 'Cancelled');
    };

    const handleStartConsultation = (appointment: Appointment) => {
        startConsultation(appointment.id);
        const patient = getPatientById(appointment.patientId);
        // Always navigate to chat with the patient — this is the primary interaction
        router.push({
            pathname: '/Doctor_page/doctor_chats',
            params: {
                id: appointment.patientId,
                name: appointment.patientName,
                initials: patient?.initials || 'PT'
            }
        });
    };

    const renderAppointmentCard = (appointment: Appointment) => {
        const patient = getPatientById(appointment.patientId);
        const isToday = appointment.date === new Date().toISOString().split('T')[0];
        const canStart = appointment.status === 'Confirmed' && isToday;
        const KeyedView = View as any;

        return (
            <KeyedView key={appointment.id} style={[styles.card, { backgroundColor: themeColors.card, borderWidth: isDark ? 1 : 0, borderColor: themeColors.cardBorder }]}>
                {/* Header */}
                <View style={styles.cardHeader}>
                    <View style={styles.dateTimeContainer}>
                        <Text style={[styles.dateText, { color: themeColors.text }]}>{formatDate(appointment.date)}</Text>
                        <Text style={styles.timeText}>{appointment.time}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusBgColor(appointment.status) }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(appointment.status) }]}>
                            {appointment.status}
                        </Text>
                    </View>
                </View>

                {/* Patient Info */}
                <View style={styles.patientRow}>
                    <View style={[styles.avatar, { backgroundColor: patient?.avatarColor || '#3B82F6' }]}>
                        <Text style={styles.avatarText}>{patient?.initials || 'PT'}</Text>
                    </View>
                    <View style={styles.patientInfo}>
                        <Text style={[styles.patientName, { color: themeColors.text }]}>{appointment.patientName}</Text>
                        <View style={styles.typeRow}>
                            <Text style={styles.typeIcon}>{getTypeIcon(appointment.type)}</Text>
                            <Text style={[styles.typeText, { color: themeColors.textSecondary }]}>{appointment.type} Call</Text>
                            <Text style={styles.separator}>•</Text>
                            <Text style={[styles.durationText, { color: themeColors.textSecondary }]}>{appointment.duration || 30} min</Text>
                        </View>
                    </View>
                </View>

                {/* Reason for Visit */}
                {appointment.reason ? (
                    <View style={[styles.reasonBox, isDark && { backgroundColor: 'rgba(254, 215, 170, 0.1)', borderColor: 'rgba(254, 215, 170, 0.3)' }]}>
                        <Text style={[styles.reasonLabel, isDark && { color: '#FDBA74' }]}>📋 Reason for Visit</Text>
                        <Text style={[styles.reasonText, isDark && { color: '#FFEDD5' }]}>{appointment.reason}</Text>
                    </View>
                ) : null}

                {/* Actions */}
                {appointment.status === 'Pending' && (
                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            style={styles.confirmBtn}
                            onPress={() => handleConfirm(appointment.id)}
                        >
                            <Text style={styles.btnTextWhite}>✓ Confirm</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.cancelBtn}
                            onPress={() => handleCancel(appointment.id)}
                        >
                            <Text style={styles.btnTextRed}>✕ Decline</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {canStart && (
                    <TouchableOpacity
                        style={styles.startBtn}
                        onPress={() => handleStartConsultation(appointment)}
                    >
                        <Text style={styles.btnTextWhite}>
                            {appointment.type === 'Video' ? '📹' : appointment.type === 'Audio' ? '🎙️' : '💬'} Start Consultation
                        </Text>
                    </TouchableOpacity>
                )}

                {appointment.status === 'Confirmed' && !isToday && (
                    <View style={[styles.infoRow, isDark && { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                        <Text style={[styles.infoText, isDark && { color: '#60A5FA' }]}>✓ Confirmed - Scheduled for {formatDate(appointment.date)}</Text>
                    </View>
                )}
            </KeyedView>
        );
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (dateStr === today.toISOString().split('T')[0]) {
            return 'Today';
        } else if (dateStr === tomorrow.toISOString().split('T')[0]) {
            return 'Tomorrow';
        } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: themeColors.text }]}>Appointments</Text>
                <Text style={[styles.headerSubtitle, { color: themeColors.textSecondary }]}>Manage your schedule</Text>
            </View>

            {/* Search Bar */}
            <View style={[styles.searchContainer, { backgroundColor: themeColors.surface, borderColor: themeColors.cardBorder, borderWidth: isDark ? 1 : 0 }]}>
                <Ionicons name="search-outline" size={20} color={themeColors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                    style={[styles.searchInput, { color: themeColors.inputText }]}
                    placeholder="Search by patient name or reason..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholderTextColor={themeColors.placeholder}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Text style={[styles.clearIcon, { color: themeColors.textMuted }]}>✕</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Filter Tabs */}
            <View style={styles.filterContainer}>
                {(['All', 'Upcoming', 'Past', 'Cancelled'] as FilterType[]).map((f) => {
                    const KeyedTouchableOpacity = TouchableOpacity as any;
                    return (
                        <KeyedTouchableOpacity
                            key={f}
                            style={[
                                styles.filterBtn,
                                { backgroundColor: themeColors.surface, borderColor: themeColors.cardBorder },
                                filter === f && styles.filterBtnActive
                            ]}
                            onPress={() => setFilter(f)}
                        >
                            <Text style={[styles.filterText, { color: themeColors.textSecondary }, filter === f && styles.filterTextActive]}>
                                {f}
                            </Text>
                        </KeyedTouchableOpacity>
                    );
                })}
            </View>

            {/* Appointments List */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {filteredAppointments.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="calendar-outline" size={64} color={themeColors.textSecondary} style={{ marginBottom: 16, opacity: 0.5 }} />
                        <Text style={[styles.emptyTitle, { color: themeColors.text }]}>No appointments found</Text>
                        <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                            {searchQuery ? 'Try adjusting your search' : `No ${filter.toLowerCase()} appointments`}
                        </Text>
                    </View>
                ) : (
                    filteredAppointments.map(renderAppointmentCard)
                )}

                <View style={{ height: 20 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F1F5F9'
    },
    header: {
        padding: 20,
        paddingTop: 40,
        paddingBottom: 16
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 4
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#64748B'
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        marginHorizontal: 20,
        marginBottom: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        elevation: 1
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: '#1E293B'
    },
    clearIcon: {
        fontSize: 18,
        color: '#94A3B8',
        paddingLeft: 8
    },
    filterContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginBottom: 16,
        gap: 8
    },
    filterBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    filterBtnActive: {
        backgroundColor: '#3B82F6',
        borderColor: '#3B82F6'
    },
    filterText: {
        fontSize: 13,
        color: '#64748B',
        fontWeight: '500'
    },
    filterTextActive: {
        color: 'white',
        fontWeight: '600'
    },
    scrollView: {
        flex: 1
    },
    scrollContent: {
        paddingHorizontal: 20
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        elevation: 1
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12
    },
    dateTimeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    dateText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1E293B'
    },
    timeText: {
        fontSize: 14,
        color: '#3B82F6',
        fontWeight: '500'
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12
    },
    statusText: {
        fontSize: 11,
        fontWeight: 'bold'
    },
    patientRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12
    },
    avatarText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold'
    },
    patientInfo: {
        flex: 1
    },
    patientName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 4
    },
    typeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4
    },
    typeIcon: {
        fontSize: 12
    },
    typeText: {
        fontSize: 13,
        color: '#64748B'
    },
    separator: {
        color: '#CBD5E1',
        marginHorizontal: 4
    },
    durationText: {
        fontSize: 13,
        color: '#64748B'
    },
    reasonBox: {
        backgroundColor: '#FFF7ED',
        borderRadius: 8,
        padding: 10,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#FED7AA',
    },
    reasonLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#9A3412',
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    reasonText: {
        fontSize: 14,
        color: '#C2410C',
        lineHeight: 20
    },
    actionRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 4
    },
    confirmBtn: {
        flex: 1,
        backgroundColor: '#22C55E',
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center'
    },
    cancelBtn: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#EF4444',
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center'
    },
    startBtn: {
        backgroundColor: '#3B82F6',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 4
    },
    btnTextWhite: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14
    },
    btnTextRed: {
        color: '#EF4444',
        fontWeight: '600',
        fontSize: 14
    },
    infoRow: {
        backgroundColor: '#F0F9FF',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginTop: 4
    },
    infoText: {
        fontSize: 13,
        color: '#0284C7',
        textAlign: 'center'
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 8
    },
    emptyText: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center'
    }
});
