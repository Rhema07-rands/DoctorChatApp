import * as signalR from '@microsoft/signalr';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config';
import { authEvents } from './authEvents';

class SignalRService {
    private chatConnection: signalR.HubConnection | null = null;
    private signalingConnection: signalR.HubConnection | null = null;
    private messageCallbacks: ((message: any) => void)[] = [];
    private availabilityCallbacks: ((data: any) => void)[] = [];

    // Signaling Callbacks
    private incomingCallCallbacks: ((data: any) => void)[] = [];
    private callAnsweredCallbacks: ((data: any) => void)[] = [];
    private callEndedCallbacks: ((data: any) => void)[] = [];
    private callFailedCallbacks: ((data: any) => void)[] = [];
    private callRejectedCallbacks: ((data: any) => void)[] = [];
    private missedCallCallbacks: ((data: any) => void)[] = [];
    private offerCallbacks: ((from: string, callId: string, sdp: string) => void)[] = [];
    private answerCallbacks: ((from: string, callId: string, sdp: string) => void)[] = [];
    private candidateCallbacks: ((from: string, callId: string, candidate: string) => void)[] = [];

    onMessageReceived(callback: (message: any) => void) {
        this.messageCallbacks.push(callback);
        return () => {
            this.messageCallbacks = this.messageCallbacks.filter(c => c !== callback);
        };
    }

    onAvailabilityChanged(callback: (data: any) => void) {
        this.availabilityCallbacks.push(callback);
        return () => {
            this.availabilityCallbacks = this.availabilityCallbacks.filter(c => c !== callback);
        };
    }

    on(event: string, callback: (...args: any[]) => void) {
        this.chatConnection?.on(event, callback);
        return () => {
            this.chatConnection?.off(event, callback);
        };
    }

    // Signaling Listener Registry
    onIncomingCall(cb: (data: any) => void) {
        this.incomingCallCallbacks.push(cb);
        return () => { this.incomingCallCallbacks = this.incomingCallCallbacks.filter(c => c !== cb); };
    }
    onCallAnswered(cb: (data: any) => void) {
        this.callAnsweredCallbacks.push(cb);
        return () => { this.callAnsweredCallbacks = this.callAnsweredCallbacks.filter(c => c !== cb); };
    }
    onCallEnded(cb: (data: any) => void) {
        this.callEndedCallbacks.push(cb);
        return () => { this.callEndedCallbacks = this.callEndedCallbacks.filter(c => c !== cb); };
    }
    onCallFailed(cb: (data: any) => void) {
        this.callFailedCallbacks.push(cb);
        return () => { this.callFailedCallbacks = this.callFailedCallbacks.filter(c => c !== cb); };
    }
    onCallRejected(cb: (data: any) => void) {
        this.callRejectedCallbacks.push(cb);
        return () => { this.callRejectedCallbacks = this.callRejectedCallbacks.filter(c => c !== cb); };
    }
    onMissedCall(cb: (data: any) => void) {
        this.missedCallCallbacks.push(cb);
        return () => { this.missedCallCallbacks = this.missedCallCallbacks.filter(c => c !== cb); };
    }
    onReceiveOffer(cb: (from: string, callId: string, sdp: string) => void) {
        this.offerCallbacks.push(cb);
        return () => { this.offerCallbacks = this.offerCallbacks.filter(c => c !== cb); };
    }
    onReceiveAnswer(cb: (from: string, callId: string, sdp: string) => void) {
        this.answerCallbacks.push(cb);
        return () => { this.answerCallbacks = this.answerCallbacks.filter(c => c !== cb); };
    }
    onReceiveCandidate(cb: (from: string, callId: string, candidate: string) => void) {
        this.candidateCallbacks.push(cb);
        return () => { this.candidateCallbacks = this.candidateCallbacks.filter(c => c !== cb); };
    }

    private isConnecting = false;

    async startConnections() {
        if (this.isConnecting) return;

        const token = await SecureStore.getItemAsync('userToken');
        if (!token) return;

        this.isConnecting = true;

        try {
            // Force fresh connections to ensure we use the latest token and groups
            await this.stopConnections();

            // Initialize Chat Hub
            this.chatConnection = new signalR.HubConnectionBuilder()
                .withUrl(`${API_BASE_URL}/chathub`, {
                    accessTokenFactory: () => token,
                })
                .withAutomaticReconnect()
                .build();

            // Initialize Signaling Hub (Calls)
            this.signalingConnection = new signalR.HubConnectionBuilder()
                .withUrl(`${API_BASE_URL}/signalinghub`, {
                    accessTokenFactory: () => token,
                })
                .withAutomaticReconnect()
                .build();

            await this.chatConnection.start();
            console.log('ChatHub connected!');

            await this.signalingConnection.start();
            console.log('SignalingHub connected!');

            this.registerListeners();
        } catch (err: any) {
            console.error('SignalR Connection Error:', err);

            // Check if it's a 401 Unauthorized error during negotiation
            if (err?.message?.includes('401') || err?.statusCode === 401) {
                console.warn('SignalR 401 Unauthorized detected. Emitting auth event.');
                authEvents.emitUnauthorized();
            }
        } finally {
            this.isConnecting = false;
        }
    }

