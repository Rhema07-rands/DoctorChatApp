import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../../src/services/api';
import { signalRService } from '../../src/services/signalrService';

// ============================================================================
// TYPES
// ============================================================================

export interface IRegisteredDoctor {
    id: string;
    name: string;
    initials: string;
    specialty: string;
    gender: 'Male' | 'Female' | 'Other';
    rating: number;
    reviewCount: number;
    bio: string;
    education: string;
    experience: string;
    languages: string;
    clinicName: string;
    phone: string;
    email: string;
    profileColor: string;
    availability: 'Available' | 'Busy' | 'Offline';
    lastActive: string;
    verified: boolean;
    conditions: string[];
    workingHours: string;
    consultationType: string;
    profilePictureUrl?: string;
}

export interface IReview {
    id: string;
    doctorId: string;
    patientName: string;
    rating: number;
    comment: string;
    createdAt: string;
}

// ============================================================================
// CONTEXT TYPE
// ============================================================================

type DoctorDirectoryContextType = {
    doctors: IRegisteredDoctor[];
    reviews: IReview[];
    addReview: (review: Omit<IReview, 'id' | 'createdAt'>) => void;
    getDoctorById: (id: string) => IRegisteredDoctor | undefined;
    getReviewsForDoctor: (doctorId: string) => IReview[];
    searchDoctorsByCondition: (query: string) => IRegisteredDoctor[];
    activePatientChats: string[];
    addActivePatientChat: (doctorId: string) => void;
    refreshDoctors: () => Promise<void>;
};

// ============================================================================
// MOCK DATA — used as fallback when user is unauthenticated or server is down
// ============================================================================

