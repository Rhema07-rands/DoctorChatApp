import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../../src/services/api';
import { authEvents } from '../../src/services/authEvents';
import { signalRService } from '../../src/services/signalrService';
import { useAuthStore } from '../../src/stores/authStore';

export type IPrescription = {
    id: string;
    drugOrActivity: string;
    alarmTime: string;
    intervalType: 'everyday' | 'specific';
    specificDays: string[];
    doctorName: string;
    doctorId: string;
    condition: string;
    createdAt: string;
};

type UserContextType = {
    // Role
    userRole: 'doctor' | 'patient';
    setUserRole: (role: 'doctor' | 'patient') => void;
    patientName: string; setPatientName: (v: string) => void;
    patientAge: string; setPatientAge: (v: string) => void;
    patientId: string; setPatientId: (v: string) => void;
    patientDob: string; setPatientDob: (v: string) => void;
    patientGender: string; setPatientGender: (v: string) => void;
    patientAddress: string; setPatientAddress: (v: string) => void;
    patientBloodGroup: string; setPatientBloodGroup: (v: string) => void;
    patientGenotype: string; setPatientGenotype: (v: string) => void;
    patientAllergies: string; setPatientAllergies: (v: string) => void;

    // Availability
    status: 'Available' | 'Busy';
    setStatus: (status: 'Available' | 'Busy') => void;
    consultationType: string;
    setConsultationType: (type: string) => void;
    startTime: string;
    setStartTime: (time: string) => void;
    endTime: string;
    setEndTime: (time: string) => void;

    // Professional Info
    firstName: string; setFirstName: (v: string) => void;
    lastName: string; setLastName: (v: string) => void;
    email: string; setEmail: (v: string) => void;
    phone: string; setPhone: (v: string) => void;
    specialization: string; setSpecialization: (v: string) => void;
    license: string; setLicense: (v: string) => void;
    experience: string; setExperience: (v: string) => void;
    languages: string; setLanguages: (v: string) => void;
    education: string; setEducation: (v: string) => void;
    bio: string; setBio: (v: string) => void;
    conditions: string[]; setConditions: (v: string[]) => void;
    profileColor: string; setProfileColor: (v: string) => void;
    profilePictureUrl: string | null; setProfilePictureUrl: (v: string | null) => void;

    // Fees & Practice
    videoFee: string; setVideoFee: (v: string) => void;
    chatFee: string; setChatFee: (v: string) => void;
    clinicName: string; setClinicName: (v: string) => void;
    address: string; setAddress: (v: string) => void;

    // Privacy
    password: string; setPassword: (v: string) => void;

    // Prescriptions
    prescriptions: IPrescription[]; setPrescriptions: React.Dispatch<React.SetStateAction<IPrescription[]>>;
    unreadCount: number;
    refreshUnreadCount: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    logout: () => Promise<void>;
    activeChatId: string | null;
    setActiveChatId: (id: string | null) => void;
};


const UserContext = createContext<UserContextType | undefined>(undefined);

