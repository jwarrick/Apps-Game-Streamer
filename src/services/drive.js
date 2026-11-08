// ==========================================================================
// Google Drive Archiving & Cloud Sync Service
// Provides direct Google Drive API uploads when authenticated,
// and 1-click download/share sheet fallback to save clips to the Drive folder
// ==========================================================================

import { auth } from './firebase.js';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getLocalClipBlob } from './mediaStorage.js';

const DRIVE_TOKEN_KEY = 'gamestreamer_drive_token';

export const APPS_SCRIPT_MAILSLOT_URL = 'https://script.google.com/macros/s/AKfycbyeSCjUUHEreKsb8t1Z3YvPyaazk_7VzgBYC8ZTCaoKE1O6seJQuEXjoIifQEa2dFqJuw/exec';

export function extractDriveFolderId(url) {
  if (!url) return '1_xaGV5-7hA0-cm7TnTZtAbGvWL4AERxt';
  const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return match[1];
  return '1_xaGV5-7hA0-cm7TnTZtAbGvWL4AERxt';
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      } else {
        reject(new Error('FileReader did not return string'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function getMatchFolderName(match = {}) {
  const date = match.date || match.matchDate || new Date().toISOString().split('T')[0];
  const opponent = match.opponent || 'Opponent';
  return `${date} vs. ${opponent}`.replace(/[/\\?%*:|"<>]/g, '').trim();
}

export function formatHighlightFilename(clip = {}) {
  // 1. Set number (zero-padded: Set 01, Set 02)
  const setNum = parseInt(clip.set, 10) || 1;
  const setStr = `Set ${String(setNum).padStart(2, '0')}`;

  // 2. Score (zero-padded for proper chronological alphabetical sorting)
  let scoreStr = '(00-00)';
  if (clip.score) {
    const rawScore = String(clip.score).trim();
    const parts = rawScore.split(/[-–—/:]/).map(p => p.trim());
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      const s1 = String(parseInt(parts[0], 10) || 0).padStart(2, '0');
      const s2 = String(parseInt(parts[1], 10) || 0).padStart(2, '0');
      scoreStr = `(${s1}-${s2})`;
    } else {
      scoreStr = `(${rawScore.replace(/[/\\?%*:|"<>]/g, '')})`;
    }
  }

  // 3. Comment / Label
  const comment = (clip.comment || clip.label || 'Highlight')
    .replace(/[/\\?%*:|"<>]/g, '')
    .trim();

  return `${setStr} ${scoreStr} - ${comment}.mp4`;
}

export async function sanitizeVideoBlob(blob) {
  if (!blob || blob.size < 16) return blob;
  try {
    const headerBuf = await blob.slice(0, 8).arrayBuffer();
    const u8Header = new Uint8Array(headerBuf);
    const tag = String.fromCharCode(u8Header[4], u8Header[5], u8Header[6], u8Header[7]);
    if (tag === 'ftyp') return blob; // Valid clean MP4 container

    // If tag is moof or missing ftyp, search within first 5 MB for 'ftyp'
    const scanLimit = Math.min(blob.size, 5 * 1024 * 1024);
    const scanBuf = await blob.slice(0, scanLimit).arrayBuffer();
    const u8 = new Uint8Array(scanBuf);
    for (let i = 4; i < scanLimit - 4; i++) {
      if (u8[i] === 0x66 && u8[i+1] === 0x74 && u8[i+2] === 0x79 && u8[i+3] === 0x70) {
        const boxStart = i - 4;
        console.log(`[VideoSanitizer] Self-healed video blob: trimmed ${boxStart} leading bytes to restore 'ftyp' container header.`);
        return blob.slice(boxStart, blob.size, blob.type || 'video/mp4');
      }
    }
  } catch (e) {
    console.warn('[VideoSanitizer] Blob inspection error:', e);
  }
  return blob;
}

/**
 * Uploads a video highlight directly to the user's 2 TB Google Drive folder
 * via the Google Apps Script Private Mail Slot without requiring user sign-in popups.
/**
 * Direct Resumable Chunked Upload to Google Drive (Zero Base64, Fault-Tolerant, Gym-Optimized)
 * 1. Obtains a pre-authorized session URL from Apps Script session broker.
 * 2. Streams raw binary slices (1 MB chunks) directly to Google Drive ingest servers.
 * 3. Resumes seamlessly from the exact byte offset if a cellular interruption occurs.
 */
async function uploadHighlightDirectResumable(clip, blob, matchFolder, filename, onProgress) {
  if (onProgress) onProgress('Initializing Google Drive session...');
  console.log(`[DriveResumable] Initializing resumable session for ${filename} (${(blob.size / (1024 * 1024)).toFixed(2)} MB)...`);

  // Step 1: Request pre-authorized upload session from Apps Script
  const sessionPayload = {
    action: 'createResumableUpload',
    clipId: clip.id,
    matchFolder,
    filename,
    fileSize: blob.size,
    mimeType: blob.type || 'video/mp4'
  };

  const handshakeController = new AbortController();
  const handshakeTimer = setTimeout(() => handshakeController.abort(), 20000); // 20s handshake timeout
  let initRes;
  try {
    const res = await fetch(APPS_SCRIPT_MAILSLOT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(sessionPayload),
      redirect: 'follow',
      signal: handshakeController.signal
    });
    const text = await res.text();
    initRes = JSON.parse(text);
  } catch (err) {
    throw new Error(`Session initiation failed: ${err.message}`);
  } finally {
    clearTimeout(handshakeTimer);
  }

  if (!initRes || !initRes.success || !initRes.uploadUrl) {
    throw new Error(initRes?.error || 'Apps Script did not return a valid uploadUrl');
  }

  const uploadUrl = initRes.uploadUrl;
  console.log(`[DriveResumable] ✓ Resumable session acquired. Uploading binary chunks directly to Google Drive...`);

  // Step 2: Stream raw binary chunks directly to Google Drive (1 MB = multiple of 256 KB)
  const CHUNK_SIZE = 1048576; // 1 MB: Ideal for cellular stability
  const totalSize = blob.size;
  let startByte = 0;

  while (startByte < totalSize) {
    const endByte = Math.min(startByte + CHUNK_SIZE, totalSize);
    const chunk = blob.slice(startByte, endByte);
    const pct = Math.round((startByte / totalSize) * 100);
    if (onProgress) onProgress(`Uploading ${pct}%...`);

    let chunkAttempt = 0;
    let chunkSuccess = false;
    let finalFileData = null;

    while (!chunkSuccess && chunkAttempt < 3) {
      chunkAttempt++;
      const chunkController = new AbortController();
      const chunkTimer = setTimeout(() => chunkController.abort(), 45000); // 45s per 1 MB chunk

      try {
        const chunkRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Range': `bytes ${startByte}-${endByte - 1}/${totalSize}`,
            'Content-Type': blob.type || 'video/mp4'
          },
          body: chunk,
          signal: chunkController.signal
        });

        clearTimeout(chunkTimer);

        if (chunkRes.status === 308) {
          // Chunk accepted; Google ready for next range
          chunkSuccess = true;
          const rangeHeader = chunkRes.headers.get('Range');
          if (rangeHeader) {
            const m = rangeHeader.match(/bytes=0-(\d+)/);
            if (m && m[1]) {
              startByte = parseInt(m[1], 10) + 1;
            } else {
              startByte = endByte;
            }
          } else {
            startByte = endByte;
          }
        } else if (chunkRes.status === 200 || chunkRes.status === 201) {
          // Complete file written and assembled by Google!
          chunkSuccess = true;
          startByte = totalSize;
          try {
            finalFileData = await chunkRes.json();
          } catch (e) {
            finalFileData = {};
          }
        } else {
          console.warn(`[DriveResumable] Unexpected chunk HTTP status ${chunkRes.status}. Retrying chunk...`);
          await new Promise(r => setTimeout(r, 1500));
        }
      } catch (chunkErr) {
        clearTimeout(chunkTimer);
        console.warn(`[DriveResumable] Chunk transfer paused (${chunkErr.message}). Querying Google for resume offset...`);

        // Fault-tolerance: Query Google Drive to check how many bytes arrived safely
        try {
          const statusRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
              'Content-Range': `bytes */${totalSize}`
            }
          });
          if (statusRes.status === 308) {
            const rangeHeader = statusRes.headers.get('Range');
            if (rangeHeader) {
              const m = rangeHeader.match(/bytes=0-(\d+)/);
              if (m && m[1]) {
                startByte = parseInt(m[1], 10) + 1;
                chunkSuccess = true;
                console.log(`[DriveResumable] Resumed successfully from byte ${startByte}`);
                break;
              }
            }
          } else if (statusRes.status === 200 || statusRes.status === 201) {
            chunkSuccess = true;
            startByte = totalSize;
            try { finalFileData = await statusRes.json(); } catch (e) {}
            break;
          }
        } catch (statusErr) {}

        await new Promise(r => setTimeout(r, 2000));
      }
    }

    if (!chunkSuccess && startByte < totalSize) {
      throw new Error(`Failed to upload chunk starting at byte ${startByte} after 3 attempts`);
    }

    if (finalFileData) {
      const fileId = finalFileData.id || initRes.fileId;
      console.log(`[DriveResumable] ✓ Direct chunked upload finished successfully! File ID: ${fileId}`);
      if (onProgress) onProgress('Upload complete!');
      return {
        success: true,
        fileId: fileId,
        filename: finalFileData.name || filename,
        webViewLink: finalFileData.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
        downloadUrl: finalFileData.webContentLink || `https://drive.google.com/uc?export=download&id=${fileId}`
      };
    }
  }

  throw new Error('Upload stream ended without completion response');
}

