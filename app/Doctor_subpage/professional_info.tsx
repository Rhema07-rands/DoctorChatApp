import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import {
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/services/api';
import { useUser } from '../_context/UserContext';

export default function ProfessionalInfoScreen() {
    const router = useRouter();
    const {
        firstName, setFirstName,
        lastName, setLastName,
        email, setEmail,
        phone, setPhone,
        specialization, setSpecialization,
        license, setLicense,
        experience, setExperience,
        languages, setLanguages,
        education, setEducation,
        bio, setBio,
        clinicName, setClinicName,
        conditions, setConditions,
        refreshProfile
    } = useUser();

    const handleSave = async () => {
        try {
            const payload = {
                FirstName: firstName,
                LastName: lastName,
                Email: email,
                PhoneNumber: phone,
                Specialization: specialization,
                MedicalLicense: license,
                Experience: experience,
                Languages: typeof languages === 'string' ? languages.split(',').map(s => s.trim()) : languages,
                Education: education,
                Bio: bio,
                ClinicName: clinicName,
                Conditions: conditions
            };

            const response = await api.put('/doctor/profile', payload);

            if (response.status === 200) {
                // Update SecureStore with new data
                const updatedUser = response.data;
                await SecureStore.setItemAsync('userProfile', JSON.stringify(updatedUser));

                await refreshProfile();
                alert('Profile updated successfully!');
                router.back();
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            alert('Failed to update profile. Please try again.');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Professional Info</Text>
                <TouchableOpacity onPress={handleSave}>
                    <Text style={styles.saveText}>Save</Text>
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <View style={styles.formSection}>
                    <View style={styles.rowGap}>
                        <View style={styles.flex1}>
                            <Text style={styles.label}>First Name</Text>
                            <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} />
                        </View>
                        <View style={styles.flex1}>
                            <Text style={styles.label}>Last Name</Text>
                            <TextInput style={styles.input} value={lastName} onChangeText={setLastName} />
                        </View>
                    </View>

                    <Text style={styles.label}>Email Address</Text>
                    <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" />

                    <View style={styles.rowGap}>
                        <View style={styles.flex1}>
                            <Text style={styles.label}>Phone Number</Text>
                            <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                        </View>
                        <View style={styles.flex1}>
                            <Text style={styles.label}>Medical License</Text>
                            <TextInput style={styles.input} value={license} onChangeText={setLicense} />
                        </View>
                    </View>

                    <View style={styles.rowGap}>
                        <View style={styles.flex1}>
                            <Text style={styles.label}>Primary Specialization</Text>
                            <TextInput style={styles.input} value={specialization} onChangeText={setSpecialization} />
                        </View>
                        <View style={styles.flex1}>
                            <Text style={styles.label}>Years of Experience</Text>
                            <TextInput style={styles.input} value={experience} onChangeText={setExperience} keyboardType="numeric" />
                        </View>
                    </View>

                    <View style={styles.rowGap}>
                        <View style={styles.flex1}>
                            <Text style={styles.label}>Languages Spoken</Text>
                            <TextInput style={styles.input} value={languages} onChangeText={setLanguages} />
                        </View>
                        <View style={styles.flex1}>
                            <Text style={styles.label}>Clinic Name</Text>
                            <TextInput style={styles.input} value={clinicName} onChangeText={setClinicName} />
                        </View>
                    </View>

                    <Text style={styles.label}>Treated Conditions (comma separated)</Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        value={conditions.join(', ')}
                        onChangeText={(text) => setConditions(text.split(',').map(c => c.trim()))}
                        multiline
                    />

                    <Text style={styles.label}>Education & Qualifications</Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        value={education}
                        onChangeText={setEducation}
                        multiline
                    />

                    <Text style={styles.label}>Professional Bio</Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        value={bio}
                        onChangeText={setBio}
                        multiline
                    />
                </View>
            </ScrollView>
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
    rowGap: { flexDirection: 'row', gap: 12 },
    flex1: { flex: 1 },
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
    textArea: { height: 100, textAlignVertical: 'top' },
});
