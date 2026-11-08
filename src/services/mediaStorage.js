// ==========================================================================
// MediaStorage: Local IndexedDB Caching & Firebase Cloud Storage Uploader
// Saves full camera highlight clips locally so they never get lost, and
// automatically uploads to Firebase Storage when cloud bucket is enabled
// ==========================================================================

import { app, db } from './firebase.js';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

const DB_NAME = 'gamestreamer_media_db';
const STORE_NAME = 'highlight_videos';

export function openMediaDB() {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    try {
      // Version 2 ensures that onupgradeneeded fires even if an empty version 1 DB exists
      const req = indexedDB.open(DB_NAME, 2);
      req.onupgradeneeded = (e) => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

// Global sync status listeners for real-time UI monitoring
const syncStatusListeners = new Set();

export function onSyncStatusChanged(callback) {
  syncStatusListeners.add(callback);
  getSyncStatusSummary().then(status => {
    try { callback(status); } catch (e) {}
  });
  return () => syncStatusListeners.delete(callback);
}

export function notifySyncListeners() {
  getSyncStatusSummary().then(status => {
    for (const cb of syncStatusListeners) {
      try { cb(status); } catch (e) {}
    }
  });
}

export async function getSyncStatusSummary() {
  try {
    const items = await getAllLocalClipBlobs();
    const unsynced = items.filter(item => !item.syncedToDrive);
    const synced = items.filter(item => item.syncedToDrive);
    return {
      total: items.length,
      unsyncedCount: unsynced.length,
      syncedCount: synced.length,
      isUploading: isUploadingActive || isSyncSweepRunning,
      allSynced: items.length > 0 && unsynced.length === 0,
      items
    };
  } catch (e) {
    return { total: 0, unsyncedCount: 0, syncedCount: 0, isUploading: false, allSynced: true, items: [] };
  }
}

/**
 * Saves raw video binary to iPhone IndexedDB flash storage WITH COMPLETE METADATA.
 * Even if localStorage or Firestore is wiped, this record is 100% self-describing.
 */
export async function saveLocalClipBlob(clipId, blob, metadata = {}) {
  if (!clipId || !blob) return;
  try {
    const db = await openMediaDB();
    if (!db) return;

    // Convert to ArrayBuffer for 100% reliable iOS Safari IndexedDB persistence
    const buffer = await blob.arrayBuffer();
    const record = {
      clipId,
      matchId: metadata.matchId || '',
      opponent: metadata.opponent || '',
      matchDate: metadata.matchDate || metadata.date || '',
      set: metadata.set || 1,
      score: metadata.score || '0 - 0',
      label: metadata.label || 'Highlight',
      comment: metadata.comment || metadata.label || '',
      durationMs: metadata.durationMs || null,
      buffer,
      type: blob.type || 'video/mp4',
      size: blob.size,
      savedAt: Date.now(),
      syncedToDrive: false,
      driveFileId: metadata.driveFileId || null
    };

    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put(record, clipId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      req.onerror = () => reject(req.error);
    });
    console.log(`[MediaStorage] ✓ Confirmed saved clip ${clipId} to phone IndexedDB with complete metadata (${(blob.size / (1024 * 1024)).toFixed(2)} MB)`);
    notifySyncListeners();
    triggerAutoSyncSweep();
  } catch (e) {
    console.warn('[MediaStorage] Could not cache clip in IndexedDB:', e);
  }
}

export async function markClipSyncedInIndexedDB(clipId, driveFileId) {
  if (!clipId) return;
  try {
    const db = await openMediaDB();
    if (!db) return;
    await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const storeObj = tx.objectStore(STORE_NAME);
      const req = storeObj.get(clipId);
      req.onsuccess = () => {
        const record = req.result;
        if (record) {
          if (record instanceof ArrayBuffer || record instanceof Blob) {
            storeObj.put({
              buffer: record instanceof Blob ? null : record,
              syncedToDrive: true,
              driveFileId
            }, clipId);
          } else {
            record.syncedToDrive = true;
            record.driveFileId = driveFileId;
            record.syncedAt = Date.now();
            storeObj.put(record, clipId);
          }
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    notifySyncListeners();
  } catch (e) {
    console.warn('[MediaStorage] Failed to mark clip synced in IndexedDB:', e);
  }
}

export async function getLocalClipBlob(clipId) {
  if (!clipId) return null;
  try {
    const db = await openMediaDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(clipId);
      req.onsuccess = () => {
        const res = req.result;
        if (!res) return resolve(null);
        if (res instanceof Blob) return resolve(res);
        if (res instanceof ArrayBuffer) {
          return resolve(new Blob([res], { type: 'video/mp4' }));
        }
        if (res && res.buffer instanceof ArrayBuffer) {
          return resolve(new Blob([res.buffer], { type: res.type || 'video/mp4' }));
        }
        if (res && res.blob && res.blob instanceof Blob) return resolve(res.blob);
        resolve(null);
      };
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

export async function getLocalClipRecord(clipId) {
  if (!clipId) return null;
  try {
    const db = await openMediaDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(clipId);
      req.onsuccess = () => {
        const res = req.result;
        if (!res) return resolve(null);
        let blob = null;
        if (res instanceof Blob) blob = res;
        else if (res instanceof ArrayBuffer) blob = new Blob([res], { type: 'video/mp4' });
        else if (res && res.buffer instanceof ArrayBuffer) blob = new Blob([res.buffer], { type: res.type || 'video/mp4' });
        else if (res && res.blob && res.blob instanceof Blob) blob = res.blob;
        resolve({ ...res, blob });
      };
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

export async function getAllLocalClipBlobs() {
  try {
    const db = await openMediaDB();
    if (!db) return [];
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const storeObj = tx.objectStore(STORE_NAME);
      const req = storeObj.openCursor();
      const items = [];
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          let val = cursor.value;
          let blob = null;
          if (val instanceof Blob) {
            blob = val;
          } else if (val instanceof ArrayBuffer) {
            blob = new Blob([val], { type: 'video/mp4' });
          } else if (val && val.buffer instanceof ArrayBuffer) {
            blob = new Blob([val.buffer], { type: val.type || 'video/mp4' });
          } else if (val && val.blob instanceof Blob) {
            blob = val.blob;
          }
          if (blob) {
            items.push({
              key: cursor.key,
              blob,
              record: val,
              matchId: val.matchId || '',
              opponent: val.opponent || '',
              matchDate: val.matchDate || '',
              set: val.set || 1,
              score: val.score || '0-0',
              label: val.label || 'Highlight',
              comment: val.comment || '',
              durationMs: val.durationMs || null,
              syncedToDrive: !!val.syncedToDrive,
              driveFileId: val.driveFileId || null
            });
          }
          cursor.continue();
        } else {
          resolve(items);
        }
      };
      req.onerror = () => resolve([]);
    });
  } catch (e) {
    return [];
  }
}

/**
 * Removes a specific video blob from phone IndexedDB to free local storage.
 */
export async function deleteLocalClipBlob(clipId) {
  if (!clipId) return;
  try {
    const db = await openMediaDB();
    if (!db) return;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(clipId);
      tx.oncomplete = () => {
        notifySyncListeners();
        resolve(true);
      };
      tx.onerror = () => resolve(false);
    });
  } catch (e) {
    console.warn('[MediaStorage] Failed to delete clip from IndexedDB:', e);
  }
}

/**
 * Purges ALL local video blobs from phone IndexedDB.
 */
export async function clearAllLocalClipBlobs() {
  try {
    const db = await openMediaDB();
    if (!db) return false;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => {
        notifySyncListeners();
        resolve(true);
      };
      tx.onerror = () => resolve(false);
    });
  } catch (e) {
    return false;
  }
}

