import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
import { useUser } from '../_context/UserContext';

export default function FeesPracticeScreen() {
    const router = useRouter();
    const {
        videoFee, setVideoFee,
        chatFee, setChatFee,
        clinicName, setClinicName,
        address, setAddress
    } = useUser();

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Fees & Practice</Text>
                <TouchableOpacity onPress={() => router.back()}>
                    <Text style={styles.saveText}>Save</Text>
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <View style={styles.formSection}>
                    <Text style={styles.sectionTitle}>Consultation Fees</Text>
                    <View style={styles.rowGap}>
                        <View style={styles.flex1}>
                            <Text style={styles.label}>Video Consultation (₦)</Text>
                            <TextInput
                                style={styles.input}
                                value={videoFee}
                                onChangeText={setVideoFee}
                                keyboardType="numeric"
                            />
                        </View>
                        <View style={styles.flex1}>
                            <Text style={styles.label}>Chat Consultation (₦)</Text>
                            <TextInput
                                style={styles.input}
                                value={chatFee}
                                onChangeText={setChatFee}
                                keyboardType="numeric"
                            />
                        </View>
                    </View>

                    <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Practice Location</Text>
                    <Text style={styles.label}>Clinic/Hospital Name</Text>
                    <TextInput
                        style={styles.input}
                        value={clinicName}
                        onChangeText={setClinicName}
                        placeholder="e.g. City General Hospital"
                    />

                    <Text style={styles.label}>Practice Address</Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        value={address}
                        onChangeText={setAddress}
                        multiline
                        placeholder="Full street address, City, ZIP"
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
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', marginBottom: 8 },
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
