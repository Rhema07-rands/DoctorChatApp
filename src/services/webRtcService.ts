import {
    mediaDevices,
    MediaStream,
    RTCIceCandidate,
    RTCPeerConnection,
    RTCSessionDescription
} from 'react-native-webrtc';
import { api } from './api';
import { signalRService } from './signalrService';

const baseConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:stun.services.mozilla.com' },
    ],
    iceTransportPolicy: 'all',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceCandidatePoolSize: 10
};

export class WebRtcService {
    public peerConnection: RTCPeerConnection | null = null;
    public localStream: MediaStream | null = null;
    public remoteStream: MediaStream | null = null;

    private onRemoteStreamAdd: ((stream: MediaStream) => void) | null = null;
    private pendingCandidates: string[] = [];
    private pendingOffer: { targetUserId: string, callId: string, sdpStr: string } | null = null;
    private iceServers: any[] = [];

    constructor() { }

    public setOnRemoteStreamAdd(callback: (stream: MediaStream) => void) {
        this.onRemoteStreamAdd = callback;
    }

    public async setupMedia(isVideoCall: boolean = true): Promise<MediaStream | null> {
        try {
            let isFront = true;
            const sourceInfos = (await mediaDevices.enumerateDevices()) as any[];
            let videoSourceId;
            for (let i = 0; i < sourceInfos.length; i++) {
                const sourceInfo = sourceInfos[i];
                if (sourceInfo.kind === 'videoinput' && sourceInfo.facing === (isFront ? 'front' : 'environment')) {
                    videoSourceId = sourceInfo.deviceId;
                }
            }

            const stream = await mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                } as any,
                video: isVideoCall ? {
                    width: 640,
                    height: 480,
                    frameRate: 30,
                    facingMode: (isFront ? 'user' : 'environment')
                } as any : false
            });

            this.localStream = stream;
            return stream;
        } catch (err) {
            console.error('Error setting up media:', err);
            return null;
        }
    }

    public async refreshIceServers(authToken?: string) {
        try {
            console.log('WebRtcService: Fetching fresh TURN credentials...');

            const response = await api.get('calls/turn-credentials');
            const dynamicIceServers = response.data;

            const turnServers = (Array.isArray(dynamicIceServers) ? dynamicIceServers : (dynamicIceServers?.iceServers || [])).filter((s: any) =>
                s.urls.startsWith('turn:') || s.urls.startsWith('turns:')
            );
            const otherServers = (Array.isArray(dynamicIceServers) ? dynamicIceServers : (dynamicIceServers?.iceServers || [])).filter((s: any) =>
                !s.urls.startsWith('turn:') && !s.urls.startsWith('turns:')
            );

            this.iceServers = [
                ...turnServers,
                ...baseConfiguration.iceServers,
                ...otherServers
            ];

            console.log(`WebRtcService: Successfully fetched ${turnServers.length} TURN and ${otherServers.length} STUN servers.`);
        } catch (err) {
            console.error('WebRtcService: Error fetching dynamic ICE servers, using fallbacks:', err);
            this.iceServers = [...baseConfiguration.iceServers];
        }
    }

    public async createPeerConnection(targetUserId: string, callId: string, authToken?: string) {
        if (this.peerConnection) {
            console.log('WebRtcService: RTCPeerConnection already exists, skipping creation.');
            return;
        }

        if (this.iceServers.length === 0) {
            await this.refreshIceServers(authToken);
        }

        console.log(`WebRtcService: Creating RTCPeerConnection for target: ${targetUserId}`);
        const config = {
            ...baseConfiguration,
            iceServers: this.iceServers.length > 0 ? this.iceServers : baseConfiguration.iceServers
        };

        this.peerConnection = new RTCPeerConnection(config as any);

        this.addLocalStreamToPeerConnection();

        // BULLETPROOF TRACK LISTENER
        this.peerConnection.addEventListener('track', (event) => {
            console.log(`Received remote track: ${event.track?.kind} (id: ${event.track?.id})`);

            if (!this.remoteStream) {
                this.remoteStream = (event.streams && event.streams[0]) ? event.streams[0] : new MediaStream();
            }

            const existingTracks = this.remoteStream.getTracks();
            if (event.track && !existingTracks.find(t => t.id === event.track!.id)) {
                this.remoteStream.addTrack(event.track);
            }

            if (this.onRemoteStreamAdd) {
                this.onRemoteStreamAdd(this.remoteStream);
            }
        });

        this.peerConnection.addEventListener('icecandidate', (event) => {
            if (event.candidate) {
                const c = event.candidate as any;
                console.log(`Outbound ICE candidate: ${c.candidate}`);
                const candidateJson = event.candidate.toJSON();
                signalRService.invokeSignaling('SendCandidate', targetUserId, callId, JSON.stringify(candidateJson));
            } else {
                console.log('ICE gathering complete for this peer instance');
            }
        });

        this.peerConnection.addEventListener('iceconnectionstatechange', () => {
            console.log('ICE Connection State:', this.peerConnection?.iceConnectionState);
        });

        this.peerConnection.addEventListener('connectionstatechange', () => {
            console.log('WebRTC Connection State:', this.peerConnection?.connectionState);
            if (this.peerConnection?.connectionState === 'connected') {
                this.processPendingCandidates();
            }
        });

        this.peerConnection.addEventListener('signalingstatechange', () => {
            console.log('Signaling State:', this.peerConnection?.signalingState);
        });

        if (this.pendingOffer) {
            console.log('Processing buffered offer after PC creation');
            const { targetUserId: tid, callId: cid, sdpStr: sdp } = this.pendingOffer;
            this.pendingOffer = null;
            await this.handleOffer(tid, cid, sdp);
        }
    }

    public async createOffer(targetUserId: string, callId: string, isVideo: boolean = true): Promise<RTCSessionDescription | null> {
        if (!this.peerConnection) return null;

        try {
            console.log(`WebRtcService: Creating offer for ${targetUserId} (isVideo: ${isVideo})`);
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: isVideo
            });
            await this.peerConnection.setLocalDescription(offer);

            await signalRService.invokeSignaling('SendOffer', targetUserId, callId, JSON.stringify(offer.toJSON ? offer.toJSON() : offer));

            return offer;
        } catch (err) {
            console.error('Error creating offer:', err);
            return null;
        }
    }

    public async handleOffer(targetUserId: string, callId: string, sdpStr: string): Promise<RTCSessionDescription | null> {
        if (!this.peerConnection) {
            console.log('Queuing incoming offer (No PC yet)');
            this.pendingOffer = { targetUserId, callId, sdpStr };
            return null;
        }

        try {
            const offer = new RTCSessionDescription(JSON.parse(sdpStr));
            await this.peerConnection.setRemoteDescription(offer);

            // FLUSH CANDIDATES IMMEDIATELY
            await this.processPendingCandidates();

            const isVideoOffer = sdpStr.includes('m=video');
            console.log(`WebRtcService: Received offer (contains video: ${isVideoOffer})`);

            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            await signalRService.invokeSignaling('SendAnswer', targetUserId, callId, JSON.stringify(answer.toJSON ? answer.toJSON() : answer));

            return answer;
        } catch (err) {
            console.error('Error handling offer:', err);
            return null;
        }
    }

    public async handleAnswer(sdpStr: string) {
        if (!this.peerConnection) return;

        try {
            const answer = new RTCSessionDescription(JSON.parse(sdpStr));
            await this.peerConnection.setRemoteDescription(answer);

            // FLUSH CANDIDATES IMMEDIATELY
            await this.processPendingCandidates();
        } catch (err) {
            console.error('Error handling answer:', err);
        }
    }

    public async handleCandidate(candidateStr: string) {
        if (!candidateStr) return;

        try {
            const candidate = new RTCIceCandidate(JSON.parse(candidateStr));

            if (this.peerConnection && this.peerConnection.remoteDescription) {
                await this.peerConnection.addIceCandidate(candidate);
                console.log(`Inbound ICE candidate added: sdpMid=${(candidate as any).sdpMid}`);
            } else {
                console.log('Queuing ICE candidate (No PC or RemoteDescription yet)');
                this.pendingCandidates.push(candidateStr);
            }
        } catch (err) {
            console.error('Error handling candidate:', err);
        }
    }

    private async processPendingCandidates() {
        if (!this.peerConnection || !this.peerConnection.remoteDescription) return;

        console.log(`Flushing ${this.pendingCandidates.length} queued ICE candidates`);
        while (this.pendingCandidates.length > 0) {
            const candidateStr = this.pendingCandidates.shift();
            if (candidateStr) {
                await this.handleCandidate(candidateStr);
            }
        }
    }

    public addLocalStreamToPeerConnection() {
        if (!this.peerConnection || !this.localStream) return;

        console.log(`Adding/Updating ${this.localStream.getTracks().length} local tracks to PC`);

        const senders = this.peerConnection.getSenders();
        senders.forEach(sender => {
            try {
                this.peerConnection?.removeTrack(sender);
            } catch (e) {
                console.warn('Error removing track during update:', e);
            }
        });

        this.localStream.getTracks().forEach((track) => {
            try {
                this.peerConnection?.addTrack(track, this.localStream!);
            } catch (e) {
                console.error('Error adding track to PC:', e);
            }
        });
    }

    public closeConnection() {
        console.log("WebRtcService: Actively releasing all media tracks...");

        // 1. Forcefully stop ALL local tracks (releases the camera/mic hardware lock)
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                try {
                    track.stop(); // This tells the OS "I'm done with the camera/mic"
                    track.enabled = false;
                } catch (e) {
                    console.error("Error stopping local track:", e);
                }
            });
            this.localStream = null;
        }

        // 2. Forcefully stop ALL remote tracks (clears out the native player buffers)
        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(track => {
                try {
                    track.stop();
                    track.enabled = false;
                } catch (e) {
                    console.error("Error stopping remote track:", e);
                }
            });
            this.remoteStream = null;
        }

        // 3. Close the peer connection completely
        // 3. Close the peer connection completely
        if (this.peerConnection) {
            try {
                this.peerConnection.close();
            } catch (e) {
                console.error("Error closing PeerConnection:", e);
            }
            this.peerConnection = null; // This wipes it out of memory safely
        }

        // 4. Reset state
        this.pendingCandidates = [];
        this.pendingOffer = null;

        console.log("WebRtcService: Connection closed and hardware locks released.");
    }
    public toggleMute(isMuted: boolean) {
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = !isMuted;
            });
        }
    }

    public toggleVideo(isVideoOff: boolean) {
        if (this.localStream) {
            this.localStream.getVideoTracks().forEach(track => {
                track.enabled = !isVideoOff;
            });
        }
    }

    public switchCamera() {
        if (this.localStream) {
            this.localStream.getVideoTracks().forEach(track => {
                if ((track as any)._switchCamera) {
                    (track as any)._switchCamera();
                }
            });
        }
    }
}