import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppointments } from '../_context/AppointmentContext';
import { useDoctorDirectory } from '../_context/DoctorDirectoryContext';

const TIME_SLOTS = [
    '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
    '11:00 AM', '11:30 AM', '01:00 PM', '01:30 PM',
    '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM',
    '04:00 PM', '04:30 PM',
];

export default function RescheduleAppointment() {
    const router = useRouter();
    const { appointmentId, doctorId } = useLocalSearchParams<{ appointmentId: string, doctorId: string }>();
    const { getDoctorById } = useDoctorDirectory();
    const { rescheduleAppointment, getAppointmentById } = useAppointments();

    const doctor = getDoctorById(doctorId!);
    const appointment = getAppointmentById(appointmentId!);

    const [selectedDate, setSelectedDate] = useState(appointment?.date || '');
    const [selectedTime, setSelectedTime] = useState(appointment?.time || '');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!doctor || !appointment) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={24} color="#0F172A" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Error</Text>
                    <View style={{ width: 36 }} />
                </View>
                <Text style={{ textAlign: 'center', marginTop: 60, color: '#94A3B8' }}>Appointment or Doctor not found.</Text>
            </SafeAreaView>
        );
    }

    // Generate next 14 days for rescheduling
    const dates = Array.from({ length: 14 }, (_, i) => {
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
            // Combine date and time
            const [timeMatch, period] = selectedTime.split(' ');
            let [hours, minutes] = timeMatch.split(':').map(Number);

            if (period === 'PM' && hours !== 12) hours += 12;
            if (period === 'AM' && hours === 12) hours = 0;

            const parsedDate = new Date(selectedDate);
            parsedDate.setHours(hours, minutes, 0, 0);

            const isoDateTime = parsedDate.toISOString();

            const success = await rescheduleAppointment(appointmentId!, isoDateTime);

            if (success) {
                Alert.alert(
                    'Appointment Rescheduled!',
                    `Your appointment with ${doctor.name} has been moved to ${selectedDate} at ${selectedTime}.`,
                    [{ text: 'OK', onPress: () => router.back() }],
                );
            } else {
                Alert.alert('Error', 'Failed to reschedule appointment. Please try again.');
            }
        } catch (error: any) {
            console.error('Rescheduling failed:', error);
            Alert.alert('Error', 'An error occurred while rescheduling.');
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
                <Text style={styles.headerTitle}>Reschedule Appointment</Text>
                <View style={{ width: 36 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Doctor mini card */}
                <View style={styles.miniCard}>
                    <View style={[styles.miniAvatar, { backgroundColor: doctor.profileColor || '#3B82F6' }]}>
                        <Text style={styles.miniAvatarText}>{doctor.initials}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.miniName}>{doctor.name}</Text>
                        <Text style={styles.miniSpec}>{doctor.specialty}</Text>
                    </View>
                </View>

                {/* Date picker */}
                <Text style={styles.label}>Select New Date</Text>
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
                <Text style={styles.label}>Select New Time</Text>
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

                {/* Confirm */}
                <TouchableOpacity
                    style={[styles.confirmBtn, isSubmitting && { opacity: 0.7 }]}
                    activeOpacity={0.85}
                    onPress={handleConfirm}
                    disabled={isSubmitting}
                >
                    <Text style={styles.confirmBtnText}>
                        {isSubmitting ? 'Rescheduling...' : 'Confirm Reschedule'}
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 60 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
    backBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
    miniCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, padding: 14, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    miniAvatar: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    miniAvatarText: { color: '#FFF', fontWeight: '700', fontSize: 17 },
    miniName: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
    miniSpec: { fontSize: 12, color: '#64748B', marginTop: 2 },
    label: { fontSize: 13, fontWeight: '600', color: '#64748B', marginTop: 20, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 },
    dateScroll: { flexGrow: 0, marginBottom: 4 },
    dateChip: { width: 68, alignItems: 'center', paddingVertical: 12, borderRadius: 16, backgroundColor: '#FFF', marginRight: 10, borderWidth: 1, borderColor: '#E2E8F0' },
    dateChipActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
    dateDay: { fontSize: 11, fontWeight: '600', color: '#94A3B8' },
    dateDayActive: { color: '#E0E7FF' },
    dateNum: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginVertical: 2 },
    dateNumActive: { color: '#FFF' },
    dateMonth: { fontSize: 11, color: '#94A3B8' },
    dateMonthActive: { color: '#E0E7FF' },
    timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    timeChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0' },
    timeChipActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
    timeText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
    timeTextActive: { color: '#FFF' },
    confirmBtn: { marginTop: 28, backgroundColor: '#6366F1', borderRadius: 16, paddingVertical: 16, alignItems: 'center', shadowColor: '#6366F1', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
    confirmBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