    private registerListeners() {
        // Listen for Chat messages
        this.chatConnection?.on('ReceiveMessage', (message) => {
            console.log('New message received via SignalR:', message);
            this.messageCallbacks.forEach(cb => cb(message));
        });

        // Listen for Doctor availability changes
        this.chatConnection?.on('DoctorAvailabilityChanged', (data) => {
            console.log('Doctor availability changed via SignalR:', data);
            this.availabilityCallbacks.forEach(cb => cb(data));
        });

        // Listen for Echoes of our own sent messages (handled by individual callers usually, but good for unified sync)
        this.chatConnection?.on('MessageSentConfirmation', (message) => {
            console.log('Message sent confirmed via SignalR:', message);
            this.messageCallbacks.forEach(cb => cb(message));
        });

        // Listen for Calls
        this.signalingConnection?.on('IncomingCall', (data) => {
            console.log('Incoming call via SignalR:', data);
            this.incomingCallCallbacks.forEach(cb => cb(data));
        });

        this.signalingConnection?.on('CallAnswered', (data) => {
            this.callAnsweredCallbacks.forEach(cb => cb(data));
        });

        this.signalingConnection?.on('CallEnded', (data) => {
            this.callEndedCallbacks.forEach(cb => cb(data));
        });

        this.signalingConnection?.on('CallFailed', (data) => {
            this.callFailedCallbacks.forEach(cb => cb(data));
        });

        this.signalingConnection?.on('CallRejected', (data) => {
            this.callRejectedCallbacks.forEach(cb => cb(data));
        });

        this.signalingConnection?.on('MissedCall', (data) => {
            console.log('MissedCall received on SignalingHub:', data);
            this.missedCallCallbacks.forEach(cb => cb(data));
        });

        this.signalingConnection?.on('ReceiveOffer', (from, callId, sdp) => {
            this.offerCallbacks.forEach(cb => cb(from, callId, sdp));
        });

        this.signalingConnection?.on('ReceiveAnswer', (from, callId, sdp) => {
            this.answerCallbacks.forEach(cb => cb(from, callId, sdp));
        });

        this.signalingConnection?.on('ReceiveCandidate', (from, callId, candidate) => {
            this.candidateCallbacks.forEach(cb => cb(from, callId, candidate));
        });
    }

    async stopConnections() {
        if (this.chatConnection) {
            try {
                await this.chatConnection.stop();
            } catch (e) {
                console.log("Error stopping chat connection", e);
            }
            this.chatConnection = null;
        }
        if (this.signalingConnection) {
            try {
                await this.signalingConnection.stop();
            } catch (e) {
                console.log("Error stopping signaling connection", e);
            }
            this.signalingConnection = null;
        }
        console.log("SignalR connections stopped.");
    }

    // Define Hub Methods
    async sendMessage(targetUserId: string, messageContent: string, messageType: string = 'text', attachmentUrl: string | null = null, prescriptionId: string | null = null) {
        if (this.chatConnection?.state === signalR.HubConnectionState.Connected) {
            await this.chatConnection.invoke('SendMessage', targetUserId, messageContent, messageType, attachmentUrl, prescriptionId);
        }
    }

    async invoke(methodName: string, ...args: any[]) {
        if (this.chatConnection?.state === signalR.HubConnectionState.Connected) {
            await this.chatConnection.invoke(methodName, ...args);
        } else {
            console.warn(`Cannot invoke ${methodName}: ChatHub is disconnected.`);
        }
    }

    async invokeSignaling(methodName: string, ...args: any[]) {
        if (this.signalingConnection?.state === signalR.HubConnectionState.Connected) {
            await this.signalingConnection.invoke(methodName, ...args);
        } else {
            console.warn(`Cannot invoke ${methodName}: SignalingHub is disconnected.`);
        }
    }

    getChatConnection() {
        return this.chatConnection;
    }

    getSignalingConnection() {
        return this.signalingConnection;
    }
}

export const signalRService = new SignalRService();