const MOCK_DOCTORS: IRegisteredDoctor[] = [
    {
        id: 'd1',
        name: 'Dr. Sarah Johnson',
        initials: 'SJ',
        specialty: 'Cardiology',
        gender: 'Female',
        rating: 4.9,
        reviewCount: 127,
        bio: 'Board-certified cardiologist with over 12 years of experience in diagnosing and treating cardiovascular conditions. Passionate about preventive care and patient education.',
        education: 'MD from Harvard Medical School. Board Certified in Cardiology, Fellowship at Mayo Clinic.',
        experience: '12 years',
        languages: 'English, Spanish, French',
        clinicName: 'City General Hospital',
        phone: '+1 (555) 234-5678',
        email: 'dr.sarah.johnson@example.com',
        profileColor: '#3B82F6',
        availability: 'Available',
        lastActive: '2 min ago',
        verified: true,
        conditions: ['heart disease', 'chest pain', 'hypertension', 'high blood pressure', 'arrhythmia', 'palpitations', 'heart failure', 'coronary artery disease'],
        workingHours: '09:00 AM – 05:00 PM',
        consultationType: 'Video',
    },
    {
        id: 'd2',
        name: 'Dr. Michael Chen',
        initials: 'MC',
        specialty: 'Dermatology',
        gender: 'Male',
        rating: 4.8,
        reviewCount: 98,
        bio: 'Specialising in medical and cosmetic dermatology. Treats a wide range of skin, hair, and nail conditions using the latest evidence-based approaches.',
        education: 'MD from Stanford University School of Medicine. Dermatology residency at UCSF.',
        experience: '9 years',
        languages: 'English, Mandarin',
        clinicName: 'DermaCare Clinic',
        phone: '+1 (555) 345-6789',
        email: 'dr.michael.chen@example.com',
        profileColor: '#0EA5E9',
        availability: 'Available',
        lastActive: '5 min ago',
        verified: true,
        conditions: ['skin rash', 'acne', 'eczema', 'psoriasis', 'dermatitis', 'skin infection', 'moles', 'skin cancer screening', 'hair loss'],
        workingHours: '10:00 AM – 06:00 PM',
        consultationType: 'Video',
    },
    {
        id: 'd3',
        name: 'Dr. Emily Rodriguez',
        initials: 'ER',
        specialty: 'General Practice',
        gender: 'Female',
        rating: 4.7,
        reviewCount: 214,
        bio: 'Family medicine specialist providing comprehensive care for patients of all ages. Focused on whole-person health, chronic disease management, and wellness.',
        education: 'MD from Johns Hopkins Medical School. Board certified in Family Medicine.',
        experience: '15 years',
        languages: 'English, Spanish, Portuguese',
        clinicName: 'Sunrise Family Health',
        phone: '+1 (555) 456-7890',
        email: 'dr.emily.rodriguez@example.com',
        profileColor: '#8B5CF6',
        availability: 'Busy',
        lastActive: '15 min ago',
        verified: true,
        conditions: ['cold', 'flu', 'fever', 'cough', 'sore throat', 'headache', 'fatigue', 'general checkup', 'wellness', 'vaccination', 'allergies'],
        workingHours: '08:00 AM – 04:00 PM',
        consultationType: 'Chat',
    },
    {
        id: 'd4',
        name: 'Dr. James Wilson',
        initials: 'JW',
        specialty: 'Neurology',
        gender: 'Male',
        rating: 4.9,
        reviewCount: 76,
        bio: 'Expert neurologist focused on stroke prevention, epilepsy management, and neuro-degenerative disease care. Committed to improving quality of life for patients.',
        education: 'MD from Columbia University. Fellowship in Clinical Neurology at Mount Sinai.',
        experience: '18 years',
        languages: 'English, German',
        clinicName: 'NeuroHealth Centre',
        phone: '+1 (555) 567-8901',
        email: 'dr.james.wilson@example.com',
        profileColor: '#10B981',
        availability: 'Available',
        lastActive: '1 min ago',
        verified: true,
        conditions: ['migraine', 'headache', 'seizure', 'epilepsy', 'stroke', 'numbness', 'tingling', 'memory loss', 'dizziness', 'tremor', 'parkinson'],
        workingHours: '09:00 AM – 05:00 PM',
        consultationType: 'Video',
    },
    {
        id: 'd5',
        name: 'Dr. Olivia Martinez',
        initials: 'OM',
        specialty: 'Pediatrics',
        gender: 'Female',
        rating: 4.8,
        reviewCount: 189,
        bio: 'Caring pediatrician dedicated to child health and development. Experienced in newborn care, childhood illnesses, immunisations, and behavioral health.',
        education: 'MD from Yale School of Medicine. Pediatrics residency at Boston Children\'s Hospital.',
        experience: '10 years',
        languages: 'English, Spanish',
        clinicName: 'Little Stars Pediatrics',
        phone: '+1 (555) 678-9012',
        email: 'dr.olivia.martinez@example.com',
        profileColor: '#EC4899',
        availability: 'Available',
        lastActive: '8 min ago',
        verified: true,
        conditions: ['child fever', 'child cough', 'pediatric care', 'vaccination', 'growth delay', 'child nutrition', 'ear infection', 'asthma in children'],
        workingHours: '08:30 AM – 04:30 PM',
        consultationType: 'Video',
    },
    {
        id: 'd6',
        name: 'Dr. David Kim',
        initials: 'DK',
        specialty: 'Orthopedics',
        gender: 'Male',
        rating: 4.6,
        reviewCount: 63,
        bio: 'Orthopedic surgeon specialising in sports medicine, joint replacement, and minimally invasive procedures. Helps patients get back to an active lifestyle.',
        education: 'MD from University of Michigan. Orthopedic surgery residency at Hospital for Special Surgery.',
        experience: '14 years',
        languages: 'English, Korean',
        clinicName: 'ActiveLife Orthopedics',
        phone: '+1 (555) 789-0123',
        email: 'dr.david.kim@example.com',
        profileColor: '#F59E0B',
        availability: 'Busy',
        lastActive: '30 min ago',
        verified: true,
        conditions: ['back pain', 'knee pain', 'joint pain', 'fracture', 'sports injury', 'arthritis', 'shoulder pain', 'spine', 'bone'],
        workingHours: '09:00 AM – 06:00 PM',
        consultationType: 'Video',
    },
    {
        id: 'd7',
        name: 'Dr. Aisha Patel',
        initials: 'AP',
        specialty: 'Psychiatry',
        gender: 'Female',
        rating: 4.7,
        reviewCount: 105,
        bio: 'Compassionate psychiatrist experienced in mood disorders, anxiety, trauma therapy, and medication management. Believes in a holistic approach to mental health.',
        education: 'MD from University of Pennsylvania. Psychiatry residency at Massachusetts General Hospital.',
        experience: '11 years',
        languages: 'English, Hindi, Urdu',
        clinicName: 'MindWell Psychiatry',
        phone: '+1 (555) 890-1234',
        email: 'dr.aisha.patel@example.com',
        profileColor: '#6366F1',
        availability: 'Available',
        lastActive: '3 min ago',
        verified: true,
        conditions: ['anxiety', 'depression', 'stress', 'insomnia', 'panic attack', 'ptsd', 'trauma', 'bipolar', 'mental health', 'mood swings'],
        workingHours: '10:00 AM – 06:00 PM',
        consultationType: 'Video',
    },
    {
        id: 'd8',
        name: 'Dr. Robert Thompson',
        initials: 'RT',
        specialty: 'Gastroenterology',
        gender: 'Male',
        rating: 4.5,
        reviewCount: 54,
        bio: 'Gastroenterologist with expertise in digestive disorders, liver disease, and endoscopic procedures. Provides compassionate and thorough GI care.',
        education: 'MD from Duke University School of Medicine. GI Fellowship at Cleveland Clinic.',
        experience: '16 years',
        languages: 'English',
        clinicName: 'DigestiveHealth Associates',
        phone: '+1 (555) 901-2345',
        email: 'dr.robert.thompson@example.com',
        profileColor: '#EF4444',
        availability: 'Offline',
        lastActive: '2 hours ago',
        verified: false,
        conditions: ['stomach ache', 'acid reflux', 'bloating', 'constipation', 'diarrhea', 'ibs', 'crohn', 'liver', 'nausea', 'vomiting', 'ulcer'],
        workingHours: '09:00 AM – 05:00 PM',
        consultationType: 'Video',
    },
    {
        id: 'd9',
        name: 'Dr. Grace Nakamura',
        initials: 'GN',
        specialty: 'Ophthalmology',
        gender: 'Female',
        rating: 4.8,
        reviewCount: 82,
        bio: 'Fellowship-trained ophthalmologist specialising in cataract surgery, glaucoma, and retinal conditions. Uses cutting-edge imaging and surgical techniques.',
        education: 'MD from UCLA David Geffen School of Medicine. Ophthalmology residency at Bascom Palmer Eye Institute.',
        experience: '13 years',
        languages: 'English, Japanese',
        clinicName: 'ClearView Eye Center',
        phone: '+1 (555) 012-3456',
        email: 'dr.grace.nakamura@example.com',
        profileColor: '#14B8A6',
        availability: 'Available',
        lastActive: '10 min ago',
        verified: true,
        conditions: ['eye pain', 'blurry vision', 'vision loss', 'red eye', 'glaucoma', 'cataract', 'dry eyes', 'eye infection', 'floaters'],
        workingHours: '08:00 AM – 04:00 PM',
        consultationType: 'Video',
    },
    {
        id: 'd10',
        name: 'Dr. Samuel Okafor',
        initials: 'SO',
        specialty: 'Endocrinology',
        gender: 'Male',
        rating: 4.6,
        reviewCount: 47,
        bio: 'Endocrinologist focused on diabetes management, thyroid disorders, and hormonal imbalances. Passionate about helping patients achieve metabolic health.',
        education: 'MD from University of Lagos College of Medicine. Endocrinology fellowship at Johns Hopkins.',
        experience: '8 years',
        languages: 'English, Igbo, Yoruba',
        clinicName: 'MetaHealth Endocrine Clinic',
        phone: '+1 (555) 123-4567',
        email: 'dr.samuel.okafor@example.com',
        profileColor: '#D946EF',
        availability: 'Available',
        lastActive: '20 min ago',
        verified: true,
        conditions: ['diabetes', 'thyroid', 'hormonal imbalance', 'weight gain', 'weight loss', 'pcos', 'adrenal', 'insulin resistance', 'metabolism'],
        workingHours: '09:30 AM – 05:30 PM',
        consultationType: 'Video',
    },
];

