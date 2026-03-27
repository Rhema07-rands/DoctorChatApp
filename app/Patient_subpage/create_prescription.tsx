import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/services/api';
import { signalRService } from '../../src/services/signalrService';
import { useUser } from '../_context/UserContext';

// Handle notifications when app is foregrounded
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_ABBR: Record<string, string> = {
    Monday: 'M', Tuesday: 'T', Wednesday: 'W', Thursday: 'Th', Friday: 'F', Saturday: 'Sa', Sunday: 'Su',
};

// Map string days to numbers for Expo weekly trigger (1 = Sunday, 7 = Saturday)
const DAY_TO_NUMBER: Record<string, number> = {
    Sunday: 1, Monday: 2, Tuesday: 3, Wednesday: 4, Thursday: 5, Friday: 6, Saturday: 7,
};

// Helper to format Date -> "08:30 AM"
function formatTime(date: Date) {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strMinutes = minutes < 10 ? '0' + minutes : minutes.toString();
    return `${hours}:${strMinutes} ${ampm}`;
}

// Helper to parse "08:30 AM" back to Date
function parseTimeStringToDate(timeStr: string) {
    const defaultDate = new Date();
    const match = timeStr.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return defaultDate;
    let hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    const period = match[3].toUpperCase();

    if (period === 'PM' && hour < 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;

    defaultDate.setHours(hour, minute, 0, 0);
    return defaultDate;
}

export default function CreatePrescription() {
    const { prescriptions, setPrescriptions } = useUser();
    const router = useRouter();
    const { id, patientId } = useLocalSearchParams<{ id?: string, patientId?: string }>();

    const [drugOrActivity, setDrugOrActivity] = useState('');
    const [alarmTime, setAlarmTime] = useState<Date>(new Date());
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [intervalType, setIntervalType] = useState<'everyday' | 'specific'>('everyday');
    const [specificDays, setSpecificDays] = useState<string[]>([]);
    const [doctorName, setDoctorName] = useState('');
    const [doctorId, setDoctorId] = useState('');
    const [condition, setCondition] = useState('');
    const [existingCreatedAt, setExistingCreatedAt] = useState<string | null>(null);

    useEffect(() => {
        if (id) {
            const existing = prescriptions.find(p => p.id === id);
            if (existing) {
                setDrugOrActivity(existing.drugOrActivity);
                setAlarmTime(parseTimeStringToDate(existing.alarmTime));
                setIntervalType(existing.intervalType);
                setSpecificDays(existing.specificDays);
                setDoctorName(existing.doctorName || '');
                setDoctorId(existing.doctorId || '');
                setCondition(existing.condition || '');
                setExistingCreatedAt(existing.createdAt || null);
            }
        }
    }, [id, prescriptions]);

    useEffect(() => {
        // Request permissions when the component mounts
        (async () => {
            const { status } = await Notifications.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Please enable notifications for alarms to work.');
            }
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('alarms', {
                    name: 'Alarms',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000], // 5 long pulses
                    lightColor: '#FF231F7C',
                    sound: "default",
                    audioAttributes: {
                        usage: Notifications.AndroidAudioUsage.ALARM,
                        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
                    }
                });
            }
        })();
    }, []);

    const toggleDay = (day: string) => {
        setSpecificDays((prev) =>
            prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
        );
    };

    const handleSave = async () => {
        if (!drugOrActivity.trim()) {
            Alert.alert('Missing Fields', 'Please fill in the drug/activity name.');
            return;
        }
        if (intervalType === 'specific' && specificDays.length === 0) {
            Alert.alert('Missing Days', 'Please select at least one day of the week.');
            return;
        }

        // Schedule notifications (Only if we are the patient adding this directly, NOT if a doctor is composing it for a patient)
        if (!patientId) {
            const daysToSchedule = intervalType === 'everyday' ? WEEK_DAYS : specificDays;
            try {
                const hour = alarmTime.getHours();
                const minute = alarmTime.getMinutes();

                for (const day of daysToSchedule) {
                    const weekday = DAY_TO_NUMBER[day];
                    await Notifications.scheduleNotificationAsync({
                        content: {
                            title: "Medication Reminder 💊",
                            body: `It is time to take your ${drugOrActivity}`,
                            sound: true,
                            categoryIdentifier: 'prescription_alarm',
                            vibrate: [0, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000],
                        },
                        trigger: {
                            weekday,
                            hour,
                            minute,
                            repeats: true,
                            channelId: 'alarms',
                        },
                    });
                }
                console.log("Scheduled notifications successfully for", daysToSchedule);
            } catch (e) {
                console.error("Failed to schedule notification", e);
                Alert.alert("Scheduling Error", "We could not set your alarm. Please check your notification permissions.");
            }
        }

        if (id) {
            setPrescriptions((prev) => prev.map(p => p.id === id ? {
                ...p,
                drugOrActivity: drugOrActivity.trim(),
                alarmTime: formatTime(alarmTime),
                intervalType,
                specificDays: intervalType === 'everyday' ? WEEK_DAYS : specificDays,
                doctorName: doctorName.trim(),
                doctorId: doctorId.trim(),
                condition: condition.trim()
            } : p));
        } else {
            const newPrescriptionData = {
                drugOrActivity: drugOrActivity.trim(),
                alarmTime: formatTime(alarmTime),
                intervalType,
                specificDays: intervalType === 'everyday' ? WEEK_DAYS : specificDays,
                doctorName: doctorName.trim(),
                doctorId: doctorId.trim(),
                condition: condition.trim(),
                medicationName: drugOrActivity.trim(),
            };

            let savedId = Date.now().toString();

            // Save to backend (for patient-created prescriptions)
            if (!patientId) {
                try {
                    const response = await api.post('/prescriptions', newPrescriptionData);
                    if (response.data?.id) savedId = response.data.id;
                } catch (err) {
                    console.error('Failed to save prescription to API:', err);
                }
            }

            setPrescriptions((prev) => [
                {
                    id: savedId,
                    ...newPrescriptionData,
                    createdAt: new Date().toISOString(),
                },
                ...prev,
            ]);
        }

        if (patientId) {
            try {
                const newPrescription = {
                    id: Date.now().toString(),
                    drugOrActivity: drugOrActivity.trim(),
                    alarmTime: formatTime(alarmTime),
                    intervalType,
                    specificDays: intervalType === 'everyday' ? WEEK_DAYS : specificDays,
                    doctorName: doctorName.trim(),
                    doctorId: doctorId.trim(),
                    condition: condition.trim(),
                    createdAt: new Date().toISOString(),
                };

                await signalRService.invoke(
                    'SendMessage',
                    patientId,
                    `Prescription for ${drugOrActivity.trim()} sent.`,
                    'prescription',
                    JSON.stringify(newPrescription),
                    null
                );
            } catch (err) {
                console.log('Failed to send prescription message to chat', err);
            }
        }

        router.back();
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{id ? "Edit Prescription" : "New Prescription"}</Text>
                <View style={{ width: 36 }} />
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Drug / Activity */}
                    <Text style={styles.label}>Drug / Activity</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. Amoxicillin 500mg"
                        placeholderTextColor="#94A3B8"
                        value={drugOrActivity}
                        onChangeText={setDrugOrActivity}
                    />

                    {/* Alarm Time */}
                    <Text style={styles.label}>Alarm Time</Text>
                    <TouchableOpacity
                        style={[styles.input, { justifyContent: 'center' }]}
                        activeOpacity={0.7}
                        onPress={() => setShowTimePicker(true)}
                    >
                        <Text style={{ color: '#1E293B', fontSize: 15 }}>
                            {formatTime(alarmTime)}
                        </Text>
                    </TouchableOpacity>

                    {showTimePicker && (
                        <DateTimePicker
                            value={alarmTime}
                            mode="time"
                            display="default"
                            onChange={(event, selectedDate) => {
                                setShowTimePicker(Platform.OS === 'ios');
                                if (selectedDate) setAlarmTime(selectedDate);
                            }}
                        />
                    )}

                    {/* Interval */}
                    <Text style={styles.label}>Interval</Text>
                    <View style={styles.toggleRow}>
                        <TouchableOpacity
                            style={[
                                styles.toggleBtn,
                                intervalType === 'everyday' && styles.toggleBtnActive,
                            ]}
                            onPress={() => setIntervalType('everyday')}
                        >
                            <Text
                                style={[
                                    styles.toggleText,
                                    intervalType === 'everyday' && styles.toggleTextActive,
                                ]}
                            >
                                Everyday
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.toggleBtn,
                                intervalType === 'specific' && styles.toggleBtnActive,
                            ]}
                            onPress={() => setIntervalType('specific')}
                        >
                            <Text
                                style={[
                                    styles.toggleText,
                                    intervalType === 'specific' && styles.toggleTextActive,
                                ]}
                            >
                                Specific Days
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Day chips (only when "Specific Days" chosen) */}
                    {intervalType === 'specific' && (
                        <View style={styles.daysRow}>
                            {WEEK_DAYS.map((day) => {
                                const selected = specificDays.includes(day);
                                return (
                                    <TouchableOpacity
                                        key={day}
                                        style={[styles.dayChip, selected && styles.dayChipActive]}
                                        onPress={() => toggleDay(day)}
                                    >
                                        <Text
                                            style={[
                                                styles.dayChipText,
                                                selected && styles.dayChipTextActive,
                                            ]}
                                        >
                                            {DAY_ABBR[day]}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}

                    {/* Doctor Name */}
                    <Text style={styles.label}>Prescribing Doctor</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. Sarah Johnson"
                        placeholderTextColor="#94A3B8"
                        value={doctorName}
                        onChangeText={setDoctorName}
                    />

                    {/* Doctor ID */}
                    <Text style={styles.label}>Doctor ID</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. D12345"
                        placeholderTextColor="#94A3B8"
                        value={doctorId}
                        onChangeText={setDoctorId}
                    />

                    {/* Condition */}
                    <Text style={styles.label}>Condition</Text>
                    <TextInput
                        style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                        placeholder="e.g. Hypertension"
                        placeholderTextColor="#94A3B8"
                        value={condition}
                        onChangeText={setCondition}
                        multiline
                    />

                    {/* Save button */}
                    <TouchableOpacity style={styles.saveBtn} activeOpacity={0.85} onPress={handleSave}>
                        <Text style={styles.saveBtnText}>Save Prescription</Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },

    /* Header */
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
    },

    /* Form */
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 60,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748B',
        marginTop: 18,
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    input: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 15,
        color: '#1E293B',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },

    /* Interval toggle */
    toggleRow: {
        flexDirection: 'row',
        gap: 10,
    },
    toggleBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
    },
    toggleBtnActive: {
        backgroundColor: '#6366F1',
    },
    toggleText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
    },
    toggleTextActive: {
        color: '#FFFFFF',
    },

    /* Day chips */
    daysRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 12,
    },
    dayChip: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dayChipActive: {
        backgroundColor: '#6366F1',
    },
    dayChipText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748B',
    },
    dayChipTextActive: {
        color: '#FFFFFF',
    },

    /* Save */
    saveBtn: {
        marginTop: 30,
        backgroundColor: '#6366F1',
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 5,
    },
    saveBtnText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