/**
 * Purges all local video blobs for a given match from phone IndexedDB after
 * they have been safely backed up to Google Drive, freeing phone gigabytes.
 */
export async function deleteLocalMatchBlobs(highlights = []) {
  if (!highlights || highlights.length === 0) return 0;
  let count = 0;
  for (const h of highlights) {
    if (h && h.id) {
      await deleteLocalClipBlob(h.id);
      count++;
    }
  }
  console.log(`[MediaStorage] Purged ${count} local clip blobs from phone storage.`);
  return count;
}

import { uploadHighlightViaMailSlot } from './drive.js';
import { store } from './store.js';

// In-flight upload lock per clipId to prevent duplicate parallel uploads from racing hooks
const inFlightUploads = new Set();
const uploadQueue = [];
let isUploadingActive = false;

/**
 * Uploads highlight video directly to the user's Google Drive via the private mail slot.
 * Enqueues uploads sequentially (concurrency: 1) so the phone's mobile uplink is never
 * saturated while simultaneously broadcasting live WebRTC video.
 */
export function uploadHighlightToCloud(matchId, clipId, videoBlob, clipMetadata = {}) {
  if (!matchId || !clipId || !videoBlob) return Promise.resolve(null);
  return new Promise((resolve) => {
    uploadQueue.push({ matchId, clipId, videoBlob, clipMetadata, resolve });
    triggerNextUpload();
  });
}

