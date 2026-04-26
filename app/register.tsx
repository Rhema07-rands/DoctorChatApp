import { Ionicons } from '@expo/vector-icons';
import FontAwesome from '@expo/vector-icons/build/FontAwesome';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform
} from "react-native";
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomDropdown from "../src/components/CustomDropdown";

import * as SecureStore from 'expo-secure-store';
import { api } from "../src/services/api";
import { notificationService } from "../src/services/notificationService";
import { uploadFile } from "../src/services/uploadService";
import { useAuthStore } from "../src/stores/authStore";
import { useUser } from "./_context/UserContext";

const GENDER_OPTIONS = ['Male', 'Female', 'Other'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const GENOTYPES = ['AA', 'AS', 'SS', 'AC'];
const SPECIALTIES = ['Cardiology', 'Dermatology', 'Neurology', 'Pediatrics', 'General Surgery', 'Obstetrics & Gynecology', 'Emergency Medicine'];
const COUNTRY_CODES = ['+1', '+44', '+234', '+91', '+61', '+27', '+254', '+233'];

export default function RegisterScreen() {
  const router = useRouter();
  const { refreshProfile } = useUser();
  const signIn = useAuthStore((s) => s.signIn);
  const [userType, setUserType] = useState<'patient' | 'doctor'>('patient');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    dob: '',
    gender: '',
    address: '',
    bloodGroup: '',
    genotype: '',
    allergies: '',
    conditions: '',
    specialization: 'General',
    medicalLicense: '',
    countryCode: '+234',
    phone: '',
    bio: '',
    education: '',
    experience: '',
    languages: '',
    clinicName: ''
  });

  const handleInputChange = (key: string, value: string) => {
    setFormData({ ...formData, [key]: value });
  };

  const pickAvatar = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*'],
      });
      if (!result.canceled) {
        setSelectedFile(result.assets[0]);
      }
    } catch (err) {
      console.log(err);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
      });
      if (!result.canceled) {
        setSelectedDocument(result.assets[0]);
      }
    } catch (err) {
      console.log(err);
    }
  };

  const safeDateISO = (input: string): string | null => {
    if (!input) return null;
    // Try parsing as-is first
    let d = new Date(input);
    // If that fails, try manual mm/dd/yyyy parse
    if (isNaN(d.getTime())) {
      const parts = input.split(/[\/\-\.]/);
      if (parts.length === 3) {
        const [m, day, y] = parts;
        d = new Date(Number(y), Number(m) - 1, Number(day));
      }
    }
    return isNaN(d.getTime()) ? null : d.toISOString();
  };

  const handleSignUp = async () => {
    // Basic checks
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password || !formData.phone) {
      Alert.alert("Error", "Please fill in all basic required fields.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert("Error", "Passwords do not match. Please make sure both passwords are identical.");
      return;
    }

    if (formData.password.length < 8) {
      Alert.alert("Error", "Password must be at least 8 characters long.");
      return;
    }

    if (isLoading) return;
    setIsLoading(true);

    // Role-specific checks
    if (userType === 'doctor') {
      if (!formData.specialization || !formData.medicalLicense || !formData.clinicName || !formData.bio || !formData.education || !formData.experience || !formData.languages || !formData.conditions) {
        Alert.alert("Error", "Please fill in all required professional fields.");
        return;
      }
      if (!selectedDocument) {
        Alert.alert("Error", "Please upload your professional certificate.");
        return;
      }
    } else {
      if (!formData.dob || !formData.gender || !formData.address || !formData.bloodGroup || !formData.genotype || !formData.allergies) {
        Alert.alert("Error", "Please fill in all medical profile fields.");
        return;
      }
    }

    // Adjust endpoint path for your API routes
    const endpoint = `/auth/register/${userType}`;

    let profilePicUrl = null;
    let documentUrl = null;

    try {
      if (selectedFile) {
        profilePicUrl = await uploadFile(selectedFile.uri, selectedFile.mimeType || 'image/jpeg');
      }
      if (selectedDocument) {
        // Simple mime type detection strictly for fallback
        let mime = 'application/pdf';
        if (selectedDocument.uri.endsWith('.jpg') || selectedDocument.uri.endsWith('.jpeg')) mime = 'image/jpeg';
        if (selectedDocument.uri.endsWith('.png')) mime = 'image/png';
        documentUrl = await uploadFile(selectedDocument.uri, selectedDocument.mimeType || mime);
      }
    } catch (err) {
      Alert.alert('Upload Error', 'Failed to upload files. Please try again.');
      return;
    }

    const submitData = {
      Email: formData.email,
      Password: formData.password,
      FirstName: formData.firstName,
      LastName: formData.lastName,
      ...(userType === 'doctor' ? {
        Specialization: formData.specialization,
        MedicalLicense: formData.medicalLicense,
        PhoneNumber: `${formData.countryCode}${formData.phone.replace(/^0+/, '')}`,
        Bio: formData.bio,
        Education: formData.education,
        Experience: formData.experience,
        Languages: formData.languages.split(',').map((l: string) => l.trim()),
        ClinicName: formData.clinicName,
        Conditions: formData.conditions.split(',').map((c: string) => c.trim()),
        CertificateUrl: documentUrl
      } : {
        BloodGroup: formData.bloodGroup,
        Genotype: formData.genotype,
        Gender: formData.gender,
        PhoneNumber: `${formData.countryCode}${formData.phone.replace(/^0+/, '')}`,
        DateOfBirth: safeDateISO(formData.dob),
        MedicalRecordsUrl: documentUrl,
        Allergies: formData.allergies || null
      }),
      ProfilePictureUrl: profilePicUrl
    };

    try {
      const response = await api.post(endpoint, submitData);

      if (response.data.token) {
        await SecureStore.setItemAsync('userToken', response.data.token);
      }

      if (response.data.user) {
        await SecureStore.setItemAsync('userProfile', JSON.stringify(response.data.user));
      }

      // Propagate into global context state
      await refreshProfile();

      // Register for Push Notifications immediately!
      try {
        await notificationService.registerForPushNotificationsAsync();
      } catch (pushError) {
        console.error("Failed to register for push notifications during registration:", pushError);
      }

      Alert.alert("Success", "Account created successfully!");

      // Sync Zustand auth store
      signIn(userType);

      // Navigation Logic
      if (userType === 'doctor') {
        router.replace('/(tab)/Doctor_page/doctor_dashboard');
      } else {
        router.replace('/(tab)/Patient_page/patient_dashboard');
      }
    } catch (error: any) {
      console.error(error.response?.data);
      Alert.alert("Registration Failed", error.response?.data || error.message || "Failed to create account");
    } finally {
      setIsLoading(false);
    }
  };

  const Label = ({ text }: { text: string }) => (
    <Text style={styles.labelText}>{text}</Text>
  );

  const avatarColor = selectedFile ? 'transparent' : '#D1D5DB';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.headerBox}>
          <FontAwesome name="medkit" size={60} color="#1E3A8A" style={{ marginBottom: 10 }} />
          <Text style={styles.logoText}>Doctor Chat</Text>
          <Text style={styles.title}>Create your account</Text>
        </View>

        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleBtn, userType === 'patient' && styles.activeToggle, isLoading && { opacity: 0.5 }]}
            onPress={() => setUserType('patient')}
            disabled={isLoading}
          >
            <Text style={{ color: userType === 'patient' ? '#1E3A8A' : '#6B7280', fontWeight: 'bold' }}>Patient</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, userType === 'doctor' && styles.activeToggle, isLoading && { opacity: 0.5 }]}
            onPress={() => setUserType('doctor')}
            disabled={isLoading}
          >
            <Text style={{ color: userType === 'doctor' ? '#1E3A8A' : '#6B7280', fontWeight: 'bold' }}>Doctor</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          {/* ── Avatar Picker (top of form) ── */}
          <View style={styles.avatarContainer}>
            <View style={[styles.avatarCircle, { backgroundColor: avatarColor }]}>
              {selectedFile ? (
                <Image source={{ uri: selectedFile.uri }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={44} color="#9CA3AF" />
              )}
            </View>
            <TouchableOpacity onPress={pickAvatar} style={[styles.cameraBadge, isLoading && { opacity: 0.5 }]} disabled={isLoading}>
              <Ionicons name="camera" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.avatarHint}>Tap to upload profile picture</Text>

          {/* ── Common Fields ── */}
          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Label text="First Name" />
              <TextInput style={[styles.input, isLoading && styles.inputDisabled]} value={formData.firstName} placeholder="John" onChangeText={(t) => handleInputChange('firstName', t)} editable={!isLoading} />
            </View>
            <View style={styles.halfInput}>
              <Label text="Last Name" />
              <TextInput style={[styles.input, isLoading && styles.inputDisabled]} value={formData.lastName} placeholder="Doe" onChangeText={(t) => handleInputChange('lastName', t)} editable={!isLoading} />
            </View>
          </View>

          <Label text="Email" />
          <TextInput style={[styles.input, isLoading && styles.inputDisabled]} value={formData.email} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" onChangeText={(t) => handleInputChange('email', t)} editable={!isLoading} />

          <Label text="Phone Number" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ width: '30%' }}>
              <CustomDropdown
                label="+234"
                data={COUNTRY_CODES}
                selectedVal={formData.countryCode}
                onSelect={(val) => handleInputChange('countryCode', val)}
                disabled={isLoading}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextInput 
                style={[styles.input, isLoading && styles.inputDisabled, { marginBottom: 15 }]} 
                value={formData.phone} 
                placeholder="906 324 5195" 
                keyboardType="phone-pad" 
                maxLength={11} 
                onChangeText={(t) => handleInputChange('phone', t)} 
                editable={!isLoading} 
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Label text="Password" />
              <TextInput style={[styles.input, isLoading && styles.inputDisabled]} value={formData.password} placeholder="••••••••" secureTextEntry onChangeText={(t) => handleInputChange('password', t)} editable={!isLoading} />
            </View>
            <View style={styles.halfInput}>
              <Label text="Confirm Password" />
              <TextInput
                style={[
                  styles.input,
                  isLoading && styles.inputDisabled,
                  formData.confirmPassword.length > 0 && formData.password !== formData.confirmPassword && styles.inputError
                ]}
                value={formData.confirmPassword}
                placeholder="••••••••"
                secureTextEntry
                onChangeText={(t) => handleInputChange('confirmPassword', t)}
                editable={!isLoading}
              />
              {formData.confirmPassword.length > 0 && formData.password !== formData.confirmPassword && (
                <Text style={styles.errorHint}>Passwords do not match</Text>
              )}
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Label text="Date of Birth" />
              <TouchableOpacity 
                style={[styles.input, isLoading && styles.inputDisabled, { justifyContent: 'center' }]} 
                onPress={() => setShowDatePicker(true)}
                disabled={isLoading}
              >
                <Text style={{ color: formData.dob ? '#000' : '#9CA3AF' }}>
                  {formData.dob || "mm/dd/yyyy"}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.halfInput}>
              <Label text="Gender" />
              <CustomDropdown
                label="Select"
                data={GENDER_OPTIONS}
                selectedVal={formData.gender}
                onSelect={(val) => handleInputChange('gender', val)}
                disabled={isLoading}
              />
            </View>
          </View>

          {/* ── Patient-Specific Fields ── */}
          {userType === 'patient' && (
            <>
              <Label text="Address" />
              <TextInput style={[styles.input, isLoading && styles.inputDisabled]} value={formData.address} placeholder="123 Main St" onChangeText={(t) => handleInputChange('address', t)} editable={!isLoading} />

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Label text="Blood Group" />
                  <CustomDropdown label="Select" data={BLOOD_GROUPS} selectedVal={formData.bloodGroup} onSelect={(val) => handleInputChange('bloodGroup', val)} disabled={isLoading} />
                </View>
                <View style={styles.halfInput}>
                  <Label text="Genotype" />
                  <CustomDropdown label="Select" data={GENOTYPES} selectedVal={formData.genotype} onSelect={(val) => handleInputChange('genotype', val)} disabled={isLoading} />
                </View>
              </View>

              <Label text="Known Allergies" />
              <TextInput style={[styles.input, isLoading && styles.inputDisabled]} value={formData.allergies} placeholder="e.g. Peanuts" onChangeText={(t) => handleInputChange('allergies', t)} editable={!isLoading} />

              <Label text="Doctor Specialty" />
              <CustomDropdown label="Select" data={SPECIALTIES} selectedVal={formData.specialization} onSelect={(val) => handleInputChange('specialization', val)} disabled={isLoading} />

              {/* Medical Records Upload */}
              <Label text="Medical Records (PDF / Image)" />
              <TouchableOpacity onPress={pickDocument} style={[styles.documentPicker, isLoading && styles.documentPickerDisabled]} disabled={isLoading}>
                <Ionicons name="document-attach" size={20} color="#6B7280" />
                <Text numberOfLines={1} style={styles.documentName}>
                  {selectedDocument ? selectedDocument.name : "Upload medical records"}
                </Text>
                <View style={styles.documentBtn}><Text style={styles.documentBtnText}>Browse</Text></View>
              </TouchableOpacity>
            </>
          )}

          {/* ── Doctor-Specific Fields ── */}
          {userType === 'doctor' && (
            <>
              <Label text="Bio" />
              <TextInput style={[styles.input, isLoading && styles.inputDisabled]} value={formData.bio} placeholder="Short bio..." onChangeText={(t) => handleInputChange('bio', t)} editable={!isLoading} />

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Label text="Education" />
                  <TextInput style={[styles.input, isLoading && styles.inputDisabled]} value={formData.education} placeholder="Medical School" onChangeText={(t) => handleInputChange('education', t)} editable={!isLoading} />
                </View>
                <View style={styles.halfInput}>
                  <Label text="Experience" />
                  <TextInput style={[styles.input, isLoading && styles.inputDisabled]} value={formData.experience} placeholder="e.g. 5 Years" onChangeText={(t) => handleInputChange('experience', t)} editable={!isLoading} />
                </View>
              </View>

              <Label text="Languages Spoken" />
              <TextInput style={[styles.input, isLoading && styles.inputDisabled]} value={formData.languages} placeholder="English, Spanish" onChangeText={(t) => handleInputChange('languages', t)} editable={!isLoading} />

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Label text="Clinic Name" />
                  <TextInput style={[styles.input, isLoading && styles.inputDisabled]} value={formData.clinicName} placeholder="Healthy Clinic" onChangeText={(t) => handleInputChange('clinicName', t)} editable={!isLoading} />
                </View>
                <View style={styles.halfInput}>
                  <Label text="Medical License #" />
                  <TextInput style={[styles.input, isLoading && styles.inputDisabled]} value={formData.medicalLicense} placeholder="MD-12345" onChangeText={(t) => handleInputChange('medicalLicense', t)} editable={!isLoading} />
                </View>
              </View>

              <Label text="Specialization" />
              <CustomDropdown label="Select Specialization" data={SPECIALTIES} selectedVal={formData.specialization} onSelect={(val) => handleInputChange('specialization', val)} disabled={isLoading} />

              <Label text="Treated Conditions" />
              <TextInput style={[styles.input, isLoading && styles.inputDisabled]} value={formData.conditions} placeholder="Heart Failure, Flu" onChangeText={(t) => handleInputChange('conditions', t)} editable={!isLoading} />

              {/* Professional Certificate Upload */}
              <Label text="Professional Certificate (PDF / Image)" />
              <TouchableOpacity onPress={pickDocument} style={[styles.documentPicker, isLoading && styles.documentPickerDisabled]} disabled={isLoading}>
                <Ionicons name="document-attach" size={20} color="#6B7280" />
                <Text numberOfLines={1} style={styles.documentName}>
                  {selectedDocument ? selectedDocument.name : "Upload certificate"}
                </Text>
                <View style={styles.documentBtn}><Text style={styles.documentBtnText}>Browse</Text></View>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={[
              styles.submitBtn,
              { backgroundColor: userType === 'patient' ? '#4CAF50' : '#1E3A8A' },
              (isLoading || (formData.confirmPassword.length > 0 && formData.password !== formData.confirmPassword)) && { opacity: 0.5 }
            ]}
            onPress={handleSignUp}
            disabled={isLoading || (formData.confirmPassword.length > 0 && formData.password !== formData.confirmPassword)}
          >
            <Text style={styles.submitBtnText}>{isLoading ? 'Signing up...' : `Sign Up as ${userType === 'patient' ? 'Patient' : 'Doctor'}`}</Text>
          </TouchableOpacity>
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
              formData.dob && !isNaN(new Date(formData.dob).getTime())
                ? new Date(formData.dob)
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
                handleInputChange('dob', formatted);
              }
            }}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#EFF6FF' },
  scrollContainer: { padding: 20 },
  headerBox: { alignItems: 'center', marginBottom: 20 },
  logoText: { fontSize: 20, color: '#1E3A8A', fontWeight: 'bold' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1E3A8A', marginTop: 5 },
  toggleContainer: { flexDirection: 'row', marginBottom: 20, backgroundColor: '#E5E7EB', borderRadius: 8, padding: 4 },
  toggleBtn: { flex: 1, padding: 10, alignItems: 'center', borderRadius: 6 },
  activeToggle: { backgroundColor: 'white', elevation: 2 },
  card: { backgroundColor: 'white', padding: 20, borderRadius: 15, elevation: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  halfInput: { width: '48%' },
  labelText: { fontSize: 13, color: '#374151', fontWeight: '600', marginBottom: 5, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, backgroundColor: '#fff' },
  inputDisabled: { backgroundColor: '#F3F4F6', color: '#9CA3AF' },
  inputError: { borderColor: '#EF4444', borderWidth: 1.5, backgroundColor: '#FEF2F2' },
  errorHint: { color: '#EF4444', fontSize: 11, fontWeight: '500', marginTop: 3 },

  /* ── Avatar ── */
  avatarContainer: {
    alignSelf: 'center',
    marginBottom: 4,
    marginTop: 4,
  },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarInitial: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#4B5563',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarHint: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 10,
  },

  /* ── Document Picker ── */
  documentPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#F9FAFB',
    gap: 8,
  },
  documentPickerDisabled: {
    opacity: 0.6,
    backgroundColor: '#E5E7EB',
  },
  documentName: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
  },
  documentBtn: {
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  documentBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  submitBtn: { padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 25 },
  submitBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

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
    color: '#1E3A8A',
    fontWeight: 'bold',
    fontSize: 16,
  }
});