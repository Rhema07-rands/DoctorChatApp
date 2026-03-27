import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../../src/services/api';
import type { Consultation } from '../../_context/AppointmentContext';
import { useAppointments } from '../../_context/AppointmentContext';
import { useTheme } from '../../_context/ThemeContext';

type TabType = 'Active' | 'History';

export default function ConsultationsScreen() {
    const router = useRouter();
    const {
        getActiveConsultations,
        getConsultationHistory,
        completeConsultation,
        updateConsultationNotes,
        getPatientById
    } = useAppointments();
    const { colors: themeColors, isDark } = useTheme();

    const [activeTab, setActiveTab] = useState<TabType>('Active');
    const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [notes, setNotes] = useState('');
    const [diagnosis, setDiagnosis] = useState('');
    const [prescription, setPrescription] = useState('');

    const activeConsultations = getActiveConsultations();
    const consultationHistory = getConsultationHistory();

    const consultations = activeTab === 'Active' ? activeConsultations : consultationHistory;

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'Video': return '📹';
            case 'Audio': return '🎙️';
            case 'Chat': return '💬';
            default: return '📋';
        }
    };

    const formatDateTime = (isoString: string) => {
        const date = new Date(isoString);
        const today = new Date();
        const isToday = date.toDateString() === today.toDateString();

        if (isToday) {
            return 'Today, ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        }
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' +
            date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };

    const getDuration = (consultation: Consultation) => {
        if (consultation.duration) {
            return `${consultation.duration} min`;
        }
        if (consultation.isActive) {
            const start = new Date(consultation.startTime);
            const now = new Date();
            const diff = Math.round((now.getTime() - start.getTime()) / 60000);
            return `${diff} min (ongoing)`;
        }
        return 'N/A';
    };

    const handleOpenDetails = (consultation: Consultation) => {
        setSelectedConsultation(consultation);
        setNotes(consultation.notes || '');
        setDiagnosis(consultation.diagnosis || '');
        setPrescription(consultation.prescription || '');
        setModalVisible(true);
    };

    const handleSaveNotes = () => {
        if (selectedConsultation) {
            updateConsultationNotes(selectedConsultation.id, notes);
            setModalVisible(false);
        }
    };

    const handleComplete = () => {
        if (!selectedConsultation || !selectedConsultation.isActive) return;
        Alert.alert(
            'Complete Consultation',
            'Save notes and mark this consultation as completed?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Complete', style: 'default', onPress: () => {
                        completeConsultation(selectedConsultation.id, notes, diagnosis, prescription);
                        setModalVisible(false);
                    }
                }
            ]
        );
    };

    const handleJoinConsultation = (consultation: Consultation) => {
        const patient = getPatientById(consultation.patientId);
        // Always navigate to chat — the primary way to interact with the patient
        router.push({
            pathname: '/Doctor_page/doctor_chats',
            params: {
                id: consultation.patientId,
                name: consultation.patientName,
                initials: patient?.initials || 'PT'
            }
        });
    };

    const renderConsultationCard = (consultation: Consultation) => {
        const patient = getPatientById(consultation.patientId);
        const KeyedTouchableOpacity = TouchableOpacity as any;

        return (
            <KeyedTouchableOpacity
                key={consultation.id}
                style={[styles.card, { backgroundColor: themeColors.card, borderWidth: isDark ? 1 : 0, borderColor: themeColors.cardBorder }]}
                onPress={() => handleOpenDetails(consultation)}
            >
                {/* Patient Info */}
                <View style={styles.patientRow}>
                    <View style={[styles.avatar, { backgroundColor: patient?.avatarColor || '#3B82F6' }]}>
                        <Text style={styles.avatarText}>{patient?.initials || 'PT'}</Text>
                    </View>
                    <View style={styles.patientInfo}>
                        <Text style={[styles.patientName, { color: themeColors.text }]}>{consultation.patientName}</Text>
                        <View style={styles.typeRow}>
                            <Text style={styles.typeIcon}>{getTypeIcon(consultation.type)}</Text>
                            <Text style={[styles.typeText, { color: themeColors.textSecondary }]}>{consultation.type}</Text>
                            <Text style={styles.separator}>•</Text>
                            <Text style={[styles.durationText, { color: themeColors.textSecondary }]}>{getDuration(consultation)}</Text>
                        </View>
                    </View>
                    {consultation.isActive && (
                        <View style={styles.activeBadge}>
                            <View style={styles.activeDot} />
                            <Text style={styles.activeText}>Live</Text>
                        </View>
                    )}
                </View>

                {/* Time */}
                <Text style={[styles.timeText, { color: themeColors.textMuted }]}>🕐 {formatDateTime(consultation.startTime)}</Text>

                {/* Patient's Reason for Visit */}
                {consultation.reason && (
                    <View style={[styles.reasonPreview, isDark && { backgroundColor: 'rgba(254, 215, 170, 0.1)' }]}>
                        <Text style={[styles.reasonLabel, isDark && { color: '#FDBA74' }]}>📋 Reason:</Text>
                        <Text style={[styles.reasonText, isDark && { color: '#FFEDD5' }]} numberOfLines={2}>{consultation.reason}</Text>
                    </View>
                )}

                {/* Notes Preview */}
                {consultation.notes && (
                    <Text style={[styles.notesPreview, { color: themeColors.textSecondary }]} numberOfLines={2}>
                        📝 {consultation.notes}
                    </Text>
                )}

                {/* Diagnosis Preview */}
                {consultation.diagnosis && !consultation.isActive && (
                    <Text style={[styles.diagnosisPreview, isDark && { color: '#38BDF8' }]} numberOfLines={1}>
                        🩺 {consultation.diagnosis}
                    </Text>
                )}

                {/* Actions */}
                {consultation.isActive ? (
                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            style={styles.joinBtn}
                            onPress={() => handleJoinConsultation(consultation)}
                        >
                            <Text style={styles.btnTextWhite}>Join</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.notesBtn}
                            onPress={() => handleOpenDetails(consultation)}
                        >
                            <Text style={styles.btnTextBlue}>Add Notes</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={styles.viewDetailsBtn}
                        onPress={() => handleOpenDetails(consultation)}
                    >
                        <Text style={styles.viewDetailsText}>View Details →</Text>
                    </TouchableOpacity>
                )}
            </KeyedTouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: themeColors.text }]}>Consultations</Text>
                <Text style={[styles.headerSubtitle, { color: themeColors.textSecondary }]}>
                    {activeTab === 'Active' ? 'Ongoing sessions' : 'Past consultations'}
                </Text>
            </View>

            {/* Tabs */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, { backgroundColor: themeColors.surface, borderColor: themeColors.cardBorder }, activeTab === 'Active' && styles.tabActive]}
                    onPress={() => setActiveTab('Active')}
                >
                    <Text style={[styles.tabText, { color: themeColors.textSecondary }, activeTab === 'Active' && styles.tabTextActive]}>
                        Active {activeConsultations.length > 0 && `(${activeConsultations.length})`}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, { backgroundColor: themeColors.surface, borderColor: themeColors.cardBorder }, activeTab === 'History' && styles.tabActive]}
                    onPress={() => setActiveTab('History')}
                >
                    <Text style={[styles.tabText, { color: themeColors.textSecondary }, activeTab === 'History' && styles.tabTextActive]}>
                        History
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Consultations List */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {consultations.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons
                            name={activeTab === 'Active' ? 'medkit-outline' : 'medical-outline'}
                            size={64}
                            color={themeColors.textSecondary}
                            style={{ marginBottom: 16, opacity: 0.5 }}
                        />
                        <Text style={[styles.emptyTitle, { color: themeColors.text }]}>
                            {activeTab === 'Active' ? 'No active consultations' : 'No consultation history'}
                        </Text>
                        <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                            {activeTab === 'Active'
                                ? 'Start a consultation from your appointments'
                                : 'Completed consultations will appear here'}
                        </Text>
                    </View>
                ) : (
                    consultations.map(renderConsultationCard)
                )}

                <View style={{ height: 20 }} />
            </ScrollView>

            {/* Consultation Detail Modal */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: themeColors.surface }]}>
                        {/* Modal Header */}
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: themeColors.text }]}>Consultation Details</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Text style={[styles.closeBtn, { color: themeColors.textMuted }]}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {selectedConsultation && (
                                <>
                                    {/* Patient Info */}
                                    <View style={styles.modalSection}>
                                        <Text style={[styles.sectionLabel, { color: themeColors.textSecondary }]}>Patient</Text>
                                        <Text style={[styles.sectionValue, { color: themeColors.text }]}>{selectedConsultation.patientName}</Text>
                                    </View>

                                    {/* Time & Type */}
                                    <View style={styles.modalSection}>
                                        <Text style={[styles.sectionLabel, { color: themeColors.textSecondary }]}>Time & Type</Text>
                                        <Text style={[styles.sectionValue, { color: themeColors.text }]}>
                                            {formatDateTime(selectedConsultation.startTime)} • {selectedConsultation.type}
                                        </Text>
                                    </View>

                                    {/* Patient's Reason for Visit */}
                                    {selectedConsultation.reason && (
                                        <View style={styles.modalSection}>
                                            <Text style={[styles.sectionLabel, { color: themeColors.textSecondary }]}>Reason for Visit</Text>
                                            <View style={[styles.reasonBox, isDark && { backgroundColor: 'rgba(254, 215, 170, 0.1)', borderColor: 'rgba(254, 215, 170, 0.3)' }]}>
                                                <Text style={[styles.reasonBoxText, isDark && { color: '#FDBA74' }]}>{selectedConsultation.reason}</Text>
                                            </View>
                                        </View>
                                    )}

                                    {/* Notes */}
                                    <View style={styles.modalSection}>
                                        <Text style={[styles.sectionLabel, { color: themeColors.textSecondary }]}>Consultation Notes</Text>
                                        <TextInput
                                            style={[styles.textArea, { backgroundColor: themeColors.background, borderColor: themeColors.cardBorder, color: themeColors.inputText }]}
                                            placeholder="Add consultation notes..."
                                            placeholderTextColor={themeColors.placeholder}
                                            value={notes}
                                            onChangeText={setNotes}
                                            multiline
                                            numberOfLines={4}
                                            textAlignVertical="top"
                                            editable={selectedConsultation.isActive}
                                        />
                                    </View>

                                    {/* Diagnosis */}
                                    {(selectedConsultation.isActive || selectedConsultation.diagnosis) && (
                                        <View style={styles.modalSection}>
                                            <Text style={[styles.sectionLabel, { color: themeColors.textSecondary }]}>Diagnosis</Text>
                                            <TextInput
                                                style={[styles.input, { backgroundColor: themeColors.background, borderColor: themeColors.cardBorder, color: themeColors.inputText }]}
                                                placeholder="Enter diagnosis..."
                                                placeholderTextColor={themeColors.placeholder}
                                                value={diagnosis}
                                                onChangeText={setDiagnosis}
                                                editable={selectedConsultation.isActive}
                                            />
                                        </View>
                                    )}

                                    {/* Prescription */}
                                    {(selectedConsultation.isActive || selectedConsultation.prescription) && (
                                        <View style={styles.modalSection}>
                                            <Text style={[styles.sectionLabel, { color: themeColors.textSecondary }]}>Prescription</Text>
                                            <TextInput
                                                style={[styles.textArea, { backgroundColor: themeColors.background, borderColor: themeColors.cardBorder, color: themeColors.inputText }]}
                                                placeholder="Enter prescription details..."
                                                placeholderTextColor={themeColors.placeholder}
                                                value={prescription}
                                                onChangeText={setPrescription}
                                                multiline
                                                numberOfLines={3}
                                                textAlignVertical="top"
                                                editable={selectedConsultation.isActive}
                                            />
                                        </View>
                                    )}
                                </>
                            )}
                        </ScrollView>

                        {/* Modal Actions */}
                        <View style={styles.modalActions}>
                            {selectedConsultation?.isActive ? (
                                <>
                                    <TouchableOpacity
                                        style={styles.saveBtn}
                                        onPress={handleSaveNotes}
                                    >
                                        <Text style={styles.btnTextWhite}>Save Notes</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.completeBtn}
                                        onPress={handleComplete}
                                    >
                                        <Text style={styles.btnTextWhite}>✓ Complete Consultation</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <TouchableOpacity
                                    style={styles.closeModalBtn}
                                    onPress={() => setModalVisible(false)}
                                >
                                    <Text style={styles.btnTextWhite}>Close</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>
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
    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginBottom: 16,
        gap: 8
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: 'white',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    tabActive: {
        backgroundColor: '#3B82F6',
        borderColor: '#3B82F6'
    },
    tabText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#64748B'
    },
    tabTextActive: {
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
    activeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#DCFCE7',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4
    },
    activeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#16A34A'
    },
    activeText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#16A34A'
    },
    timeText: {
        fontSize: 13,
        color: '#64748B',
        marginBottom: 8
    },
    notesPreview: {
        fontSize: 13,
        color: '#475569',
        marginBottom: 12,
        lineHeight: 18
    },
    actionRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 4
    },
    joinBtn: {
        flex: 1,
        backgroundColor: '#3B82F6',
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center'
    },
    notesBtn: {
        flex: 1,
        backgroundColor: '#F1F5F9',
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center'
    },
    viewDetailsBtn: {
        paddingVertical: 8,
        alignItems: 'center'
    },
    viewDetailsText: {
        color: '#3B82F6',
        fontWeight: '600',
        fontSize: 14
    },
    btnTextWhite: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14
    },
    btnTextBlue: {
        color: '#3B82F6',
        fontWeight: '600',
        fontSize: 14
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
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end'
    },
    modalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        maxHeight: '85%'
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1E293B'
    },
    closeBtn: {
        fontSize: 24,
        color: '#64748B'
    },
    modalSection: {
        marginBottom: 20
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748B',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    sectionValue: {
        fontSize: 15,
        color: '#1E293B'
    },
    input: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 8,
        padding: 12,
        fontSize: 15,
        color: '#1E293B'
    },
    textArea: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 8,
        padding: 12,
        fontSize: 15,
        color: '#1E293B',
        minHeight: 100
    },
    modalActions: {
        gap: 10,
        marginTop: 10
    },
    saveBtn: {
        backgroundColor: '#3B82F6',
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center'
    },
    completeBtn: {
        backgroundColor: '#22C55E',
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center'
    },
    closeModalBtn: {
        backgroundColor: '#64748B',
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center'
    },
    // Reason styles
    reasonPreview: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 8,
        backgroundColor: '#FFF7ED',
        padding: 8,
        borderRadius: 8,
    },
    reasonLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#9A3412',
        marginRight: 4,
    },
    reasonText: {
        fontSize: 12,
        color: '#C2410C',
        flex: 1,
    },
    reasonBox: {
        backgroundColor: '#FFF7ED',
        borderRadius: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: '#FED7AA',
    },
    reasonBoxText: {
        fontSize: 14,
        color: '#9A3412',
        lineHeight: 20,
    },
    diagnosisPreview: {
        fontSize: 13,
        color: '#0369A1',
        marginBottom: 8,
        fontStyle: 'italic',
    }
});