async function triggerNextUpload() {
  if (isUploadingActive || uploadQueue.length === 0) return;
  isUploadingActive = true;
  const item = uploadQueue.shift();
  try {
    const res = await executeUploadHighlightToCloud(item.matchId, item.clipId, item.videoBlob, item.clipMetadata);
    item.resolve(res);
  } catch (err) {
    console.warn(`[MediaStorage] Upload error for ${item.clipId}:`, err);
    item.resolve(null);
  } finally {
    isUploadingActive = false;
    if (uploadQueue.length > 0) {
      setTimeout(triggerNextUpload, 600); // 600ms spacing to prevent buffer bloat
    }
  }
}

async function executeUploadHighlightToCloud(matchId, clipId, videoBlob, clipMetadata = {}) {
  if (inFlightUploads.has(clipId)) {
    console.log(`[MediaStorage] Clip ${clipId} is already actively uploading. Skipping duplicate upload.`);
    return null;
  }
  inFlightUploads.add(clipId);

  try {
    // 1. Primary: Silently push to the personal 2 TB Google Drive Mail Slot
    try {
      console.log(`[MediaStorage] Pushing highlight ${clipId} to Google Drive Mail Slot...`);
      const driveRes = await uploadHighlightViaMailSlot({ id: clipId, ...clipMetadata }, videoBlob);
      if (driveRes && driveRes.success && driveRes.fileId) {
        console.log(`[MediaStorage] ✓ Google Drive upload succeeded! File ID: ${driveRes.fileId}`);

        const streamUrl = driveRes.downloadUrl;
        const cloudDetails = {
          videoUrl: streamUrl,
          driveFileId: driveRes.fileId,
          driveUrl: driveRes.webViewLink,
          driveDownloadUrl: driveRes.downloadUrl,
          storageTier: 'synced',
          cloudUploaded: true
        };

        // Update in-memory state
        try {
          store.updateClipCloudDetails(matchId, clipId, cloudDetails);
        } catch (e) {}

        // Update Firestore document for all connected viewers & tablets
        try {
          const matchDocRef = doc(db, 'matches', matchId);
          const snap = await getDoc(matchDocRef);
          if (snap.exists()) {
            const data = snap.data();
            const highlights = (data.highlights || []).map(h => {
              if (h.id === clipId) {
                return { ...h, ...cloudDetails };
              }
              return h;
            });
            await updateDoc(matchDocRef, { highlights, updatedAt: Date.now() });
          }
        } catch (dbErr) {
          console.warn('[MediaStorage] Failed to update Firestore with Drive details:', dbErr);
        }

        return streamUrl;
      }
    } catch (driveErr) {
      console.warn('[MediaStorage] Drive Mail Slot upload failed or offline:', driveErr);
    }

    // Zero-bill guarantee: If Google Drive is temporarily unreachable over modest gym reception,
    // preserve the clip 100% safely in phone IndexedDB. Never fallback to Firebase Storage
    // which has a strict 1 GB/day egress limit and risks bandwidth billing charges.
    console.info(`[MediaStorage] Highlight ${clipId} preserved safely in local IndexedDB camera master (will auto-sync to Drive when network allows).`);
    return null;
  } finally {
    inFlightUploads.delete(clipId);
  }
}

