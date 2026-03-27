import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/services/api';
import { useAppointments } from '../_context/AppointmentContext';
import { useDoctorDirectory } from '../_context/DoctorDirectoryContext';

const CONSULTATION_TYPES = ['Video', 'Audio', 'Chat'] as const;

const TIME_SLOTS = [
    '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
    '11:00 AM', '11:30 AM', '01:00 PM', '01:30 PM',
    '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM',
    '04:00 PM', '04:30 PM',
];

function iconForType(t: string): keyof typeof Ionicons.glyphMap {
    switch (t) {
        case 'Video': return 'videocam-outline';
        case 'Audio': return 'call-outline';
        default: return 'chatbubble-outline';
    }
}

export default function BookAppointment() {
    const router = useRouter();
    const { doctorId } = useLocalSearchParams<{ doctorId: string }>();
    const { getDoctorById } = useDoctorDirectory();
    const { addAppointmentLocal } = useAppointments();

    const doctor = getDoctorById(doctorId!);

    const [selectedDate, setSelectedDate] = useState('');
    const [selectedTime, setSelectedTime] = useState('');
    const [consultType, setConsultType] = useState<typeof CONSULTATION_TYPES[number]>('Video');
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!doctor) {
        return (
            <SafeAreaView style={styles.container}>
                <Text style={{ textAlign: 'center', marginTop: 60, color: '#94A3B8' }}>Doctor not found.</Text>
            </SafeAreaView>
        );
    }

    // Generate next 7 days
    const dates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return {
            full: d.toISOString().split('T')[0],
            day: d.toLocaleDateString('en-US', { weekday: 'short' }),
            date: d.getDate(),
            month: d.toLocaleDateString('en-US', { month: 'short' }),
        };
    });

    const handleConfirm = async () => {
        if (!selectedDate) { Alert.alert('Select Date', 'Please choose a date.'); return; }
        if (!selectedTime) { Alert.alert('Select Time', 'Please choose a time slot.'); return; }

        setIsSubmitting(true);
        try {
            // Combine date and time (convert 12hr time to 24hr for safer parsing)
            const [timeMatch, period] = selectedTime.split(' ');
            let [hours, minutes] = timeMatch.split(':').map(Number);

            if (period === 'PM' && hours !== 12) hours += 12;
            if (period === 'AM' && hours === 12) hours = 0;

            const parsedDate = new Date(selectedDate);
            parsedDate.setHours(hours, minutes, 0, 0);

            const isoDateTime = parsedDate.toISOString();

            const payload = {
                DoctorId: doctor.id,
                DateTime: isoDateTime,
                Reason: reason || 'General Consultation',
                Type: consultType
            };

            const response = await api.post('/appointments', payload);

            // Assuming response.data contains the new AppointmentDto
            if (response.data) {
                // Map the DTO to our local Appointment type
                const a = response.data;
                const localAppt = {
                    id: a.id,
                    patientId: a.patientId,
                    patientName: a.patient?.firstName ? `${a.patient.firstName} ${a.patient.lastName}` : 'Patient',
                    doctorId: a.doctorId,
                    doctorName: a.doctor?.firstName ? `Dr. ${a.doctor.firstName} ${a.doctor.lastName}` : doctor.name,
                    dateTime: a.dateTime || isoDateTime,
                    date: new Date(a.dateTime).toISOString().split('T')[0],
                    time: new Date(a.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    type: a.type || consultType,
                    reason: a.reason,
                    status: a.status || 'Pending',
                    notes: a.clinicalNotes,
                    duration: a.duration || 30
                };

                // Update context
                if (addAppointmentLocal) {
                    addAppointmentLocal(localAppt);
                }
            }

            Alert.alert(
                'Appointment Booked!',
                `Your ${consultType} appointment with ${doctor.name} is set for ${selectedDate} at ${selectedTime}.`,
                [{ text: 'OK', onPress: () => router.back() }],
            );
        } catch (error: any) {
            console.error('Booking failed:', error);
            Alert.alert('Booking Failed', error.response?.data || 'An error occurred while booking the appointment.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Book Appointment</Text>
                <View style={{ width: 36 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Doctor mini card */}
                <View style={styles.miniCard}>
                    <View style={[styles.miniAvatar, { backgroundColor: doctor.profileColor }]}>
                        <Text style={styles.miniAvatarText}>{doctor.initials}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.miniName}>{doctor.name}</Text>
                        <Text style={styles.miniSpec}>{doctor.specialty}</Text>
                    </View>
                    <View style={styles.ratingChip}>
                        <Ionicons name="star" size={12} color="#F59E0B" />
                        <Text style={styles.ratingChipText}>{doctor.rating.toFixed(1)}</Text>
                    </View>
                </View>

                {/* Date picker */}
                <Text style={styles.label}>Select Date</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
                    {dates.map((d) => {
                        const active = selectedDate === d.full;
                        return (
                            <TouchableOpacity
                                key={d.full}
                                style={[styles.dateChip, active && styles.dateChipActive]}
                                onPress={() => setSelectedDate(d.full)}
                            >
                                <Text style={[styles.dateDay, active && styles.dateDayActive]}>{d.day}</Text>
                                <Text style={[styles.dateNum, active && styles.dateNumActive]}>{d.date}</Text>
                                <Text style={[styles.dateMonth, active && styles.dateMonthActive]}>{d.month}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {/* Time slots */}
                <Text style={styles.label}>Select Time</Text>
                <View style={styles.timeGrid}>
                    {TIME_SLOTS.map((t) => {
                        const active = selectedTime === t;
                        return (
                            <TouchableOpacity
                                key={t}
                                style={[styles.timeChip, active && styles.timeChipActive]}
                                onPress={() => setSelectedTime(t)}
                            >
                                <Text style={[styles.timeText, active && styles.timeTextActive]}>{t}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Consultation type */}
                <Text style={styles.label}>Consultation Type</Text>
                <View style={styles.typeRow}>
                    {CONSULTATION_TYPES.map((ct) => {
                        const active = consultType === ct;
                        return (
                            <TouchableOpacity
                                key={ct}
                                style={[styles.typeBtn, active && styles.typeBtnActive]}
                                onPress={() => setConsultType(ct)}
                            >
                                <Ionicons name={iconForType(ct)} size={20} color={active ? '#FFF' : '#64748B'} />
                                <Text style={[styles.typeText, active && styles.typeTextActive]}>{ct}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Reason */}
                <Text style={styles.label}>Reason for Visit</Text>
                <TextInput
                    style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                    placeholder="Describe your reason…"
                    placeholderTextColor="#94A3B8"
                    value={reason}
                    onChangeText={setReason}
                    multiline
                />

                {/* Confirm */}
                <TouchableOpacity style={styles.confirmBtn} activeOpacity={0.85} onPress={handleConfirm}>
                    <Text style={styles.confirmBtnText}>Confirm Booking</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 60 },

    /* Header */
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
    backBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },

    /* Mini card */
    miniCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, padding: 14, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    miniAvatar: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    miniAvatarText: { color: '#FFF', fontWeight: '700', fontSize: 17 },
    miniName: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
    miniSpec: { fontSize: 12, color: '#64748B', marginTop: 2 },
    ratingChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFFBEB', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
    ratingChipText: { fontSize: 12, fontWeight: '700', color: '#92400E' },

    /* Labels */
    label: { fontSize: 13, fontWeight: '600', color: '#64748B', marginTop: 20, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 },

    /* Date */
    dateScroll: { flexGrow: 0, marginBottom: 4 },
    dateChip: { width: 68, alignItems: 'center', paddingVertical: 12, borderRadius: 16, backgroundColor: '#FFF', marginRight: 10, borderWidth: 1, borderColor: '#E2E8F0' },
    dateChipActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
    dateDay: { fontSize: 11, fontWeight: '600', color: '#94A3B8' },
    dateDayActive: { color: '#E0E7FF' },
    dateNum: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginVertical: 2 },
    dateNumActive: { color: '#FFF' },
    dateMonth: { fontSize: 11, color: '#94A3B8' },
    dateMonthActive: { color: '#E0E7FF' },

    /* Time */
    timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    timeChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0' },
    timeChipActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
    timeText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
    timeTextActive: { color: '#FFF' },

    /* Type */
    typeRow: { flexDirection: 'row', gap: 10 },
    typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 14, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0' },
    typeBtnActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
    typeText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
    typeTextActive: { color: '#FFF' },

    /* Input */
    input: { backgroundColor: '#FFF', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#1E293B', borderWidth: 1, borderColor: '#E2E8F0' },

    /* Confirm */
    confirmBtn: { marginTop: 28, backgroundColor: '#6366F1', borderRadius: 16, paddingVertical: 16, alignItems: 'center', shadowColor: '#6366F1', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
    confirmBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
