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
    isLoading: boolean;
};



// ============================================================================
// CONTEXT & PROVIDER
// ============================================================================

const DoctorDirectoryContext = createContext<DoctorDirectoryContextType | undefined>(undefined);

export const DoctorDirectoryProvider = ({ children }: { children: React.ReactNode }) => {
    const [doctors, setDoctors] = useState<IRegisteredDoctor[]>([]);
    const [reviews, setReviews] = useState<IReview[]>([]);
    const [activePatientChats, setActivePatientChats] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const refreshDoctors = async () => {
        // FIX: Guard the API call behind an auth check.
        // This provider mounts at app startup — before login. Without this guard,
        // refreshDoctors() fires immediately with no JWT and the backend returns:
        //   • 401 Unauthorized  (no token → interceptor sends nothing)
        //   • 500 Internal Error (the Conditions.Contains EF Core crash on the query)
        // If the user isn't authenticated yet, skip the API call.
        // The dashboards will call refreshDoctors() after login succeeds.
        const authToken = await SecureStore.getItemAsync('userToken');
        if (!authToken) {
            console.log('DoctorDirectory: Not authenticated yet — waiting for login.');
            return;
        }

        setIsLoading(true);
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
            // Keep current doctors (previously loaded) — don't wipe state on error
        } finally {
            setIsLoading(false);
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
                isLoading,
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