let isDriveSyncInProgress = false;

export function isSyncInProgress() {
  return isDriveSyncInProgress || isSyncSweepRunning || isUploadingActive || inFlightUploads.size > 0;
}

/**
 * Checks whether a highlight clip has been confirmed uploaded to Google Drive.
 */
export function isClipSyncedToDrive(clip) {
  if (!clip) return false;
  // A clip is truly synced if it has a genuine alphanumeric Google Drive file ID (not dummy 'drive_')
  const hasRealDriveFileId = !!(clip.driveFileId && !clip.driveFileId.startsWith('drive_') && clip.driveFileId !== 'firebase_storage');
  const isTierSynced = clip.storageTier === 'synced' || clip.storageTier === 'drive';
  const hasDirectDriveUrl = !!(clip.driveUrl && clip.driveUrl.includes('/d/') && !clip.driveUrl.includes('folders/'));
  const hasCloudStorage = !!(clip.cloudUploaded && clip.videoUrl && (clip.videoUrl.startsWith('https://firebasestorage') || clip.videoUrl.startsWith('https://storage.googleapis.com')));
  return (isTierSynced && hasRealDriveFileId) || hasDirectDriveUrl || hasCloudStorage;
}

/**
 * Accurately analyzes the sync status of all highlight clips in a match.
 */
export function getMatchSyncStatus(match) {
  if (!match) return { isFullySynced: false, unsyncedCount: 0, unsyncedClips: [], syncedCount: 0, totalClips: 0 };
  const clips = match.highlights || [];
  if (clips.length === 0) {
    return { isFullySynced: true, unsyncedCount: 0, unsyncedClips: [], syncedCount: 0, totalClips: 0 };
  }
  const unsyncedClips = clips.filter(c => !isClipSyncedToDrive(c));
  const syncedCount = clips.length - unsyncedClips.length;
  const isFullySynced = unsyncedClips.length === 0;
  return {
    isFullySynced,
    unsyncedCount: unsyncedClips.length,
    unsyncedClips,
    syncedCount,
    totalClips: clips.length
  };
}

/**
 * Specifically repairs and syncs pending clips for a single match.
 * Returns { success, syncedCount, needsPhone, error }
 */
