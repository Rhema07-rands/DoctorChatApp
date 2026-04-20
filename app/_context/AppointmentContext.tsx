import React, { createContext, useContext, useState } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export type AppointmentStatus = 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled' | 'Active';
export type ConsultationType = 'Video' | 'Audio' | 'Chat';

export interface Patient {
    id: string;
    name: string;
    age: number;
    gender: 'Male' | 'Female' | 'Other';
    phone: string;
    email: string;
    bloodType?: string;
    allergies?: string[];
    medications?: string[];
    medicalHistory?: string;
    lastVisit?: string;
    totalConsultations: number;
    initials: string;
    avatarColor: string;
    profilePictureUrl?: string;
}

export interface Appointment {
    id: string;
    patientId: string;
    patientName: string;
    doctorId?: string; // Target doctor ID
    doctorName?: string; // Target doctor Name
    dateTime: string; // Raw ISO string for safe date math
    date: string;     // Display-only (YYYY-MM-DD)
    time: string;     // Display-only (e.g. "10:00 AM")
    patientProfilePictureUrl?: string; // Add Patient Profile Picture
    type: ConsultationType;
    reason: string;
    status: AppointmentStatus;
    notes?: string;
    diagnosis?: string;
    prescription?: string;
    duration?: number; // in minutes
}

export interface Consultation {
    id: string;
    appointmentId?: string;
    patientId: string;
    patientName: string;
    type: ConsultationType;
    reason?: string;
    startTime: string;
    endTime?: string;
    duration?: number; // in minutes
    notes?: string;
    diagnosis?: string;
    prescription?: string;
    attachments?: string[];
    isActive: boolean;
}

// ============================================================================
// CONTEXT TYPE
// ============================================================================

type AppointmentContextType = {
    // Data
    appointments: Appointment[];
    patients: Patient[];

    // Appointment Actions
    updateAppointmentStatus: (id: string, status: AppointmentStatus) => void;
    addAppointmentNotes: (id: string, notes: string) => void;
    addAppointmentLocal: (appointment: Appointment) => void;
    getAppointmentById: (id: string) => Appointment | undefined;
    getUpcomingAppointments: () => Appointment[];
    getPastAppointments: () => Appointment[];

    // Consultation Actions
    startConsultation: (appointmentId: string) => void;
    completeConsultation: (id: string, notes?: string, diagnosis?: string, prescription?: string) => void;
    updateConsultationNotes: (id: string, notes: string) => void;
    getActiveConsultations: () => Consultation[];
    getConsultationHistory: () => Consultation[];

    // Patient Actions
    getPatientById: (id: string) => Patient | undefined;
    getPatientConsultations: (patientId: string) => Consultation[];
    searchPatients: (query: string) => Patient[];
    refreshAppointments: () => Promise<void>;
    rescheduleAppointment: (id: string, newDateTime: string) => Promise<boolean>;
};

// ============================================================================
// MOCK DATA
// ============================================================================

