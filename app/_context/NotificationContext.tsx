import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import React, { createContext, ReactNode, useContext, useEffect } from 'react';
import { api } from '../../src/services/api';
import { notificationService } from '../../src/services/notificationService';
import { signalRService } from '../../src/services/signalrService';
import { useUser } from './UserContext';

// Handle notifications when app is foregrounded
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

type NotificationContextType = {
    registerNotificationCategories: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
    const router = useRouter();
    const { activeChatId, userRole, refreshUnreadCount, patientId } = useUser();

    const registerNotificationCategories = async () => {
        await Notifications.setNotificationCategoryAsync('chat_message', [
            {
                identifier: 'REPLY',
                buttonTitle: 'Reply',
                options: {
                    // FIX: Keep app in background when replying — no need to open
                    // the app just to send a reply. The user stays in whatever they
                    // were doing; the message arrives in the conversation silently.
                    opensAppToForeground: false,
                },
                textInput: {
                    submitButtonTitle: 'Send',
                    placeholder: 'Write a reply...',
                },
            },
            {
                identifier: 'MARK_AS_READ',
                buttonTitle: 'Mark as read',
                options: {
                    isDestructive: false,
                    isAuthenticationRequired: false,
                    opensAppToForeground: false,
                },
            },
            {
                identifier: 'MUTE',
                buttonTitle: 'Mute',
                options: {
                    isDestructive: true,
                    opensAppToForeground: false,
                },
            },
        ]);
    };

    const scheduleNotification = async (msg: any) => {
        const senderName = msg.senderName || msg.SenderName || "New Message";
        const content = msg.content || msg.Content || "";
        const senderId = (msg.senderId || msg.SenderId || "").toLowerCase();

        await Notifications.scheduleNotificationAsync({
            content: {
                title: senderName,
                body: content,
                data: {
                    senderId,
                    senderName,
                    role: userRole
                },
                categoryIdentifier: 'chat_message',
            },
            trigger: null,
        });
    };

    useEffect(() => {
        registerNotificationCategories();
        notificationService.registerForPushNotificationsAsync();

        const responseSubscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
            const { actionIdentifier, userText, notification } = response;
            const data = notification.request.content.data || {};
            const senderId = data.senderId as string | undefined;
            const senderName = data.senderName as string | undefined;

            // Only handle chat-related actions if senderId exists
            // Prescription alarm notifications, appointment notifications, etc. don't have senderId
            if (!senderId) return;

            if (actionIdentifier === 'REPLY' && userText && senderId) {
                try {
                    // FIX: Send the reply through SignalR exactly like typing in
                    // the chat screen would. The receiver sees it as a normal
                    // message — indistinguishable from one sent in-app.
                    await signalRService.sendMessage(senderId, userText);

                    // Mark the conversation as read now that we've replied
                    await api.put(`chat/${senderId}/read`);
                    refreshUnreadCount();

                    // Send a local confirmation notification so the sender knows
                    // the reply went through (app stays in background)
                    await Notifications.scheduleNotificationAsync({
                        content: {
                            title: `Reply sent to ${senderName}`,
                            body: userText,
                            data: { senderId, senderName, role: userRole },
                            categoryIdentifier: 'chat_message',
                        },
                        trigger: null,
                    });
                } catch (e) {
                    console.error('Error sending notification reply:', e);
                }
                // Don't navigate — reply was sent silently in background
                return;
            }

            if (actionIdentifier === 'MARK_AS_READ') {
                try {
                    await api.put(`chat/${senderId}/read`);
                    refreshUnreadCount();
                } catch (e) {
                    console.error('Error marking as read from notification:', e);
                }
                return;
            }

            if (actionIdentifier === 'MUTE') {
                // Mute logic can be added here in future
                return;
            }

            // Default tap — open the conversation
            if (senderId) {
                router.push({
                    pathname: userRole === 'doctor'
                        ? '/Doctor_subpage/chat_conversation'
                        : '/Patient_subpage/chat_conversation',
                    params: { id: senderId, name: senderName }
                } as any);
            }
        });

        const unsubscribe = signalRService.on('ReceiveMessage', (msg: any) => {
            const senderId = (msg.senderId || msg.SenderId || "").toLowerCase();
            const currentActiveId = (activeChatId || "").toLowerCase();
            const currentUserId = (patientId || "").toLowerCase();

            // Don't notify if the user is already in this conversation
            if (currentActiveId === senderId) return;

            // Don't notify if the user themselves sent the message
            if (currentUserId === senderId) return;

            refreshUnreadCount();

            // Suppress push notifications for call log messages
            const type = msg.messageType || msg.MessageType;
            if (type === 'call') return;

            scheduleNotification(msg);
        });

        const unsubNewAppt = signalRService.on('NewAppointment', (appt: any) => {
            if (userRole === 'doctor') {
                const patientName = appt.patient?.firstName
                    ? `${appt.patient.firstName} ${appt.patient.lastName}`
                    : "A patient";
                Notifications.scheduleNotificationAsync({
                    content: {
                        title: "New Appointment Booked",
                        body: `${patientName} has booked an appointment for ${new Date(appt.dateTime).toLocaleString()}.`,
                        data: { type: 'appointment', apptId: appt.id },
                    },
                    trigger: null,
                });
            }
        });

        const unsubApptUpdated = signalRService.on('AppointmentUpdated', (appt: any) => {
            const isDoctor = userRole === 'doctor';
            const otherPartyName = isDoctor
                ? (appt.patient?.firstName ? `${appt.patient.firstName} ${appt.patient.lastName}` : "Patient")
                : (appt.doctor?.firstName ? `Dr. ${appt.doctor.firstName} ${appt.doctor.lastName}` : "Doctor");

            Notifications.scheduleNotificationAsync({
                content: {
                    title: `Appointment ${appt.status}`,
                    body: `Your appointment with ${otherPartyName} is now ${appt.status.toLowerCase()}.`,
                    data: { type: 'appointment', apptId: appt.id },
                },
                trigger: null,
            });
        });

        return () => {
            responseSubscription.remove();
            unsubscribe();
            unsubNewAppt();
            unsubApptUpdated();
        };
    }, [activeChatId, userRole]);

    return (
        <NotificationContext.Provider value={{ registerNotificationCategories }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
    return context;
};