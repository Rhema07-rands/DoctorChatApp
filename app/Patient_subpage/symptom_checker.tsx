import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ── Body Areas & Symptoms ───────────────────────────────────────────────────

const BODY_AREAS = [
    { id: 'head', label: 'Head & Brain', icon: '🧠', symptoms: ['Headache', 'Dizziness', 'Blurred vision', 'Migraine', 'Memory issues', 'Fainting'] },
    { id: 'ent', label: 'Ear, Nose & Throat', icon: '👃', symptoms: ['Sore throat', 'Ear pain', 'Runny nose', 'Loss of smell/taste', 'Snoring', 'Nosebleed'] },
    { id: 'chest', label: 'Chest & Lungs', icon: '🫁', symptoms: ['Chest pain', 'Shortness of breath', 'Cough', 'Wheezing', 'Palpitations', 'Chest tightness'] },
    { id: 'heart', label: 'Heart', icon: '❤️', symptoms: ['Rapid heartbeat', 'Chest pressure', 'Swollen ankles', 'Fatigue', 'Irregular pulse'] },
    { id: 'stomach', label: 'Stomach & Abdomen', icon: '🤢', symptoms: ['Nausea', 'Vomiting', 'Abdominal pain', 'Bloating', 'Diarrhea', 'Constipation', 'Acid reflux'] },
    { id: 'skin', label: 'Skin', icon: '🩹', symptoms: ['Rash', 'Itching', 'Swelling', 'Dry skin', 'Acne', 'Bruising easily', 'Wound not healing'] },
    { id: 'muscles', label: 'Muscles & Joints', icon: '💪', symptoms: ['Joint pain', 'Back pain', 'Muscle cramps', 'Stiffness', 'Swollen joints', 'Weakness'] },
    { id: 'mental', label: 'Mental Health', icon: '🧘', symptoms: ['Anxiety', 'Depression', 'Insomnia', 'Stress', 'Panic attacks', 'Mood swings'] },
    { id: 'general', label: 'General', icon: '🌡️', symptoms: ['Fever', 'Fatigue', 'Weight change', 'Night sweats', 'Loss of appetite', 'Chills'] },
];

const SEVERITY_LEVELS = [
    { id: 'mild', label: 'Mild', desc: 'Noticeable but not limiting daily activities', color: '#22C55E', bg: '#DCFCE7' },
    { id: 'moderate', label: 'Moderate', desc: 'Affecting daily activities somewhat', color: '#F59E0B', bg: '#FEF3C7' },
    { id: 'severe', label: 'Severe', desc: 'Significantly limiting daily activities', color: '#EF4444', bg: '#FEE2E2' },
];

const DURATION_OPTIONS = ['Less than a day', '1-3 days', '4-7 days', '1-2 weeks', '2-4 weeks', 'More than a month'];

const SPECIALTY_MAP: Record<string, string> = {
    head: 'Neurology', ent: 'ENT', chest: 'Pulmonology', heart: 'Cardiology',
    stomach: 'Gastroenterology', skin: 'Dermatology', muscles: 'Orthopedics',
    mental: 'Psychiatry', general: 'General Practice',
};

// ── Component ───────────────────────────────────────────────────────────────