export async function syncPendingClipsForMatch(matchId, onStatus = null) {
  const state = store.getState();
  const match = (state.matches || []).find(m => m.id === matchId);
  if (!match) return { success: false, syncedCount: 0, needsPhone: false, error: 'Match not found' };

  const syncStatus = getMatchSyncStatus(match);
  if (syncStatus.unsyncedCount === 0) {
    return { success: true, syncedCount: 0, needsPhone: false, message: 'All highlights are already synced to Google Drive!' };
  }

  isDriveSyncInProgress = true;
  let syncedCount = 0;
  let missingBlobCount = 0;
  try {
    for (let i = 0; i < syncStatus.unsyncedClips.length; i++) {
    const clip = syncStatus.unsyncedClips[i];
    if (inFlightUploads.has(clip.id)) {
      console.log(`[MediaStorage] Clip ${clip.id} already uploading. Skipping in match sync.`);
      continue;
    }
    if (onStatus) onStatus(`Syncing [${i + 1}/${syncStatus.unsyncedCount}] ${clip.label || 'Highlight'} to Google Drive...`);

    let blob = null;
    try {
      blob = await getLocalClipBlob(clip.id);
    } catch (e) {
      blob = null;
    }

    if ((!blob || blob.size === 0) && clip.videoUrl && !clip.videoUrl.startsWith('blob:')) {
      try {
        const fetchRes = await fetch(clip.videoUrl);
        if (fetchRes.ok) blob = await fetchRes.blob();
      } catch (e) {}
    }

    if (!blob || blob.size === 0) {
      missingBlobCount++;
      continue;
    }

    inFlightUploads.add(clip.id);
    try {
      const driveRes = await uploadHighlightViaMailSlot({
        id: clip.id,
        matchFolder: match.folderName || `${match.date} vs. ${match.opponent}`,
        matchDate: match.date,
        opponent: match.opponent,
        set: clip.set,
        score: clip.score,
        label: clip.label,
        comment: clip.comment
      }, blob);

      if (driveRes && driveRes.success && driveRes.fileId) {
        syncedCount++;
        const cloudDetails = {
          videoUrl: driveRes.downloadUrl,
          driveFileId: driveRes.fileId,
          driveUrl: driveRes.webViewLink,
          driveDownloadUrl: driveRes.downloadUrl,
          storageTier: 'synced',
          cloudUploaded: true
        };

        store.updateClipCloudDetails(match.id, clip.id, cloudDetails);

        try {
          const matchDocRef = doc(db, 'matches', match.id);
          const snap = await getDoc(matchDocRef);
          if (snap.exists()) {
            const data = snap.data();
            const updatedHighlights = (data.highlights || []).map(h => {
              if (h.id === clip.id) return { ...h, ...cloudDetails };
              return h;
            });
            const allSynced = updatedHighlights.every(h => isClipSyncedToDrive(h));
            await updateDoc(matchDocRef, {
              highlights: updatedHighlights,
              storageTier: allSynced ? 'synced' : 'server',
              updatedAt: Date.now()
            });
          }
        } catch (dbErr) {
          console.warn('[MediaStorage] Firestore update error:', dbErr);
        }
      }
    } catch (err) {
      console.warn(`[MediaStorage] Upload error for clip ${clip.id}:`, err);
    } finally {
      inFlightUploads.delete(clip.id);
    }
  }
} finally {
  isDriveSyncInProgress = false;
}

  const needsPhone = (syncedCount === 0 && missingBlobCount > 0);
  return {
    success: syncedCount > 0,
    syncedCount,
    missingBlobCount,
    needsPhone
  };
}

/**
 * Automatically inspects matches and syncs any unbacked-up highlight clips to Google Drive.
 * Draws from local phone IndexedDB master if available, or fetches from the network copy.
 */