const MOCK_REVIEWS: IReview[] = [
    { id: 'r1', doctorId: 'd1', patientName: 'Alice Smith', rating: 5, comment: 'Excellent cardiologist! Very thorough and caring.', createdAt: '2026-01-15T10:00:00Z' },
    { id: 'r2', doctorId: 'd1', patientName: 'Robert Johnson', rating: 5, comment: 'Saved my life with early detection. Highly recommend.', createdAt: '2026-01-10T14:30:00Z' },
    { id: 'r3', doctorId: 'd1', patientName: 'Emily Davis', rating: 4, comment: 'Great doctor, but wait times can be long.', createdAt: '2026-01-05T09:15:00Z' },
    { id: 'r4', doctorId: 'd2', patientName: 'John Doe', rating: 5, comment: 'My skin has never looked better. Amazing treatment plan.', createdAt: '2026-01-12T11:00:00Z' },
    { id: 'r5', doctorId: 'd2', patientName: 'Michael Brown', rating: 4, comment: 'Very knowledgeable. Explained everything clearly.', createdAt: '2026-01-08T16:45:00Z' },
    { id: 'r6', doctorId: 'd3', patientName: 'John Doe', rating: 5, comment: 'Best family doctor we have ever had. Listens carefully.', createdAt: '2026-01-14T13:00:00Z' },
    { id: 'r7', doctorId: 'd4', patientName: 'Alice Smith', rating: 5, comment: 'Brilliant neurologist. Very precise diagnosis.', createdAt: '2026-01-11T10:30:00Z' },
    { id: 'r8', doctorId: 'd5', patientName: 'Emily Davis', rating: 5, comment: 'My kids love her! So gentle and patient.', createdAt: '2026-01-13T15:00:00Z' },
    { id: 'r9', doctorId: 'd7', patientName: 'Robert Johnson', rating: 4, comment: 'Helped me through a very tough time. Grateful.', createdAt: '2026-01-09T12:00:00Z' },
    { id: 'r10', doctorId: 'd9', patientName: 'Michael Brown', rating: 5, comment: 'Fixed my vision problems quickly. State-of-the-art equipment.', createdAt: '2026-01-07T09:30:00Z' },
];