export default function SymptomChecker() {
    const router = useRouter();
    const [step, setStep] = useState(0);
    const [selectedArea, setSelectedArea] = useState<typeof BODY_AREAS[0] | null>(null);
    const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
    const [severity, setSeverity] = useState('');
    const [duration, setDuration] = useState('');

    const toggleSymptom = (symptom: string) => {
        setSelectedSymptoms(prev =>
            prev.includes(symptom) ? prev.filter(s => s !== symptom) : [...prev, symptom]
        );
    };

    const getSuggestedSpecialty = () => selectedArea ? SPECIALTY_MAP[selectedArea.id] || 'General Practice' : 'General Practice';

    const buildReason = () => {
        const parts = [];
        parts.push(`Area: ${selectedArea?.label}`);
        parts.push(`Symptoms: ${selectedSymptoms.join(', ')}`);
        parts.push(`Severity: ${severity}`);
        parts.push(`Duration: ${duration}`);
        return parts.join('\n');
    };

    const handleBookAppointment = () => {
        router.push({
            pathname: '/Patient_subpage/smart_search',
            params: {
                initialQuery: getSuggestedSpecialty(),
            }
        } as any);
    };

    const canProceed = () => {
        if (step === 0) return selectedArea !== null;
        if (step === 1) return selectedSymptoms.length > 0;
        if (step === 2) return severity !== '';
        if (step === 3) return duration !== '';
        return true;
    };

    const STEPS = ['Body Area', 'Symptoms', 'Severity', 'Duration', 'Summary'];

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => step > 0 ? setStep(step - 1) : router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Symptom Checker</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Progress */}
            <View style={styles.progressRow}>
                {STEPS.map((s, i) => (
                    <View key={s} style={[styles.progressDot, i <= step && styles.progressDotActive]} />
                ))}
            </View>
            <Text style={styles.stepLabel}>{STEPS[step]}</Text>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Step 0: Body Area */}
                {step === 0 && (
                    <View style={styles.grid}>
                        {BODY_AREAS.map(area => (
                            <TouchableOpacity
                                key={area.id}
                                style={[styles.areaCard, selectedArea?.id === area.id && styles.areaCardSelected]}
                                onPress={() => { setSelectedArea(area); setSelectedSymptoms([]); }}
                            >
                                <Text style={styles.areaIcon}>{area.icon}</Text>
                                <Text style={[styles.areaLabel, selectedArea?.id === area.id && { color: '#3B82F6' }]}>{area.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* Step 1: Symptoms */}
                {step === 1 && selectedArea && (
                    <View style={styles.chipGrid}>
                        {selectedArea.symptoms.map(symptom => {
                            const selected = selectedSymptoms.includes(symptom);
                            return (
                                <TouchableOpacity
                                    key={symptom}
                                    style={[styles.chip, selected && styles.chipSelected]}
                                    onPress={() => toggleSymptom(symptom)}
                                >
                                    <Ionicons
                                        name={selected ? 'checkmark-circle' : 'add-circle-outline'}
                                        size={18}
                                        color={selected ? '#FFF' : '#64748B'}
                                        style={{ marginRight: 6 }}
                                    />
                                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{symptom}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {/* Step 2: Severity */}
                {step === 2 && (
                    <View style={styles.severityList}>
                        {SEVERITY_LEVELS.map(level => (
                            <TouchableOpacity
                                key={level.id}
                                style={[styles.severityCard, severity === level.label && { borderColor: level.color, backgroundColor: level.bg }]}
                                onPress={() => setSeverity(level.label)}
                            >
                                <View style={[styles.severityDot, { backgroundColor: level.color }]} />
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.severityLabel, severity === level.label && { color: level.color }]}>{level.label}</Text>
                                    <Text style={styles.severityDesc}>{level.desc}</Text>
                                </View>
                                {severity === level.label && <Ionicons name="checkmark-circle" size={22} color={level.color} />}
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* Step 3: Duration */}
                {step === 3 && (
                    <View style={styles.durationList}>
                        {DURATION_OPTIONS.map(opt => (
                            <TouchableOpacity
                                key={opt}
                                style={[styles.durationItem, duration === opt && styles.durationItemSelected]}
                                onPress={() => setDuration(opt)}
                            >
                                <Text style={[styles.durationText, duration === opt && styles.durationTextSelected]}>{opt}</Text>
                                {duration === opt && <Ionicons name="checkmark" size={20} color="#3B82F6" />}
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* Step 4: Summary */}
                {step === 4 && (
                    <View style={styles.summaryContainer}>
                        <View style={styles.summaryCard}>
                            <Text style={styles.summaryTitle}>Your Symptom Report</Text>

                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Body Area</Text>
                                <Text style={styles.summaryValue}>{selectedArea?.icon} {selectedArea?.label}</Text>
                            </View>

                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Symptoms</Text>
                                <View style={styles.summaryChips}>
                                    {selectedSymptoms.map(s => (
                                        <View key={s} style={styles.miniChip}>
                                            <Text style={styles.miniChipText}>{s}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>

                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Severity</Text>
                                <Text style={styles.summaryValue}>{severity}</Text>
                            </View>

                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Duration</Text>
                                <Text style={styles.summaryValue}>{duration}</Text>
                            </View>
                        </View>

                        <View style={styles.suggestionCard}>
                            <Ionicons name="medkit" size={24} color="#6366F1" />
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={styles.suggestionTitle}>Suggested Specialty</Text>
                                <Text style={styles.suggestionText}>{getSuggestedSpecialty()}</Text>
                            </View>
                        </View>

                        <TouchableOpacity style={styles.bookBtn} onPress={handleBookAppointment}>
                            <Ionicons name="calendar" size={20} color="#FFF" style={{ marginRight: 8 }} />
                            <Text style={styles.bookBtnText}>Find a Doctor</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>

            {/* Navigation */}
            {step < 4 && (
                <View style={styles.navRow}>
                    <TouchableOpacity
                        style={[styles.nextBtn, !canProceed() && styles.nextBtnDisabled]}
                        disabled={!canProceed()}
                        onPress={() => setStep(step + 1)}
                    >
                        <Text style={styles.nextBtnText}>{step === 3 ? 'View Summary' : 'Next'}</Text>
                        <Ionicons name="arrow-forward" size={18} color="#FFF" />
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

    // Progress
    progressRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 12 },
    progressDot: { width: 32, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0' },
    progressDotActive: { backgroundColor: '#3B82F6' },
    stepLabel: { textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 16 },

    // Body area grid
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
    areaCard: {
        width: '47%', backgroundColor: '#FFF', borderRadius: 16, padding: 16, alignItems: 'center',
        borderWidth: 2, borderColor: '#E2E8F0', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 1,
    },
    areaCardSelected: { borderColor: '#3B82F6', backgroundColor: '#EFF6FF' },
    areaIcon: { fontSize: 32, marginBottom: 8 },
    areaLabel: { fontSize: 13, fontWeight: '600', color: '#475569', textAlign: 'center' },

    // Symptom chips
    chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    chip: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
        borderRadius: 24, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0',
    },
    chipSelected: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
    chipText: { fontSize: 14, color: '#475569', fontWeight: '500' },
    chipTextSelected: { color: '#FFF' },

    // Severity
    severityList: { gap: 12 },
    severityCard: {
        flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 14,
        backgroundColor: '#FFF', borderWidth: 2, borderColor: '#E2E8F0', gap: 12,
    },
    severityDot: { width: 12, height: 12, borderRadius: 6 },
    severityLabel: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
    severityDesc: { fontSize: 12, color: '#64748B', marginTop: 2 },

    // Duration
    durationList: { gap: 8 },
    durationItem: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12,
        backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0',
    },
    durationItemSelected: { borderColor: '#3B82F6', backgroundColor: '#EFF6FF' },
    durationText: { fontSize: 15, color: '#475569', fontWeight: '500' },
    durationTextSelected: { color: '#3B82F6', fontWeight: '600' },

    // Summary
    summaryContainer: { gap: 16 },
    summaryCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#E2E8F0' },
    summaryTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 16 },
    summaryRow: { marginBottom: 14 },
    summaryLabel: { fontSize: 12, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
    summaryValue: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
    summaryChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
    miniChip: { backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    miniChipText: { fontSize: 12, color: '#3B82F6', fontWeight: '600' },

    suggestionCard: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF2FF',
        borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#C7D2FE',
    },
    suggestionTitle: { fontSize: 12, color: '#64748B', fontWeight: '600' },
    suggestionText: { fontSize: 16, fontWeight: '700', color: '#4338CA' },

    bookBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#3B82F6', paddingVertical: 16, borderRadius: 14,
        shadowColor: '#3B82F6', shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
    },
    bookBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

    // Nav
    navRow: { paddingHorizontal: 20, paddingBottom: 20 },
    nextBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: '#3B82F6', paddingVertical: 16, borderRadius: 14,
    },
    nextBtnDisabled: { backgroundColor: '#94A3B8' },
    nextBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
