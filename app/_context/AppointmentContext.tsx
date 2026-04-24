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
    isLoading: boolean;
};



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

    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [patients] = useState<Patient[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Function to manually re-fetch data
    const refreshAppointments = async () => {
        if (!patientId && userRole === 'patient') return;

        setIsLoading(true);
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
            console.log("Could not fetch live appointments.", error);
        } finally {
            setIsLoading(false);
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
            rescheduleAppointment,
            isLoading
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