export async function syncPendingClipsToDrive(matches = []) {
  if (isDriveSyncInProgress || !matches || matches.length === 0) return 0;
  isDriveSyncInProgress = true;

  let syncedCount = 0;
  try {
    for (const match of matches) {
      const highlights = match.highlights || [];
      for (const clip of highlights) {
        if (!clip || !clip.id) continue;
        if (isClipSyncedToDrive(clip)) continue;
        if (inFlightUploads.has(clip.id)) {
          console.log(`[MediaStorage] Clip ${clip.id} is already uploading. Skipping duplicate in background auto-sync.`);
          continue;
        }

        // Clip is not yet on Google Drive!
        inFlightUploads.add(clip.id);
        try {
          // 1. Obtain video blob: local phone master first, then network videoUrl (if not dead local blob)
          let blob = null;
          try {
            blob = await getLocalClipBlob(clip.id);
          } catch (e) {
            blob = null;
          }

          if ((!blob || blob.size === 0) && clip.videoUrl && !clip.videoUrl.startsWith('blob:') && !clip.videoUrl.includes('drive_h_') && !clip.videoUrl.includes('drive.google.com')) {
            try {
              const fetchRes = await fetch(clip.videoUrl);
              if (fetchRes.ok) {
                blob = await fetchRes.blob();
              }
            } catch (fetchErr) {
              console.warn(`[MediaStorage] Could not fetch server video for ${clip.id}:`, fetchErr);
            }
          }

          if (!blob || blob.size === 0) {
            // Local blob is not on this device (e.g. running on laptop, recorded on phone)
            continue;
          }

          // 2. Upload directly to Google Drive via Apps Script Mail Slot
          console.log(`[MediaStorage] Auto-uploading clip ${clip.id} to Google Drive Mail Slot (${(blob.size / 1024 / 1024).toFixed(1)} MB)...`);
          const driveRes = await uploadHighlightViaMailSlot({
            id: clip.id,
            matchFolder: match.folderName || `${match.date} vs. ${match.opponent}`,
            matchDate: match.date,
            opponent: match.opponent,
            set: clip.set,
            score: clip.score,
            label: clip.label,
            comment: clip.comment
          }, blob);

          if (driveRes && driveRes.success && driveRes.fileId) {
            console.log(`[MediaStorage] ✓ Successfully backed up clip ${clip.id} to Google Drive! File ID: ${driveRes.fileId}`);
            syncedCount++;

            const cloudDetails = {
              videoUrl: driveRes.downloadUrl,
              driveFileId: driveRes.fileId,
              driveUrl: driveRes.webViewLink,
              driveDownloadUrl: driveRes.downloadUrl,
              storageTier: 'synced',
              cloudUploaded: true
            };

            // Update local memory and store
            try {
              store.updateClipCloudDetails(match.id, clip.id, cloudDetails);
            } catch (e) {}

            // Mark synced in phone IndexedDB
            await markClipSyncedInIndexedDB(clip.id, driveRes.fileId);

            // Update Firestore document and overall match storageTier
            try {
              const matchDocRef = doc(db, 'matches', match.id);
              const snap = await getDoc(matchDocRef);
              if (snap.exists()) {
                const data = snap.data();
                const updatedHighlights = (data.highlights || []).map(h => {
                  if (h.id === clip.id) {
                    return { ...h, ...cloudDetails };
                  }
                  return h;
                });
                const allSynced = updatedHighlights.every(h => isClipSyncedToDrive(h));
                await updateDoc(matchDocRef, {
                  highlights: updatedHighlights,
                  storageTier: allSynced ? 'synced' : 'server',
                  updatedAt: Date.now()
                });
              }
            } catch (dbErr) {
              console.warn(`[MediaStorage] Firestore update failed for ${clip.id}:`, dbErr);
            }
          }
        } catch (clipSyncErr) {
          console.warn(`[MediaStorage] Drive auto-sync error on clip ${clip.id}:`, clipSyncErr);
        } finally {
          inFlightUploads.delete(clip.id);
        }
      }
    }
  } finally {
    isDriveSyncInProgress = false;
  }

  if (syncedCount > 0) {
    console.log(`[MediaStorage] ✓ Auto-synced a total of ${syncedCount} clips to Google Drive.`);
  }
  return syncedCount;
}

let isSyncSweepRunning = false;
const uploadFailures = new Map();
const uploadRetryAfter = new Map(); // clipKey -> next retry timestamp

/**
 * Resets backoff timers when network connectivity returns (e.g. online event)
 */
export function resetUploadBackoff() {
  uploadRetryAfter.clear();
  uploadFailures.clear();
  console.log('[MediaStorage] Upload backoff reset: ready for fresh sync attempts.');
}

/**
 * Robust Outbox Auto-Sync Sweep:
 * Inspects phone IndexedDB for unsynced clips and uploads them sequentially (concurrency: 1)
 * with spacing. This ensures clips recorded on this phone are always automatically pushed
 * to Google Drive whenever network allows, without stuttering live broadcasts.
 */