function calculateAge(dob: string | Date): string {
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) return '';
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age.toString();
}

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
    const router = useRouter();
    // Role
    const [userRole, setUserRole] = useState<'doctor' | 'patient'>('patient');

    // Patient Data
    const [patientName, setPatientName] = useState('');
    const [patientAge, setPatientAge] = useState('');
    const [patientId, setPatientId] = useState('');
    const [patientDob, setPatientDob] = useState('');
    const [patientGender, setPatientGender] = useState('');
    const [patientAddress, setPatientAddress] = useState('');
    const [patientBloodGroup, setPatientBloodGroup] = useState('');
    const [patientGenotype, setPatientGenotype] = useState('');
    const [patientAllergies, setPatientAllergies] = useState('');

    // Availability
    const [status, setStatus] = useState<'Available' | 'Busy'>('Available');
    const [consultationType, setConsultationType] = useState('Video');
    const [startTime, setStartTime] = useState('09:00 AM');
    const [endTime, setEndTime] = useState('05:00 PM');

    // Professional Info (Doctor)
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [specialization, setSpecialization] = useState('General');
    const [license, setLicense] = useState('');
    const [experience, setExperience] = useState('');
    const [languages, setLanguages] = useState('');
    const [education, setEducation] = useState('');
    const [bio, setBio] = useState('');
    const [conditions, setConditions] = useState<string[]>([]);
    const [profileColor, setProfileColor] = useState('#3B82F6');
    const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);

    // Fees & Practice
    const [videoFee, setVideoFee] = useState('');
    const [chatFee, setChatFee] = useState('');
    const [clinicName, setClinicName] = useState('');
    const [address, setAddress] = useState('');

    // Privacy
    const [password, setPassword] = useState('');

    // Prescriptions
    const [prescriptions, setPrescriptions] = useState<IPrescription[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [activeChatId, setActiveChatId] = useState<string | null>(null);

    const refreshUnreadCount = async () => {
        try {
            const response = await api.get('messages/unread/count');
            setUnreadCount(response.data.count || response.data.Count || 0);
        } catch (error) {
            console.error('Error refreshing unread count:', error);
        }
    };

    // ── FETCH CURRENT USER PROFILE ON LOAD ──────────────────────
    const refreshProfile = async () => {
        try {
            const token = await SecureStore.getItemAsync('userToken');
            const profileStr = await SecureStore.getItemAsync('userProfile');

            if (!token || !profileStr) return;

            // Start real-time connections once token is available
            await signalRService.startConnections();

            const user = JSON.parse(profileStr);

            // Populate shared properties
            setFirstName(user.firstName || user.FirstName || '');
            setLastName(user.lastName || user.LastName || '');
            setEmail(user.email || user.Email || '');
            setPatientName((user.firstName || user.FirstName || '') + ' ' + (user.lastName || user.LastName || ''));
            setPatientId(user.id || user.Id || ''); // Shared User ID field
            setUserRole(user.role?.toLowerCase() === 'doctor' ? 'doctor' : 'patient');

            if (user.role?.toLowerCase() === 'doctor') {
                setSpecialization(user.specialization || '');
                setBio(user.bio || '');
                setEducation(user.education || '');
                setExperience(user.experience || '');
                setLicense(user.medicalLicense || '');
                setClinicName(user.clinicName || '');
                setPhone(user.phone || user.phoneNumber || '');
                setLanguages(Array.isArray(user.languages) ? user.languages.join(', ') : (user.languages || ''));
                setConditions(Array.isArray(user.conditions) ? user.conditions : []);
                setProfileColor(user.profileColor || '#3B82F6');
                setProfilePictureUrl(user.profilePictureUrl || null);
            } else if (user.role?.toLowerCase() === 'patient') {
                setPatientBloodGroup(user.bloodGroup || '');
                setPatientGenotype(user.genotype || '');
                setPatientGender(user.gender || '');
                setPatientAddress(user.phoneNumber || ''); // Assuming mapped inside address
                if (user.dateOfBirth) {
                    const d = new Date(user.dateOfBirth);
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const dd = String(d.getDate()).padStart(2, '0');
                    const yyyy = d.getFullYear();
                    setPatientDob(`${mm}/${dd}/${yyyy}`);
                    setPatientAge(calculateAge(user.dateOfBirth));
                } else {
                    setPatientDob('');
                    setPatientAge('');
                }
                setPatientAllergies(user.allergies || '');
                setPhone(user.phoneNumber || user.phone || '');
                setProfilePictureUrl(user.profilePictureUrl || null);
            }

            // Also refresh unread count on profile load
            await refreshUnreadCount();

        } catch (e) {
            console.log("No active session found.");
        }
    };

    useEffect(() => {
        refreshProfile();

        // Subscribe to global unauthorized events (e.g. from api.ts or signalrService.ts)
        const unsubscribe = authEvents.onUnauthorized(() => {
            console.log('UserProvider: Received unauthorized event, logging out...');
            logout();
        });

        return () => unsubscribe();
    }, []);

    const logout = async () => {
        try {
            // Stop SignalR
            await signalRService.stopConnections();

            // Clear Storage
            await SecureStore.deleteItemAsync('userToken');
            await SecureStore.deleteItemAsync('userProfile');

            // Reset Shared State
            setFirstName('');
            setLastName('');
            setEmail('');
            setPhone('');
            setProfilePictureUrl(null);
            setProfileColor('#3B82F6');

            // Reset Patient State
            setPatientName('');
            setPatientId('');
            setPatientAge('');
            setPatientDob('');
            setPatientGender('');
            setPatientAddress('');
            setPatientBloodGroup('');
            setPatientGenotype('');
            setPatientAllergies('');

            // Reset Doctor State
            setSpecialization('General');
            setBio('');
            setEducation('');
            setExperience('');
            setLicense('');
            setClinicName('');
            setConditions([]);

            console.log('User logged out and state cleared.');

            // Clear Zustand auth state
            useAuthStore.getState().signOut();

            // Redirect to landing screen
            router.replace('/');
        } catch (e) {
            console.error('Error during logout:', e);
        }
    };

    return (
        <UserContext.Provider value={{
            userRole, setUserRole,
            patientName, setPatientName,
            patientAge, setPatientAge,
            patientId, setPatientId,
            patientDob, setPatientDob,
            patientGender, setPatientGender,
            patientAddress, setPatientAddress,
            patientBloodGroup, setPatientBloodGroup,
            patientGenotype, setPatientGenotype,
            patientAllergies, setPatientAllergies,
            status, setStatus,
            consultationType, setConsultationType,
            startTime, setStartTime,
            endTime, setEndTime,
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
            conditions, setConditions,
            profileColor, setProfileColor,
            profilePictureUrl, setProfilePictureUrl,
            videoFee, setVideoFee,
            chatFee, setChatFee,
            clinicName, setClinicName,
            address, setAddress,
            password, setPassword,
            prescriptions, setPrescriptions,
            unreadCount, refreshUnreadCount,
            refreshProfile,
            logout,
            activeChatId, setActiveChatId
        }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};
