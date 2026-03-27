import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppointments } from '../_context/AppointmentContext';
import { useDoctorDirectory } from '../_context/DoctorDirectoryContext';

const TABS = ['Upcoming', 'Past', 'Cancelled'] as const;
type TabType = typeof TABS[number];

export default function MyBookings() {
    const router = useRouter();
    const { appointments, updateAppointmentStatus } = useAppointments();
    const { getDoctorById, addActivePatientChat } = useDoctorDirectory();

    const [activeTab, setActiveTab] = useState<TabType>('Upcoming');
    const [notesModalVisible, setNotesModalVisible] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState<typeof appointments[0] | null>(null);

    // Filter appointments based on the active tab
    const filteredAppointments = useMemo(() => {
        return appointments.filter((appt) => {
            if (activeTab === 'Upcoming') {
                return appt.status === 'Pending';
            }
            if (activeTab === 'Past') return appt.status === 'Completed' || appt.status === 'Confirmed';
            if (activeTab === 'Cancelled') return appt.status === 'Cancelled';
            return false;
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [appointments, activeTab]);

    const handleMessage = (apptId: string, doctorId: string, doctorName: string, status: string) => {
        if (status !== 'Confirmed') {
            Alert.alert(
                "Cannot Send Message yet",
                "You can only message a doctor after they have accepted your appointment booking."
            );
            return;
        }

        // Add to active chats so it appears in the Patient Chats list
        addActivePatientChat(doctorId);

        const doctor = getDoctorById(doctorId);
        router.push({
            pathname: '/Patient_subpage/chat_conversation',
            params: {
                doctorId: doctorId,
                name: doctorName,
                initials: doctor ? doctor.initials : 'DR'
            }
        } as any);
    };

    const renderItem = ({ item }: { item: typeof appointments[0] }) => {
        const isConfirmed = item.status === 'Confirmed';
        const isPending = item.status === 'Pending';
        const isCancelled = item.status === 'Cancelled';

        const doc = item.doctorId ? getDoctorById(item.doctorId) : undefined;
        const displayName = doc?.name || item.doctorName || item.patientName;

        let statusColor = '#64748B'; // default / gray
        let statusBg = '#F1F5F9';

        if (isConfirmed) {
            statusColor = '#16A34A'; // green
            statusBg = '#DCFCE7';
        } else if (isPending) {
            statusColor = '#D97706'; // orange/amber
            statusBg = '#FEF3C7';
        } else if (isCancelled) {
            statusColor = '#DC2626'; // red
            statusBg = '#FEE2E2';
        } else if (item.status === 'Completed') {
            statusColor = '#3B82F6'; // blue
            statusBg = '#DBEAFE';
        }

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={styles.docInfo}>
                        <Text style={styles.docName}>{displayName}</Text>
                        <View style={styles.typeBadge}>
                            <Ionicons
                                name={item.type === 'Video' ? 'videocam' : item.type === 'Audio' ? 'call' : 'chatbubble-ellipses'}
                                size={12}
                                color="#64748B"
                            />
                            <Text style={styles.typeText}>{item.type} Visit</Text>
                        </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>
                            {item.status === 'Completed' ? 'Accepted' : item.status}
                        </Text>
                    </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.detailsRow}>
                    <View style={styles.detailItem}>
                        <Ionicons name="calendar-outline" size={16} color="#64748B" />
                        <Text style={styles.detailText}>{item.date}</Text>
                    </View>
                    <View style={styles.detailItem}>
                        <Ionicons name="time-outline" size={16} color="#64748B" />
                        <Text style={styles.detailText}>{item.time}</Text>
                    </View>
                </View>

                {/* Reason */}
                {item.reason && (
                    <Text style={styles.reasonText} numberOfLines={2}>
                        <Text style={{ fontWeight: '600', color: '#475569' }}>Reason: </Text>
                        {item.reason}
                    </Text>
                )}

                {/* Action buttons for Upcoming tab */}
                {activeTab === 'Upcoming' && isPending && (
                    <View style={styles.actionRow}>
                        {/* Cancel Button */}
                        <TouchableOpacity style={[styles.actionBtnOutline, { borderColor: '#FECACA' }]} activeOpacity={0.7} onPress={() => {
                            Alert.alert(
                                "Cancel Appointment",
                                "Are you sure you want to cancel this appointment?",
                                [
                                    { text: "No", style: "cancel" },
                                    { text: "Yes, Cancel", style: "destructive", onPress: () => updateAppointmentStatus(item.id, 'Cancelled') }
                                ]
                            );
                        }}>
                            <Text style={[styles.actionBtnOutlineText, { color: '#DC2626' }]}>Cancel</Text>
                        </TouchableOpacity>

                        {/* Reschedule Button */}
                        <TouchableOpacity
                            style={styles.actionBtnOutline}
                            activeOpacity={0.7}
                            onPress={() => router.push({
                                pathname: '/Patient_subpage/reschedule_appointment',
                                params: { appointmentId: item.id, doctorId: item.doctorId }
                            } as any)}
                        >
                            <Text style={styles.actionBtnOutlineText}>Reschedule</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Message button — only shown when confirmed */}
                {activeTab === 'Upcoming' && isConfirmed && (
                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            style={[styles.actionBtnSolid, { backgroundColor: '#3B82F6', flex: 1 }]}
                            activeOpacity={0.8}
                            onPress={() => handleMessage(item.id, item.doctorId || '', displayName, item.status)}
                        >
                            <Ionicons name="chatbubble-ellipses" size={14} color="#FFF" style={{ marginRight: 4 }} />
                            <Text style={styles.actionBtnSolidText}>Message Doctor</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* View Notes button — shown on past (completed) appointments */}
                {activeTab === 'Past' && (
                    <View style={styles.actionRow}>
                        {item.notes ? (
                            <TouchableOpacity
                                style={[styles.actionBtnSolid, { backgroundColor: '#6366F1', flex: 1 }]}
                                activeOpacity={0.8}
                                onPress={() => { setSelectedAppointment(item); setNotesModalVisible(true); }}
                            >
                                <Ionicons name="document-text" size={14} color="#FFF" style={{ marginRight: 4 }} />
                                <Text style={styles.actionBtnSolidText}>View Notes</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={[styles.actionBtnSolid, { backgroundColor: '#3B82F6', flex: 1 }]}
                                activeOpacity={0.8}
                                onPress={() => handleMessage(item.id, item.doctorId || '', displayName, 'Confirmed')}
                            >
                                <Ionicons name="chatbubble-ellipses" size={14} color="#FFF" style={{ marginRight: 4 }} />
                                <Text style={styles.actionBtnSolidText}>Message Doctor</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
                    <Ionicons name="chevron-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Bookings</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Tabs */}
            <View style={styles.tabsContainer}>
                {TABS.map((tab) => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
                        activeOpacity={0.8}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                            {tab}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* List */}
            {filteredAppointments.length === 0 ? (
                <View style={styles.emptyState}>
                    <View style={styles.emptyIconBox}>
                        <Ionicons name="calendar-clear-outline" size={48} color="#94A3B8" />
                    </View>
                    <Text style={styles.emptyTitle}>No {activeTab.toLowerCase()} appointments</Text>
                    <Text style={styles.emptySubtitle}>
                        You don't have any {activeTab.toLowerCase()} bookings at the moment.
                    </Text>

                    {activeTab === 'Upcoming' && (
                        <TouchableOpacity
                            style={styles.bookNewBtn}
                            activeOpacity={0.8}
                            onPress={() => router.push('/Patient_page/appointments')}
                        >
                            <Text style={styles.bookNewText}>Find a Doctor</Text>
                        </TouchableOpacity>
                    )}
                </View>
            ) : (
                <FlatList
                    data={filteredAppointments}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}

            {/* Notes Modal */}
            <Modal visible={notesModalVisible} transparent animationType="slide" onRequestClose={() => setNotesModalVisible(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setNotesModalVisible(false)}>
                    <View style={styles.modalContainer} onStartShouldSetResponder={() => true}>
                        <View style={styles.modalHandle} />
                        <Text style={styles.modalTitle}>Consultation Notes</Text>
                        {selectedAppointment && (
                            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
                                <Text style={styles.modalDocName}>{selectedAppointment.doctorName}</Text>
                                <Text style={styles.modalDate}>{selectedAppointment.date} • {selectedAppointment.time}</Text>

                                {selectedAppointment.notes && (
                                    <View style={styles.noteSection}>
                                        <Text style={styles.noteSectionTitle}>📝 Clinical Notes</Text>
                                        <Text style={styles.noteSectionBody}>{selectedAppointment.notes}</Text>
                                    </View>
                                )}
                                {selectedAppointment.diagnosis && (
                                    <View style={styles.noteSection}>
                                        <Text style={styles.noteSectionTitle}>🩺 Diagnosis</Text>
                                        <Text style={styles.noteSectionBody}>{selectedAppointment.diagnosis}</Text>
                                    </View>
                                )}
                                {selectedAppointment.prescription && (
                                    <View style={styles.noteSection}>
                                        <Text style={styles.noteSectionTitle}>💊 Prescription</Text>
                                        <Text style={styles.noteSectionBody}>{selectedAppointment.prescription}</Text>
                                    </View>
                                )}
                                {!selectedAppointment.notes && !selectedAppointment.diagnosis && !selectedAppointment.prescription && (
                                    <Text style={styles.noNotesText}>No consultation notes available yet.</Text>
                                )}
                            </ScrollView>
                        )}
                        <TouchableOpacity style={styles.closeModalBtn} onPress={() => setNotesModalVisible(false)}>
                            <Text style={styles.closeModalBtnText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 16,
        backgroundColor: '#FFF',
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
    },

    // Tabs
    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    tabBtn: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabBtnActive: {
        borderBottomColor: '#3B82F6',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
    },
    tabTextActive: {
        color: '#3B82F6',
    },

    // List
    listContent: {
        padding: 16,
        paddingBottom: 40,
    },

    // Card
    card: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    docInfo: {
        flex: 1,
        paddingRight: 10,
    },
    docName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 4,
    },
    typeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    typeText: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '500',
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '700',
    },
    divider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginVertical: 12,
    },
    detailsRow: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 10,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    detailText: {
        fontSize: 13,
        color: '#475569',
        fontWeight: '500',
    },
    reasonText: {
        fontSize: 13,
        color: '#64748B',
        fontStyle: 'italic',
        lineHeight: 18,
    },

    // Action Row
    actionRow: {
        flexDirection: 'row',
        marginTop: 16,
        gap: 8,
    },
    actionBtnOutline: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionBtnOutlineText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
    },
    actionBtnSolid: {
        flex: 1.2, // Slightly larger
        flexDirection: 'row',
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionBtnSolidText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFF',
    },

    // Empty state
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
        marginTop: 60,
    },
    emptyIconBox: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 20,
    },
    bookNewBtn: {
        marginTop: 24,
        backgroundColor: '#3B82F6',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 20,
    },
    bookNewText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '700',
    },

    // Notes Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
    },
    modalHandle: {
        width: 40,
        height: 4,
        backgroundColor: '#CBD5E1',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 16,
    },
    modalDocName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B',
    },
    modalDate: {
        fontSize: 13,
        color: '#64748B',
        marginBottom: 16,
    },
    noteSection: {
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    noteSectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 6,
    },
    noteSectionBody: {
        fontSize: 14,
        color: '#475569',
        lineHeight: 20,
    },
    noNotesText: {
        fontSize: 14,
        color: '#94A3B8',
        textAlign: 'center',
        paddingVertical: 24,
    },
    closeModalBtn: {
        backgroundColor: '#6366F1',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 16,
    },
    closeModalBtnText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '700',
    },
});