export async function triggerAutoSyncSweep() {
  if (isSyncSweepRunning) return;
  isSyncSweepRunning = true;
  notifySyncListeners();

  try {
    const items = await getAllLocalClipBlobs();
    const unsynced = items.filter(c => !c.syncedToDrive);
    if (unsynced.length === 0) return;

    console.log(`[MediaStorage] Outbox Auto-Sync: ${unsynced.length} unsynced clips on phone. Processing sequentially...`);

    for (let i = 0; i < unsynced.length; i++) {
      const item = unsynced[i];
      if (inFlightUploads.has(item.key)) continue;

      // Intelligent exponential backoff for modest gym reception:
      // If this clip failed recently, respect the backoff delay before re-attempting
      const retryAfter = uploadRetryAfter.get(item.key) || 0;
      if (Date.now() < retryAfter) {
        continue;
      }

      inFlightUploads.add(item.key);
      notifySyncListeners();

      try {
        const matchId = item.matchId;
        const opponent = item.opponent || 'Opponent';
        const matchDate = item.matchDate || new Date().toISOString().split('T')[0];
        const matchFolder = `${matchDate} vs. ${opponent}`.replace(/[/\\?%*:|"<>]/g, '').trim();
        const set = item.set || 1;
        const score = item.score || '0 - 0';
        const label = item.label || 'Highlight';
        const comment = item.comment || label;
        const filename = `Set ${String(set).padStart(2, '0')} (${score.replace(/\s+/g, '')}) - ${label}.mp4`.replace(/[/\\?%*:|"<>]/g, '');

        console.log(`[MediaStorage] Outbox Uploading [${i + 1}/${unsynced.length}] ${filename}...`);

        let uploadedToDrive = false;
        let cloudDetails = null;

        // Push to Google Drive Mail Slot (Zero-bill 2 TB permanent storage)
        try {
          const driveRes = await uploadHighlightViaMailSlot({
            id: item.key,
            matchFolder,
            matchDate,
            opponent,
            set,
            score,
            label,
            comment,
            filename
          }, item.blob);

          if (driveRes && driveRes.success && driveRes.fileId) {
            console.log(`[MediaStorage] ✓ Outbox Uploaded to Drive: ${filename} (Drive ID: ${driveRes.fileId})`);
            cloudDetails = {
              videoUrl: driveRes.downloadUrl,
              driveFileId: driveRes.fileId,
              driveUrl: driveRes.webViewLink,
              driveDownloadUrl: driveRes.downloadUrl,
              storageTier: 'synced',
              cloudUploaded: true
            };
            uploadedToDrive = true;
          }
        } catch (driveErr) {
          console.warn(`[MediaStorage] Drive Mail Slot upload failed for ${item.key}:`, driveErr.message);
        }

        if (uploadedToDrive && cloudDetails) {
          uploadFailures.delete(item.key);
          uploadRetryAfter.delete(item.key);
          await markClipSyncedInIndexedDB(item.key, cloudDetails.driveFileId);

          if (matchId) {
            try { store.updateClipCloudDetails(matchId, item.key, cloudDetails); } catch (e) {}
            try {
              const matchDocRef = doc(db, 'matches', matchId);
              const snap = await getDoc(matchDocRef);
              if (snap.exists()) {
                const data = snap.data();
                const updatedHighlights = (data.highlights || []).map(h => {
                  if (h.id === item.key) return { ...h, ...cloudDetails };
                  return h;
                });
                const allSynced = updatedHighlights.every(h => isClipSyncedToDrive(h));
                await updateDoc(matchDocRef, {
                  highlights: updatedHighlights,
                  storageTier: allSynced ? 'synced' : 'server',
                  updatedAt: Date.now()
                });
              }
            } catch (dbErr) {
              console.warn('[MediaStorage] Firestore update warning in Outbox:', dbErr);
            }
          }
        } else {
          const failCount = (uploadFailures.get(item.key) || 0) + 1;
          uploadFailures.set(item.key, failCount);
          // Exponential backoff for gym conditions:
          // Attempt 1: 20s, Attempt 2: 40s, Attempt 3: 80s, Max: 180s (3 min)
          const delayMs = Math.min(180000, 20000 * Math.pow(2, failCount - 1));
          uploadRetryAfter.set(item.key, Date.now() + delayMs);
          console.warn(`[MediaStorage] Outbox upload deferred on ${item.key} (attempt ${failCount}). Preserved safely in phone flash storage. Retrying in ${(delayMs / 1000).toFixed(0)}s.`);
        }
      } catch (err) {
        console.warn(`[MediaStorage] Outbox loop error on ${item.key}:`, err);
      } finally {
        inFlightUploads.delete(item.key);
        notifySyncListeners();
      }

      await new Promise(r => setTimeout(r, 600)); // 600ms spacing between uploads
    }
  } catch (err) {
    console.warn('[MediaStorage] Outbox sweep error:', err);
  } finally {
    isSyncSweepRunning = false;
    notifySyncListeners();
  }
}

// Backward-compatible alias
export const uploadHighlightToFirebaseStorage = uploadHighlightToCloud;