const MOCK_PATIENTS: Patient[] = [
    {
        id: 'p1',
        name: 'John Doe',
        age: 45,
        gender: 'Male',
        phone: '+1234567890',
        email: 'john.doe@email.com',
        bloodType: 'O+',
        allergies: ['Penicillin'],
        medications: ['Aspirin 100mg'],
        medicalHistory: 'Hypertension, Type 2 Diabetes',
        lastVisit: '2026-01-10',
        totalConsultations: 8,
        initials: 'JD',
        avatarColor: '#3B82F6'
    },
    {
        id: 'p2',
        name: 'Alice Smith',
        age: 32,
        gender: 'Female',
        phone: '+1234567891',
        email: 'alice.smith@email.com',
        bloodType: 'A+',
        allergies: [],
        medications: [],
        medicalHistory: 'No significant history',
        lastVisit: '2026-01-12',
        totalConsultations: 3,
        initials: 'AS',
        avatarColor: '#10B981'
    },
    {
        id: 'p3',
        name: 'Robert Johnson',
        age: 58,
        gender: 'Male',
        phone: '+1234567892',
        email: 'robert.j@email.com',
        bloodType: 'B+',
        allergies: ['Sulfa drugs'],
        medications: ['Metformin 500mg', 'Lisinopril 10mg'],
        medicalHistory: 'Diabetes, High blood pressure',
        lastVisit: '2026-01-08',
        totalConsultations: 15,
        initials: 'RJ',
        avatarColor: '#F59E0B'
    },
    {
        id: 'p4',
        name: 'Emily Davis',
        age: 28,
        gender: 'Female',
        phone: '+1234567893',
        email: 'emily.d@email.com',
        bloodType: 'AB+',
        allergies: [],
        medications: [],
        lastVisit: '2026-01-11',
        totalConsultations: 2,
        initials: 'ED',
        avatarColor: '#8B5CF6'
    },
    {
        id: 'p5',
        name: 'Michael Brown',
        age: 41,
        gender: 'Male',
        phone: '+1234567894',
        email: 'michael.b@email.com',
        bloodType: 'O-',
        allergies: ['Latex'],
        medications: ['Atorvastatin 20mg'],
        medicalHistory: 'High cholesterol',
        lastVisit: '2026-01-09',
        totalConsultations: 6,
        initials: 'MB',
        avatarColor: '#EF4444'
    }
];

const MOCK_APPOINTMENTS: Appointment[] = [
    {
        id: 'a1', patientId: 'p1', patientName: 'John Doe', doctorId: 'd1', doctorName: 'Dr. Sarah Johnson',
        dateTime: '2026-03-13T10:00:00', date: '2026-03-13', time: '10:00 AM',
        type: 'Video', reason: 'Chest pain consultation', status: 'Confirmed', duration: 30
    },
    {
        id: 'a2', patientId: 'p2', patientName: 'Alice Smith', doctorId: 'd2', doctorName: 'Dr. Michael Chen',
        dateTime: '2026-03-15T14:30:00', date: '2026-03-15', time: '2:30 PM',
        type: 'Chat', reason: 'Routine checkup', status: 'Pending', duration: 20
    },
    {
        id: 'a3', patientId: 'p3', patientName: 'Robert Johnson', doctorId: 'd3', doctorName: 'Dr. Emily Rodriguez',
        dateTime: '2026-03-14T09:00:00', date: '2026-03-14', time: '9:00 AM',
        type: 'Audio', reason: 'Follow-up on diabetes management', status: 'Confirmed', duration: 30
    },
    {
        id: 'a4', patientId: 'p4', patientName: 'Emily Davis', doctorId: 'd4', doctorName: 'Dr. James Wilson',
        dateTime: '2026-03-14T11:30:00', date: '2026-03-14', time: '11:30 AM',
        type: 'Video', reason: 'Skin rash examination', status: 'Pending', duration: 20
    },
    {
        id: 'a5', patientId: 'p5', patientName: 'Michael Brown', doctorId: 'd5', doctorName: 'Dr. Olivia Martinez',
        dateTime: '2026-01-12T15:00:00', date: '2026-01-12', time: '3:00 PM',
        type: 'Video', reason: 'Cholesterol review', status: 'Completed', duration: 25
    },
    {
        id: 'a6', patientId: 'p1', patientName: 'John Doe', doctorId: 'd6', doctorName: 'Dr. David Kim',
        dateTime: '2026-01-11T10:00:00', date: '2026-01-11', time: '10:00 AM',
        type: 'Chat', reason: 'Medication refill', status: 'Completed', duration: 15
    },
    {
        id: 'a7', patientId: 'p2', patientName: 'Alice Smith', doctorId: 'd7', doctorName: 'Dr. Aisha Patel',
        dateTime: '2026-01-10T14:00:00', date: '2026-01-10', time: '2:00 PM',
        type: 'Video', reason: 'Initial consultation', status: 'Cancelled', duration: 30
    }
];