/**
 * Uploads a video highlight directly to the user's 2 TB Google Drive folder
 * via the Google Apps Script Private Mail Slot without requiring user sign-in popups.
 * Files are organized by match in dedicated subfolders, named by set, score, and comment.
 */
export async function uploadHighlightViaMailSlot(clip, videoBlob = null, onProgress = null) {
  if (!clip) throw new Error('Missing clip');

  let blob = videoBlob;
  if (!blob && clip.id) {
    try {
      blob = await getLocalClipBlob(clip.id);
    } catch (e) {
      console.warn('[DriveMailSlot] Could not read from IndexedDB:', e);
    }
  }

  if (!blob && clip.videoUrl) {
    try {
      const res = await fetch(clip.videoUrl);
      if (res.ok) blob = await res.blob();
    } catch (e) {
      console.warn('[DriveMailSlot] Could not fetch videoUrl:', e);
    }
  }

  if (!blob) {
    throw new Error('No video data found to upload to Google Drive');
  }

  // Ensure blob has a valid container header (strips any leading fragmented moof boxes)
  blob = await sanitizeVideoBlob(blob);

  // Match folder identical to Hub View: "[Date] vs. [Opponent]"
  const matchFolder = clip.matchFolder || getMatchFolderName({
    date: clip.matchDate || clip.date,
    opponent: clip.opponent
  });

  // Highlight filename sorted chronologically: "Set 01 (05-03) - Comment.mp4"
  const filename = clip.filename || formatHighlightFilename(clip);

  // 1. Primary: Direct Resumable Chunked Upload (Zero Base64, Fast, Fault-Tolerant)
  try {
    const resumableRes = await uploadHighlightDirectResumable(clip, blob, matchFolder, filename, onProgress);
    if (resumableRes && resumableRes.success && resumableRes.fileId) {
      return resumableRes;
    }
  } catch (resumableErr) {
    console.warn(`[DriveMailSlot] Direct resumable upload not active or awaiting script update (${resumableErr.message}). Engaging standard upload fallback...`);
  }

  // 2. Legacy Fallback: Standard Base64 POST
  if (onProgress) onProgress('Encoding video...');
  const base64 = await blobToBase64(blob);

  if (onProgress) onProgress('Uploading to Google Drive...');
  const payload = {
    clipId: clip.id,
    matchFolder,
    filename,
    mimeType: blob.type || 'video/mp4',
    base64
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  let response;
  try {
    response = await fetch(APPS_SCRIPT_MAILSLOT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      signal: controller.signal
    });
  } catch (netErr) {
    if (netErr.name === 'AbortError') {
      throw new Error(`Google Apps Script Mail Slot timed out (>120s) for ${filename}`);
    }
    throw netErr;
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch (parseErr) {
    throw new Error(`Mail slot returned invalid JSON (HTTP ${response.status}): ${text.slice(0, 200)}`);
  }

  if (!result.success) {
    throw new Error(result.error || 'Google Apps Script mail slot returned an error');
  }

  return {
    success: true,
    fileId: result.fileId,
    filename: result.filename || filename,
    webViewLink: result.webViewLink,
    downloadUrl: result.downloadUrl || `https://drive.google.com/uc?export=download&id=${result.fileId}`
  };
}

export function getCachedDriveToken() {
  try {
    return sessionStorage.getItem(DRIVE_TOKEN_KEY);
  } catch (e) {
    return null;
  }
}

export function setCachedDriveToken(token) {
  try {
    if (token) {
      sessionStorage.setItem(DRIVE_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(DRIVE_TOKEN_KEY);
    }
  } catch (e) {}
}

export async function requestDriveAccessToken() {
  const cached = getCachedDriveToken();
  if (cached) return cached;

  try {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;
    if (token) {
      setCachedDriveToken(token);
      return token;
    }
  } catch (err) {
    console.warn('[DriveService] Google Drive auth popup failed or was closed:', err);
  }
  return null;
}

export async function uploadClipToGoogleDrive(clip, folderId, accessToken, onProgress = null) {
  if (!clip || !accessToken) throw new Error('Missing clip or Google Drive access token');

  const cleanOpponent = (clip.opponent || 'Match').replace(/[^a-zA-Z0-9]/g, '_');
  const cleanLabel = (clip.label || 'Highlight').replace(/[^a-zA-Z0-9]/g, '_');
  const cleanScore = (clip.score || '0-0').replace(/\s+/g, '');
  const filename = `${cleanOpponent}_Set${clip.set || 1}_${cleanScore}_${cleanLabel}.mp4`;

  // Fetch the video blob
  const videoUrl = clip.videoUrl || '/videos/sample-highlight.mp4';
  const res = await fetch(videoUrl);
  if (!res.ok) throw new Error(`Could not fetch video from ${videoUrl}`);
  const blob = await res.blob();

  const metadata = {
    name: filename,
    mimeType: 'video/mp4',
    parents: [folderId]
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob, filename);

  const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    body: form
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Google Drive API upload failed (${uploadRes.status}): ${errText}`);
  }

  const driveData = await uploadRes.json();
  return {
    fileId: driveData.id,
    webViewLink: driveData.webViewLink || `https://drive.google.com/file/d/${driveData.id}/view`,
    filename
  };
}

export async function downloadClipLocally(clip, opponentName = 'Match') {
  const cleanOpponent = opponentName.replace(/[^a-zA-Z0-9]/g, '_');
  const cleanLabel = (clip.label || 'Highlight').replace(/[^a-zA-Z0-9]/g, '_');
  const cleanScore = (clip.score || '0-0').replace(/\s+/g, '');
  const filename = `${cleanOpponent}_Set${clip.set || 1}_${cleanScore}_${cleanLabel}.mp4`;

  const videoUrl = clip.videoUrl || '/videos/sample-highlight.mp4';
  const res = await fetch(videoUrl);
  const blob = await res.blob();
  const file = new File([blob], filename, { type: 'video/mp4' });

  // Native mobile share sheet (iOS/Android)
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `${clip.label || 'Highlight'}`,
        text: `Highlight from match vs. ${opponentName}`
      });
      return true;
    } catch (e) {
      if (e.name === 'AbortError') return true;
    }
  }

  // Desktop browser direct download
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  }, 1200);
  return true;
}