// ============================================================================
// CONTEXT & PROVIDER
// ============================================================================

const DoctorDirectoryContext = createContext<DoctorDirectoryContextType | undefined>(undefined);

export const DoctorDirectoryProvider = ({ children }: { children: React.ReactNode }) => {
    const [doctors, setDoctors] = useState<IRegisteredDoctor[]>(MOCK_DOCTORS);
    const [reviews, setReviews] = useState<IReview[]>(MOCK_REVIEWS);
    const [activePatientChats, setActivePatientChats] = useState<string[]>([]);

    const refreshDoctors = async () => {
        // FIX: Guard the API call behind an auth check.
        // This provider mounts at app startup — before login. Without this guard,
        // refreshDoctors() fires immediately with no JWT and the backend returns:
        //   • 401 Unauthorized  (no token → interceptor sends nothing)
        //   • 500 Internal Error (the Conditions.Contains EF Core crash on the query)
        // If the user isn't authenticated yet, we keep showing MOCK_DOCTORS silently
        // and rely on the dashboards calling refreshDoctors() after login succeeds.
        const authToken = await SecureStore.getItemAsync('userToken');
        if (!authToken) {
            console.log('DoctorDirectory: Not authenticated yet — using mock data until login.');
            return;
        }

        try {
            const response = await api.get('/doctors/search');
            if (Array.isArray(response.data)) {
                const mappedDoctors: IRegisteredDoctor[] = response.data.map((d: any) => ({
                    id: d.id,
                    name: `Dr. ${d.firstName} ${d.lastName}`,
                    initials: `${d.firstName[0]}${d.lastName[0]}`,
                    specialty: d.specialization,
                    gender: d.gender === 'Female' ? 'Female' : (d.gender === 'Male' ? 'Male' : 'Other'),
                    rating: d.rating || 0.0,
                    reviewCount: d.reviewCount || 0,
                    bio: d.bio,
                    education: d.education,
                    experience: d.experience,
                    languages: Array.isArray(d.languages) ? d.languages.join(', ') : d.languages,
                    clinicName: d.clinicName,
                    phone: d.phone,
                    email: d.email,
                    profileColor: d.profileColor || '#3B82F6',
                    availability: d.availability || 'Available',
                    lastActive: d.lastActive || new Date().toISOString(),
                    verified: d.verified || false,
                    conditions: d.conditions || [],
                    workingHours: '09:00 AM - 05:00 PM',
                    consultationType: d.consultationType || 'Video',
                    profilePictureUrl: d.profilePictureUrl,
                }));
                setDoctors(mappedDoctors);
            }
        } catch (error) {
            console.log('Failed to load doctor directory', error);
            // Keep current doctors (mock or previously loaded) — don't wipe state on error
        }
    };

    useEffect(() => {
        // FIX: Don't call refreshDoctors() unconditionally at mount.
        // It will be a no-op if the user isn't logged in (auth guard inside),
        // and the patient dashboard calls refreshDoctors() via useFocusEffect
        // after navigation, at which point the token is already in SecureStore.
        refreshDoctors();

        const unsubscribe = signalRService.onAvailabilityChanged((data: any) => {
            setDoctors(prev => prev.map(doc => {
                if (doc.id === data.doctorId || doc.id === data.DoctorId) {
                    const st = data.startTime || data.StartTime;
                    const et = data.endTime || data.EndTime;
                    return {
                        ...doc,
                        availability: data.availability || data.Availability,
                        lastActive: data.lastActive || data.LastActive || 'Just now',
                        workingHours: st && et ? `${st} to ${et}` : doc.workingHours,
                        consultationType: data.consultationType || data.ConsultationType || doc.consultationType,
                    };
                }
                return doc;
            }));
        });

        // Auto-add doctor to patient's chat list when appointment is confirmed
        const unsubApptUpdate = signalRService.on('AppointmentUpdated', (appt: any) => {
            const status = appt.status || appt.Status;
            const doctorId = appt.doctorId || appt.DoctorId;
            if (status === 'Confirmed' && doctorId) {
                setActivePatientChats(prev => {
                    if (prev.includes(doctorId)) return prev;
                    return [doctorId, ...prev];
                });
            }
        });

        return () => {
            unsubscribe();
            unsubApptUpdate();
        };
    }, []);

    const addReview = async (review: Omit<IReview, 'id' | 'createdAt'>) => {
        try {
            const response = await api.post('/reviews', {
                doctorId: review.doctorId,
                rating: review.rating,
                comment: review.comment,
            });
            const newReview: IReview = {
                ...review,
                id: response.data?.id || `r${Date.now()}`,
                createdAt: response.data?.dateSubmitted || new Date().toISOString(),
            };
            setReviews(prev => [newReview, ...prev]);
        } catch (error) {
            console.error('Could not add review', error);
        }
    };

    const getDoctorById = (id: string) => doctors.find(d => d.id === id);

    const getReviewsForDoctor = (doctorId: string) =>
        reviews
            .filter(r => r.doctorId === doctorId)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const searchDoctorsByCondition = (query: string) => {
        const lower = query.toLowerCase().trim();
        if (!lower) return [];
        const words = lower.split(/\s+/);
        return doctors.filter(d =>
            words.some(word =>
                d.conditions.some(c => c.toLowerCase().includes(word)) ||
                d.specialty.toLowerCase().includes(word) ||
                d.name.toLowerCase().includes(word),
            ),
        );
    };

    const addActivePatientChat = (doctorId: string) => {
        setActivePatientChats(prev => {
            if (prev.includes(doctorId)) return prev;
            return [doctorId, ...prev];
        });
    };

    return (
        <DoctorDirectoryContext.Provider
            value={{
                doctors,
                reviews,
                addReview,
                getDoctorById,
                getReviewsForDoctor,
                searchDoctorsByCondition,
                activePatientChats,
                addActivePatientChat,
                refreshDoctors,
            }}
        >
            {children}
        </DoctorDirectoryContext.Provider>
    );
};

export const useDoctorDirectory = () => {
    const context = useContext(DoctorDirectoryContext);
    if (!context) {
        throw new Error('useDoctorDirectory must be used within a DoctorDirectoryProvider');
    }
    return context;
};