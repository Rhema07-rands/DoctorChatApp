import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomDropdown from '../../src/components/CustomDropdown';
import { useUser } from '../_context/UserContext';

const GENDER_OPTIONS = ['Male', 'Female', 'Other'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const GENOTYPES = ['AA', 'AS', 'SS', 'AC'];

function calculateAge(dobStr: string): string {
    const birthDate = new Date(dobStr);
    if (isNaN(birthDate.getTime())) return '';
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const mDiff = today.getMonth() - birthDate.getMonth();
    if (mDiff < 0 || (mDiff === 0 && today.getDate() < birthDate.getDate())) age--;
    return age >= 0 ? age.toString() : '';
}

export default function PatientPersonalInfoScreen() {
    const router = useRouter();
    const {
        patientName, setPatientName,
        patientAge,
        patientDob, setPatientDob,
        patientGender, setPatientGender,
        patientAddress, setPatientAddress,
        patientBloodGroup, setPatientBloodGroup,
        patientGenotype, setPatientGenotype,
        patientAllergies, setPatientAllergies,
    } = useUser();

    const [showDatePicker, setShowDatePicker] = useState(false);

    // Local state to prevent committing to Context until "Save" is pressed
    const [form, setForm] = useState({
        name: patientName,
        age: patientAge,  // display only, auto-calculated
        dob: patientDob,
        gender: patientGender,
        address: patientAddress,
        bloodGroup: patientBloodGroup,
        genotype: patientGenotype,
        allergies: patientAllergies,
    });

    const handleInput = (key: keyof typeof form, value: string) => {
        const updated = { ...form, [key]: value };
        // Auto-compute age when DOB changes
        if (key === 'dob') {
            updated.age = calculateAge(value);
        }
        setForm(updated);
    };

    const handleSave = () => {
        if (!form.name || !form.dob) {
            Alert.alert('Validation Error', 'Name and Date of Birth are required.');
            return;
        }

        // Commit to global context
        setPatientName(form.name);
        setPatientDob(form.dob);
        setPatientGender(form.gender);
        setPatientAddress(form.address);
        setPatientBloodGroup(form.bloodGroup);
        setPatientGenotype(form.genotype);
        setPatientAllergies(form.allergies);

        Alert.alert("Success", "Personal info updated successfully.");
        router.back();
    };

    const Label = ({ text }: { text: string }) => (
        <Text style={styles.label}>{text}</Text>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Personal Info</Text>
                <TouchableOpacity onPress={handleSave}>
                    <Text style={styles.saveText}>Save</Text>
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <View style={styles.formSection}>
                    <Label text="Full Name" />
                    <TextInput
                        style={styles.input}
                        value={form.name}
                        onChangeText={(t) => handleInput('name', t)}
                        placeholder="John Doe"
                    />

                    <View style={styles.row}>
                        <View style={styles.halfInput}>
                            <Label text="Date of Birth" />
                            <TouchableOpacity 
                                style={[styles.input, { justifyContent: 'center' }]} 
                                onPress={() => setShowDatePicker(true)}
                            >
                                <Text style={{ color: form.dob ? '#1E293B' : '#9CA3AF' }}>
                                    {form.dob || "mm/dd/yyyy"}
                                </Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.halfInput}>
                            <Label text="Age" />
                            <TextInput
                                style={[styles.input, { backgroundColor: '#F3F4F6', color: '#6B7280' }]}
                                value={form.age}
                                editable={false}
                                placeholder="Auto"
                            />
                        </View>
                    </View>

                    <Label text="Gender" />
                    <CustomDropdown
                        data={GENDER_OPTIONS}
                        label="Select Gender"
                        selectedVal={form.gender}
                        onSelect={(val) => handleInput('gender', val)}
                    />

                    <Label text="Address" />
                    <TextInput
                        style={styles.input}
                        value={form.address}
                        onChangeText={(t) => handleInput('address', t)}
                        placeholder="123 Main St"
                    />

                    <View style={styles.row}>
                        <View style={styles.halfInput}>
                            <Label text="Blood Group" />
                            <CustomDropdown
                                data={BLOOD_GROUPS}
                                label="Select"
                                selectedVal={form.bloodGroup}
                                onSelect={(val) => handleInput('bloodGroup', val)}
                            />
                        </View>
                        <View style={styles.halfInput}>
                            <Label text="Genotype" />
                            <CustomDropdown
                                data={GENOTYPES}
                                label="Select"
                                selectedVal={form.genotype}
                                onSelect={(val) => handleInput('genotype', val)}
                            />
                        </View>
                    </View>

                    <Label text="Known Allergies" />
                    <TextInput
                        style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                        value={form.allergies}
                        onChangeText={(t) => handleInput('allergies', t)}
                        placeholder="List any known allergies here..."
                        multiline
                    />
                </View>
                <View style={{ height: 40 }} />
            </ScrollView>

            {showDatePicker && (
                <View style={Platform.OS === 'ios' ? styles.iosPickerContainer : undefined}>
                    {Platform.OS === 'ios' && (
                        <View style={styles.iosPickerHeader}>
                            <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                                <Text style={styles.iosPickerDone}>Done</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    <DateTimePicker
                        value={
                            form.dob && !isNaN(new Date(form.dob).getTime())
                                ? new Date(form.dob)
                                : new Date()
                        }
                        mode="date"
                        display="default"
                        maximumDate={new Date()}
                        onChange={(event, selectedDate) => {
                            if (Platform.OS === 'android') {
                                setShowDatePicker(false);
                            }
                            if (selectedDate) {
                                const formatted = `${String(selectedDate.getMonth() + 1).padStart(2, '0')}/${String(selectedDate.getDate()).padStart(2, '0')}/${selectedDate.getFullYear()}`;
                                handleInput('dob', formatted);
                            }
                        }}
                    />
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'white' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
    saveText: { fontSize: 16, color: '#3B82F6', fontWeight: '600' },
    scrollContent: { padding: 20 },
    formSection: { gap: 16 },
    label: { fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 4 },
    input: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 10,
        padding: 12,
        fontSize: 15,
        color: '#1E293B',
    },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    halfInput: { width: '48%' },

    /* ── iOS Picker ── */
    iosPickerContainer: {
        backgroundColor: 'white',
        position: 'absolute',
        bottom: 0,
        width: '100%',
        borderTopWidth: 1,
        borderColor: '#E5E7EB',
        paddingBottom: 20,
        zIndex: 999,
    },
    iosPickerHeader: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        padding: 15,
        borderBottomWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#F9FAFB',
    },
    iosPickerDone: {
        color: '#3B82F6',
        fontWeight: 'bold',
        fontSize: 16,
    }
});