const MOCK_CONSULTATIONS: Consultation[] = [
    {
        id: 'c1',
        appointmentId: 'a5',
        patientId: 'p5',
        patientName: 'Michael Brown',
        type: 'Video',
        startTime: '2026-01-12T15:00:00',
        endTime: '2026-01-12T15:25:00',
        duration: 25,
        notes: 'Patient reports improved cholesterol levels. Continue current medication.',
        diagnosis: 'Hyperlipidemia - improving',
        prescription: 'Continue Atorvastatin 20mg daily',
        isActive: false
    },
    {
        id: 'c2',
        appointmentId: 'a6',
        patientId: 'p1',
        patientName: 'John Doe',
        type: 'Chat',
        startTime: '2026-01-11T10:00:00',
        endTime: '2026-01-11T10:15:00',
        duration: 15,
        notes: 'Medication refill approved. Patient stable.',
        diagnosis: 'Hypertension - stable',
        prescription: 'Aspirin 100mg - 30 day supply',
        isActive: false
    },
    {
        id: 'c3',
        patientId: 'p2',
        patientName: 'Alice Smith',
        type: 'Video',
        startTime: '2026-01-10T14:00:00',
        endTime: '2026-01-10T14:30:00',
        duration: 30,
        notes: 'Initial video call. Patient discussed fatigue.',
        diagnosis: 'General malaise',
        isActive: false
    },
    {
        id: 'c4',
        patientId: 'p3',
        patientName: 'Robert Johnson',
        type: 'Audio',
        startTime: '2026-01-09T11:00:00',
        endTime: '2026-01-09T11:20:00',
        duration: 20,
        notes: 'Audio consultation for sugar levels.',
        isActive: false
    },
    {
        id: 'c5',
        patientId: 'p4',
        patientName: 'Emily Davis',
        type: 'Video',
        startTime: '2026-01-08T16:30:00',
        duration: 15,
        isActive: false
    }
];

// ============================================================================
// CONTEXT & PROVIDER
// ============================================================================

import { useEffect } from 'react';
import { api } from '../../src/services/api';
import { signalRService } from '../../src/services/signalrService';
import { useUser } from './UserContext';

const AppointmentContext = createContext<AppointmentContextType | undefined>(undefined);

