// ==========================================================================
// GameStreamer WebRTC Live Video Streaming Engine
// Robust Firestore Signaling with Queued ICE Candidates & Auto-Negotiation
// 1-to-Few Direct Peer-to-Peer Video Pipeline (100% Free, Zero Bills)
// ==========================================================================

import { db } from './firebase.js';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  addDoc
} from 'firebase/firestore';

export const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:openrelay.metered.ca:80' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ],
  iceCandidatePoolSize: 10
};

class WebRTCService {
  constructor() {
    this.broadcastPeers = new Map(); // viewerId -> peerRecord
    this.broadcastUnsub = null;
    this.currentViewerSession = null;
    this.heartbeatInterval = null;
  }

  // --------------------------------------------------------------------------
  // BROADCASTER / STREAMER METHODS
  // --------------------------------------------------------------------------
  startBroadcast(matchId, localMediaStream, onViewerCountChange) {
    this._cleanPreviousBroadcastPeers();
    this._stopHeartbeat();

    if (!matchId || !localMediaStream) {
      console.warn('[WebRTC Streamer] startBroadcast requires matchId and localMediaStream');
      return;
    }

    console.log(`[WebRTC Streamer] Starting broadcast for match ${matchId} with STUN+TURN relay`);

    // Start 10-second broadcaster heartbeat to prevent ghost matches
    const sendHeartbeat = () => {
      try {
        updateDoc(doc(db, 'matches', matchId), {
          broadcasterHeartbeat: Date.now(),
          isLive: true,
          updatedAt: Date.now()
        }).catch(() => {});
      } catch (e) {}
    };
    sendHeartbeat();
    this.heartbeatInterval = setInterval(sendHeartbeat, 10000);

    const viewersCol = collection(db, 'matches', matchId, 'viewers');

    const updateCount = () => {
      let activeCount = 0;
      this.broadcastPeers.forEach(({ pc }) => {
        if (pc && (pc.connectionState === 'connected' || pc.connectionState === 'connecting')) {
          activeCount++;
        }
      });
      if (typeof onViewerCountChange === 'function') {
        onViewerCountChange(activeCount);
      }
    };

    // Listen for viewers joining this match
    this.broadcastUnsub = onSnapshot(viewersCol, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const viewerId = change.doc.id;
        const data = change.doc.data();

        if (change.type === 'added' || change.type === 'modified') {
          // If viewer is waiting for offer and we don't already have an active peer
          if (!this.broadcastPeers.has(viewerId)) {
            console.log(`[WebRTC Streamer] New viewer detected: ${viewerId}`);
            this._connectToViewer(matchId, viewerId, localMediaStream, updateCount);
          }
        } else if (change.type === 'removed') {
          console.log(`[WebRTC Streamer] Viewer left: ${viewerId}`);
          this._disconnectViewer(viewerId, updateCount);
        }
      });
    }, (err) => {
      console.warn('[WebRTC Streamer] Viewers listener error:', err);
    });
  }

  async _connectToViewer(matchId, viewerId, localMediaStream, updateCount) {
    try {
      const pc = new RTCPeerConnection(RTC_CONFIG);
      let pendingViewerCandidates = [];
      let isRemoteDescriptionSet = false;

      // SYNCHRONOUS REGISTRATION: Prevents duplicate race condition runs from onSnapshot!
      const peerRecord = {
        pc,
        unsubDoc: null,
        unsubCandidates: null
      };
      this.broadcastPeers.set(viewerId, peerRecord);

      // Add local tracks (iPhone court camera) with bitrate clamping (850 kbps max)
      localMediaStream.getTracks().forEach((track) => {
        const sender = pc.addTrack(track, localMediaStream);
        if (track.kind === 'video' && sender && typeof sender.getParameters === 'function') {
          try {
            const params = sender.getParameters();
            if (!params.encodings) params.encodings = [{}];
            // Clamp bitrate to 850 kbps so 3-4 viewers never choke cellular uplink
            params.encodings[0].maxBitrate = 850000;
            sender.setParameters(params).catch(() => {});
          } catch (e) {}
        }
      });

      const streamerCandidatesCol = collection(
        db,
        'matches',
        matchId,
        'viewers',
        viewerId,
        'streamerCandidates'
      );

      // Send local ICE candidates to Firestore
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addDoc(streamerCandidatesCol, event.candidate.toJSON()).catch((err) => {
            console.warn('[WebRTC Streamer] Error sending ICE candidate:', err);
          });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log(`[WebRTC Streamer] Peer ${viewerId} state:`, pc.connectionState);
        updateCount();
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          this._disconnectViewer(viewerId, updateCount);
        }
      };

      // Create WebRTC Offer
      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false
      });
      await pc.setLocalDescription(offer);

      const viewerDocRef = doc(db, 'matches', matchId, 'viewers', viewerId);
      await setDoc(
        viewerDocRef,
        {
          offer: {
            type: offer.type,
            sdp: offer.sdp
          },
          streamerActive: true,
          updatedAt: Date.now()
        },
        { merge: true }
      );
      console.log(`[WebRTC Streamer] Offer sent to viewer ${viewerId}`);

      // Listen for viewer's Answer
      peerRecord.unsubDoc = onSnapshot(viewerDocRef, async (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();

        if (data?.answer && !pc.currentRemoteDescription && pc.signalingState === 'have-local-offer') {
          try {
            console.log(`[WebRTC Streamer] Received answer from viewer ${viewerId}`);
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            isRemoteDescriptionSet = true;

            // Drain queued viewer ICE candidates
            if (pendingViewerCandidates.length > 0) {
              console.log(`[WebRTC Streamer] Draining ${pendingViewerCandidates.length} queued ICE candidates for ${viewerId}`);
              for (const cand of pendingViewerCandidates) {
                try {
                  await pc.addIceCandidate(cand);
                } catch (e) {
                  console.warn('[WebRTC Streamer] Error applying queued candidate:', e);
                }
              }
              pendingViewerCandidates = [];
            }
          } catch (e) {
            console.warn('[WebRTC Streamer] Error applying viewer answer:', e);
          }
        }
      });

      // Listen for viewer's ICE candidates
      const viewerCandidatesCol = collection(
        db,
        'matches',
        matchId,
        'viewers',
        viewerId,
        'viewerCandidates'
      );

      peerRecord.unsubCandidates = onSnapshot(viewerCandidatesCol, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            try {
              const candidate = new RTCIceCandidate(change.doc.data());
              if (!isRemoteDescriptionSet || !pc.remoteDescription) {
                // Queue candidate until remote description is set!
                pendingViewerCandidates.push(candidate);
              } else {
                await pc.addIceCandidate(candidate);
              }
            } catch (e) {
              console.warn('[WebRTC Streamer] Error adding viewer ICE candidate:', e);
            }
          }
        });
      });

      updateCount();
    } catch (err) {
      console.error(`[WebRTC Streamer] Failed to connect to viewer ${viewerId}:`, err);
      this._disconnectViewer(viewerId, updateCount);
    }
  }

  _stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  _disconnectViewer(viewerId, updateCount) {
    const peer = this.broadcastPeers.get(viewerId);
    if (peer) {
      try {
        if (peer.unsubDoc) peer.unsubDoc();
        if (peer.unsubCandidates) peer.unsubCandidates();
        if (peer.pc) peer.pc.close();
      } catch (e) {}
      this.broadcastPeers.delete(viewerId);
      if (typeof updateCount === 'function') updateCount();
    }
  }

  _cleanPreviousBroadcastPeers() {
    if (this.broadcastUnsub) {
      this.broadcastUnsub();
      this.broadcastUnsub = null;
    }
    this.broadcastPeers.forEach((peer, viewerId) => {
      this._disconnectViewer(viewerId);
    });
    this.broadcastPeers.clear();
  }

  stopBroadcast(matchId) {
    this._stopHeartbeat();
    this._cleanPreviousBroadcastPeers();

    if (matchId) {
      try {
        updateDoc(doc(db, 'matches', matchId), {
          isLive: false,
          broadcasterHeartbeat: 0,
          updatedAt: Date.now()
        }).catch(() => {});
      } catch (e) {}
    }
  }

  // --------------------------------------------------------------------------
  // VIEWER / WATCHER METHODS
  // --------------------------------------------------------------------------
  joinStream(matchId, onRemoteStream, onStatusChange) {
    this.leaveStream();

    if (!matchId) return;

    const viewerId = 'viewer_' + Math.random().toString(36).substring(2, 9);
    console.log(`[WebRTC Viewer] Joining stream for match ${matchId} as ${viewerId} with STUN+TURN`);

    const pc = new RTCPeerConnection(RTC_CONFIG);
    let pendingStreamerCandidates = [];
    let isRemoteDescriptionSet = false;
    let reconnectTimeout = null;
    let isReconnecting = false;

    if (typeof onStatusChange === 'function') {
      onStatusChange('connecting');
    }

    pc.ontrack = (event) => {
      console.log('[WebRTC Viewer] ontrack received media stream!', event);
      if (event.streams && event.streams[0]) {
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
          reconnectTimeout = null;
        }
        isReconnecting = false;
        if (typeof onRemoteStream === 'function') {
          onRemoteStream(event.streams[0]);
        }
        if (typeof onStatusChange === 'function') {
          onStatusChange('connected');
        }
      }
    };

    // Automatic ICE restart & reconnection on signal dips
    const attemptRestartIce = () => {
      if (isReconnecting) return;
      isReconnecting = true;
      console.log('[WebRTC Viewer] Signal dip detected. Triggering automatic ICE restart...');
      if (typeof onStatusChange === 'function') {
        onStatusChange('reconnecting');
      }
      try {
        if (typeof pc.restartIce === 'function') {
          pc.restartIce();
        }
      } catch (e) {
        console.warn('[WebRTC Viewer] restartIce call error:', e);
      }
      setTimeout(() => { isReconnecting = false; }, 6000);
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC Viewer] Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
          reconnectTimeout = null;
        }
        isReconnecting = false;
        if (typeof onStatusChange === 'function') {
          onStatusChange('connected');
        }
      } else if (pc.connectionState === 'disconnected') {
        attemptRestartIce();
        if (!reconnectTimeout) {
          reconnectTimeout = setTimeout(() => {
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
              console.log('[WebRTC Viewer] Disconnect persisted over 8s, notifying caller');
              if (typeof onStatusChange === 'function') {
                onStatusChange('disconnected');
              }
            }
          }, 8000);
        }
      } else if (pc.connectionState === 'failed') {
        attemptRestartIce();
        if (typeof onStatusChange === 'function') {
          onStatusChange('failed');
        }
      }
    };

    const viewerDocRef = doc(db, 'matches', matchId, 'viewers', viewerId);
    const viewerCandidatesCol = collection(
      db,
      'matches',
      matchId,
      'viewers',
      viewerId,
      'viewerCandidates'
    );

    // Send viewer ICE candidates to Firestore
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(viewerCandidatesCol, event.candidate.toJSON()).catch((err) => {
          console.warn('[WebRTC Viewer] Error sending viewer candidate:', err);
        });
      }
    };

    // Register viewer in Firestore to trigger broadcaster offer
    setDoc(viewerDocRef, {
      joinedAt: Date.now(),
      status: 'waiting_for_streamer'
    });

    // Listen for broadcaster's offer
    const unsubDoc = onSnapshot(viewerDocRef, async (docSnap) => {
      if (!docSnap.exists()) return;
      const data = docSnap.data();

      if (data?.offer && !pc.currentRemoteDescription && pc.signalingState === 'stable') {
        try {
          console.log('[WebRTC Viewer] Received offer from broadcaster, setting remote description...');
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
          isRemoteDescriptionSet = true;

          // Drain queued streamer candidates now that remote description is set!
          if (pendingStreamerCandidates.length > 0) {
            console.log(`[WebRTC Viewer] Draining ${pendingStreamerCandidates.length} queued streamer candidates`);
            for (const cand of pendingStreamerCandidates) {
              try {
                await pc.addIceCandidate(cand);
              } catch (e) {
                console.warn('[WebRTC Viewer] Error applying queued streamer candidate:', e);
              }
            }
            pendingStreamerCandidates = [];
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          await updateDoc(viewerDocRef, {
            answer: {
              type: answer.type,
              sdp: answer.sdp
            },
            status: 'answered',
            answeredAt: Date.now()
          });
          console.log('[WebRTC Viewer] Answer sent to broadcaster!');
        } catch (e) {
          console.error('[WebRTC Viewer] Error processing broadcaster offer:', e);
        }
      }
    });

    // Listen for broadcaster's ICE candidates
    const streamerCandidatesCol = collection(
      db,
      'matches',
      matchId,
      'viewers',
      viewerId,
      'streamerCandidates'
    );

    const unsubCandidates = onSnapshot(streamerCandidatesCol, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          try {
            const candidate = new RTCIceCandidate(change.doc.data());
            if (!isRemoteDescriptionSet || !pc.remoteDescription) {
              // Queue candidate until remote description is ready!
              pendingStreamerCandidates.push(candidate);
            } else {
              await pc.addIceCandidate(candidate);
            }
          } catch (e) {
            console.warn('[WebRTC Viewer] Error adding streamer candidate:', e);
          }
        }
      });
    });

    this.currentViewerSession = {
      pc,
      matchId,
      viewerId,
      viewerDocRef,
      unsubDoc,
      unsubCandidates
    };
  }

  leaveStream() {
    if (this.currentViewerSession) {
      console.log('[WebRTC Viewer] Leaving stream');
      const { pc, viewerDocRef, unsubDoc, unsubCandidates } = this.currentViewerSession;
      try {
        if (unsubDoc) unsubDoc();
        if (unsubCandidates) unsubCandidates();
        if (viewerDocRef) deleteDoc(viewerDocRef).catch(() => {});
        if (pc) pc.close();
      } catch (e) {}
      this.currentViewerSession = null;
    }
  }
}

export const webrtcService = new WebRTCService();