export const AppointmentProvider = ({ children }: { children: React.ReactNode }) => {
    // Inject our new Auth context so we know whether we are a doctor or a patient!
    const { userRole, patientId, firstName, lastName } = useUser();

    // Default to empty; if backend fails we catch and restore mock
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [patients] = useState<Patient[]>(MOCK_PATIENTS);

    // Function to manually re-fetch data
    const refreshAppointments = async () => {
        if (!patientId && userRole === 'patient') return;

        try {
            let appointmentData: any[] = [];
            const endpoint = `/appointments`;
            const response = await api.get(endpoint);

            if (Array.isArray(response.data)) {
                appointmentData = response.data.map(a => {
                    const dt = a.dateTime || new Date().toISOString();
                    const dateObj = new Date(dt);
                    const yyyy = dateObj.getFullYear();
                    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                    const dd = String(dateObj.getDate()).padStart(2, '0');
                    let hh = dateObj.getHours();
                    const min = String(dateObj.getMinutes()).padStart(2, '0');
                    const ampm = hh >= 12 ? 'PM' : 'AM';
                    hh = hh % 12 || 12;
                    return {
                        id: a.id,
                        patientId: a.patientId,
                        patientName: a.patient?.firstName ? `${a.patient.firstName} ${a.patient.lastName}` : 'Patient',
                        doctorId: a.doctorId,
                        doctorName: a.doctor?.firstName ? `Dr. ${a.doctor.firstName} ${a.doctor.lastName}` : 'Doctor',
                        dateTime: dt,
                        date: `${yyyy}-${mm}-${dd}`,
                        time: `${hh}:${min} ${ampm}`,
                        patientProfilePictureUrl: a.patient?.profilePictureUrl,
                        type: a.type || 'Video',
                        reason: a.reason,
                        status: a.status || 'Pending',
                        notes: a.clinicalNotes,
                        duration: a.duration || 30
                    };
                });
                setAppointments(appointmentData);
            }
        } catch (error) {
            console.log("Could not fetch live appointments, reverting to mock DB for demonstration.", error);
            setAppointments(MOCK_APPOINTMENTS); // Revert to mock for robust UI demo
        }
    };

    // Initial Load
    useEffect(() => {
        if (userRole && (patientId || firstName)) {
            refreshAppointments();
        }

        const mapAppt = (a: any) => {
            const dt = a.dateTime || new Date().toISOString();
            const dateObj = new Date(dt);
            const yyyy = dateObj.getFullYear();
            const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
            const dd = String(dateObj.getDate()).padStart(2, '0');
            let hh = dateObj.getHours();
            const min = String(dateObj.getMinutes()).padStart(2, '0');
            const ampm = hh >= 12 ? 'PM' : 'AM';
            hh = hh % 12 || 12;
            return {
                id: a.id,
                patientId: a.patientId,
                patientName: a.patient?.firstName ? `${a.patient.firstName} ${a.patient.lastName}` : 'Patient',
                doctorId: a.doctorId,
                doctorName: a.doctor?.firstName ? `Dr. ${a.doctor.firstName} ${a.doctor.lastName}` : 'Doctor',
                dateTime: dt,
                date: `${yyyy}-${mm}-${dd}`,
                time: `${hh}:${min} ${ampm}`,
                patientProfilePictureUrl: a.patient?.profilePictureUrl,
                type: a.type || 'Video',
                reason: a.reason,
                status: a.status || 'Pending',
                notes: a.clinicalNotes,
                diagnosis: a.diagnosis,
                prescription: a.prescriptionDetails,
                duration: a.duration || 30
            };
        };

        const unsubNew = signalRService.on('NewAppointment', (appt: any) => {
            setAppointments(prev => {
                if (prev.some(a => a.id === appt.id)) return prev;
                return [...prev, mapAppt(appt)];
            });
        });

        const unsubUpdate = signalRService.on('AppointmentUpdated', (appt: any) => {
            setAppointments(prev => prev.map(a => a.id === appt.id ? mapAppt(appt) : a));
        });

        return () => {
            unsubNew();
            unsubUpdate();
        };
    }, [userRole, patientId, firstName]);

    // Appointment Actions
    const updateAppointmentStatus = async (id: string, status: AppointmentStatus) => {
        try {
            await api.put(`/appointments/${id}/status`, { status });
            setAppointments(prev =>
                prev.map(appt => appt.id === id ? { ...appt, status } : appt)
            );
        } catch (error) {
            console.error("Failed to update status on server.", error);
            // Optimistic update fallback:
            setAppointments(prev =>
                prev.map(appt => appt.id === id ? { ...appt, status } : appt)
            );
        }
    };

    const rescheduleAppointment = async (id: string, newDateTime: string) => {
        try {
            const response = await api.put(`/appointments/${id}/reschedule`, { newDateTime });
            const updatedAppt = response.data;
            const dt = updatedAppt.dateTime || newDateTime;
            const dateObj = new Date(dt);
            const yyyy = dateObj.getFullYear();
            const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
            const dd = String(dateObj.getDate()).padStart(2, '0');
            let hh = dateObj.getHours();
            const min = String(dateObj.getMinutes()).padStart(2, '0');
            const ampm = hh >= 12 ? 'PM' : 'AM';
            hh = hh % 12 || 12;

            setAppointments(prev =>
                prev.map(appt => appt.id === id ? {
                    ...appt,
                    dateTime: dt,
                    date: `${yyyy}-${mm}-${dd}`,
                    time: `${hh}:${min} ${ampm}`,
                    status: updatedAppt.status
                } : appt)
            );
            return true;
        } catch (error) {
            console.error("Failed to reschedule appointment", error);
            return false;
        }
    };

    const addAppointmentNotes = (id: string, notes: string) => {
        setAppointments(prev =>
            prev.map(appt => appt.id === id ? { ...appt, notes } : appt)
        );
    };

    const addAppointmentLocal = (appointment: Appointment) => {
        setAppointments(prev => [...prev, appointment]);
    };

    const getAppointmentById = (id: string) => {
        return appointments.find(appt => appt.id === id);
    };

    const getUpcomingAppointments = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return appointments.filter(appt => {
            const apptDate = new Date(appt.dateTime);
            return apptDate >= today && (appt.status === 'Confirmed' || appt.status === 'Pending');
        }).sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
    };

    const getPastAppointments = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return appointments.filter(appt => {
            const apptDate = new Date(appt.dateTime);
            return apptDate < today || appt.status === 'Completed';
        }).sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
    };

    // Consultation Actions
    const startConsultation = (appointmentId: string) => {
        updateAppointmentStatus(appointmentId, 'Active' as AppointmentStatus);
    };

    const completeConsultation = async (id: string, notes?: string, diagnosis?: string, prescription?: string) => {
        // Here `id` refers to the consultation ID, which is the appointment ID in our new mapped logic
        try {
            await api.put(`/appointments/${id}/consultation`, {
                notes: notes,
                diagnosis: diagnosis,
                prescription: prescription,
            });
            // Also officially mark as Completed so it moves to History
            await api.put(`/appointments/${id}/status`, { status: 'Completed' });

            setAppointments(prev =>
                prev.map(appt => {
                    if (appt.id === id) {
                        return {
                            ...appt,
                            status: 'Completed',
                            notes: notes || appt.notes,
                            diagnosis: diagnosis || appt.diagnosis,
                            prescription: prescription || appt.prescription
                        };
                    }
                    return appt;
                })
            );
        } catch (error) {
            console.error("Failed to complete consultation on server", error);
            // Optimistic update
            setAppointments(prev =>
                prev.map(appt => {
                    if (appt.id === id) {
                        return {
                            ...appt,
                            status: 'Completed',
                            notes: notes || appt.notes,
                            diagnosis: diagnosis || appt.diagnosis,
                            prescription: prescription || appt.prescription
                        };
                    }
                    return appt;
                })
            );
        }
    };

    const updateConsultationNotes = (id: string, notes: string) => {
        // Optimistically update notes locally without closing consultation
        setAppointments(prev =>
            prev.map(appt => appt.id === id ? { ...appt, notes } : appt)
        );
    };

    const mapAppointmentToConsultation = (appt: Appointment): Consultation => {
        return {
            id: appt.id,
            appointmentId: appt.id,
            patientId: appt.patientId,
            patientName: appt.patientName,
            type: appt.type,
            reason: appt.reason,
            startTime: appt.dateTime, // Already a safe ISO string
            duration: appt.duration,
            notes: appt.notes,
            diagnosis: appt.diagnosis,
            prescription: appt.prescription,
            isActive: appt.status === 'Active'
        };
    };

    const getActiveConsultations = () => {
        return appointments
            .filter(appt => appt.status === 'Active')
            .map(mapAppointmentToConsultation);
    };

    const getConsultationHistory = () => {
        return appointments
            .filter(appt => appt.status === 'Completed')
            .map(mapAppointmentToConsultation)
            .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    };

    // Patient Actions
    const getPatientById = (id: string) => {
        return patients.find(p => p.id === id);
    };

    const getPatientConsultations = (patientId: string) => {
        return appointments
            .filter(appt => appt.patientId === patientId && (appt.status === 'Completed' || appt.status === 'Active'))
            .map(mapAppointmentToConsultation)
            .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    };

    const searchPatients = (query: string) => {
        const lowerQuery = query.toLowerCase();
        return patients.filter(p =>
            p.name.toLowerCase().includes(lowerQuery) ||
            p.email.toLowerCase().includes(lowerQuery) ||
            p.phone.includes(query)
        );
    };

    return (
        <AppointmentContext.Provider value={{
            appointments,
            patients,
            updateAppointmentStatus,
            addAppointmentNotes,
            addAppointmentLocal,
            getAppointmentById,
            getUpcomingAppointments,
            getPastAppointments,
            startConsultation,
            completeConsultation,
            updateConsultationNotes,
            getActiveConsultations,
            getConsultationHistory,
            getPatientById,
            getPatientConsultations,
            searchPatients,
            refreshAppointments,
            rescheduleAppointment
        }}>
            {children}
        </AppointmentContext.Provider>
    );
};

export const useAppointments = () => {
    const context = useContext(AppointmentContext);
    if (!context) {
        throw new Error('useAppointments must be used within an AppointmentProvider');
    }
    return context;
};
