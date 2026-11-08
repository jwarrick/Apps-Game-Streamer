// ==========================================================================
// RecoveryView: Emergency Phone Video Storage Extraction & Diagnostics
// Recovers local video blobs from iPhone IndexedDB and enables 1-tap transfer
// to Mac over local WiFi, direct Google Drive backup, and database repair.
// ==========================================================================

import { store } from '../services/store.js';
import { uploadHighlightViaMailSlot, formatHighlightFilename } from '../services/drive.js';
import { db } from '../services/firebase.js';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { openMediaDB, getAllLocalClipBlobs, deleteLocalClipBlob, clearAllLocalClipBlobs } from '../services/mediaStorage.js';

const DB_NAME = 'gamestreamer_media_db';
const STORE_NAME = 'highlight_videos';
const DEFAULT_MAC_IP = '192.168.1.86';
const MAC_PORT = 8765;

export function renderRecoveryView(container, navigate) {
  container.innerHTML = `
    <div style="min-height: 100vh; background: #0b0f14; color: #fff; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <!-- Header -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.15);">
        <div>
          <button id="btn-back-hub" style="background: none; border: none; color: #0a84ff; font-size: 16px; font-weight: 600; cursor: pointer; padding: 0; margin-bottom: 6px;">← Back to Hub</button>
          <h1 style="margin: 0; font-size: 22px; font-weight: 700;">🛠️ Phone Video Recovery Tool</h1>
          <div style="font-size: 12px; color: #8e8e93; margin-top: 4px;">Inspect and extract camera video recordings stored on this phone</div>
        </div>
        <button id="btn-refresh-scan" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; border-radius: 8px; padding: 8px 14px; font-size: 13px; font-weight: 600; cursor: pointer;">🔄 Scan Storage</button>
      </div>

      <!-- Mac Connection Banner -->
      <div id="mac-status-box" style="padding: 14px 16px; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); margin-bottom: 20px;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div id="mac-indicator" style="width: 12px; height: 12px; border-radius: 50%; background: #ffd60a;"></div>
            <div>
              <div id="mac-status-title" style="font-weight: 600; font-size: 14px;">Checking Mac Connection...</div>
              <div id="mac-status-sub" style="font-size: 11px; color: #8e8e93;">Target: http://${DEFAULT_MAC_IP}:${MAC_PORT}</div>
            </div>
          </div>
          <button id="btn-test-mac" style="background: #0a84ff; border: none; color: #fff; border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer;">Test Mac Connection</button>
        </div>
      </div>

      <!-- Action Panel -->
      <div id="recovery-actions" style="display: none; margin-bottom: 24px; padding: 16px; border-radius: 12px; background: rgba(48,209,88,0.1); border: 1px solid #30d158;">
        <div style="font-size: 16px; font-weight: 700; color: #30d158; margin-bottom: 6px;">🎉 Video Recordings Found in Storage!</div>
        <div id="found-summary" style="font-size: 13px; color: #d1d1d6; margin-bottom: 14px;"></div>
        
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <button id="btn-transfer-mac" style="background: #30d158; color: #000; border: none; border-radius: 10px; padding: 14px 16px; font-size: 15px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
            🚀 1-Tap Transfer All to My Mac (192.168.1.86)
          </button>
          <button id="btn-upload-drive" style="background: #0a84ff; color: #fff; border: none; border-radius: 10px; padding: 12px 16px; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
            ☁️ Force Upload All to Google Drive
          </button>
          <button id="btn-clear-all" style="background: rgba(255,69,58,0.12); border: 1px solid rgba(255,69,58,0.35); color: #ff453a; border-radius: 10px; padding: 10px 16px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
            🗑️ Clear / Discard All Local Video Recordings
          </button>
        </div>
      </div>

      <!-- Progress Box -->
      <div id="progress-box" style="display: none; margin-bottom: 20px; padding: 14px; border-radius: 10px; background: rgba(10,132,255,0.12); border: 1px solid #0a84ff;">
        <div id="progress-label" style="font-size: 13px; font-weight: 600; color: #0a84ff; margin-bottom: 6px;">Processing...</div>
        <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.15); border-radius: 4px; overflow: hidden;">
          <div id="progress-fill" style="width: 0%; height: 100%; background: #30d158; transition: width 0.2s ease;"></div>
        </div>
      </div>

      <!-- Found Clips List -->
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 16px; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
          <span>📱 Clips in Phone Storage</span>
          <span id="badge-clip-count" style="font-size: 12px; padding: 2px 8px; border-radius: 10px; background: rgba(255,255,255,0.1); color: #8e8e93;">Scanning...</span>
        </h2>
        <div id="clips-list" style="display: flex; flex-direction: column; gap: 10px;">
          <div style="text-align: center; padding: 30px 10px; color: #8e8e93; font-size: 13px;">Scanning IndexedDB storage on this device...</div>
        </div>
      </div>

      <!-- Live Diagnostics Log -->
      <div style="margin-top: 30px;">
        <h3 style="font-size: 13px; font-weight: 700; color: #8e8e93; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Live Storage & System Logs</h3>
        <div id="diagnostics-log" style="background: #000; border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 12px; font-family: monospace; font-size: 11px; color: #30d158; max-height: 200px; overflow-y: auto; white-space: pre-wrap; word-break: break-all;"></div>
      </div>
    </div>
  `;

  const btnBack = container.querySelector('#btn-back-hub');
  const btnRefresh = container.querySelector('#btn-refresh-scan');
  const btnTestMac = container.querySelector('#btn-test-mac');
  const btnTransferMac = container.querySelector('#btn-transfer-mac');
  const btnUploadDrive = container.querySelector('#btn-upload-drive');
  const btnClearAll = container.querySelector('#btn-clear-all');
  const macIndicator = container.querySelector('#mac-indicator');
  const macStatusTitle = container.querySelector('#mac-status-title');
  const macStatusSub = container.querySelector('#mac-status-sub');
  const recoveryActions = container.querySelector('#recovery-actions');
  const foundSummary = container.querySelector('#found-summary');
  const progressBox = container.querySelector('#progress-box');
  const progressLabel = container.querySelector('#progress-label');
  const progressFill = container.querySelector('#progress-fill');
  const badgeClipCount = container.querySelector('#badge-clip-count');
  const clipsList = container.querySelector('#clips-list');
  const logBox = container.querySelector('#diagnostics-log');

  btnBack.onclick = () => navigate('/');
  btnRefresh.onclick = () => scanPhoneStorage();
  btnTestMac.onclick = () => checkMacServer();

  let discoveredClips = [];
  let isMacConnected = false;

  function appendLog(msg) {
    const time = new Date().toLocaleTimeString();
    const line = `[${time}] ${msg}\n`;
    logBox.textContent += line;
    logBox.scrollTop = logBox.scrollHeight;
    console.log('[RecoveryView]', msg);
  }

  // --- 1. Check Mac Recovery Server Connection ---
  async function checkMacServer() {
    macStatusTitle.textContent = 'Testing connection to Mac...';
    macIndicator.style.background = '#ffd60a';
    appendLog(`Pinging Mac receiver at http://${DEFAULT_MAC_IP}:${MAC_PORT}/status...`);

    const isHttps = window.location.protocol === 'https:';
    if (isHttps) {
      appendLog(`ℹ️ Note: This app is loaded over HTTPS. Mobile Safari blocks HTTP requests to local IPs due to Mixed Content / Local Network security.`);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(`http://${DEFAULT_MAC_IP}:${MAC_PORT}/status`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        isMacConnected = true;
        macIndicator.style.background = '#30d158';
        macStatusTitle.textContent = '🟢 Connected to Mac (192.168.1.86)!';
        macStatusSub.textContent = `Receiver active on port ${MAC_PORT}. Saved files: ${data.recoveredFiles.length}`;
        appendLog(`✓ Mac connection verified! Server has ${data.recoveredFiles.length} existing files.`);
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (e) {
      isMacConnected = false;
      macIndicator.style.background = '#ff453a';
      macStatusTitle.textContent = '⚠️ Mac Receiver Not Reachable';
      if (isHttps) {
        macStatusSub.textContent = `HTTPS blocks direct HTTP connections to ${DEFAULT_MAC_IP}. Use "Force Upload All to Google Drive" below!`;
      } else {
        macStatusSub.textContent = `Ensure your Mac and phone are on the same WiFi and node script is running. (${e.message})`;
      }
      appendLog(`⚠️ Mac ping failed: ${e.message} (HTTPS mixed-content policy)`);
    }
  }

  // --- 2. Deep Scan of Phone IndexedDB ---
  async function scanPhoneStorage() {
    appendLog('Starting scan of IndexedDB storage on phone...');
    clipsList.innerHTML = `<div style="text-align: center; padding: 20px; color: #8e8e93;">Scanning...</div>`;
    discoveredClips = [];

    if (typeof indexedDB === 'undefined') {
      appendLog('❌ IndexedDB is not supported on this browser context.');
      clipsList.innerHTML = `<div style="color: #ff453a; padding: 16px;">IndexedDB is unavailable.</div>`;
      return;
    }

    // List all databases if API is available
    if (indexedDB.databases) {
      try {
        const dbs = await indexedDB.databases();
        appendLog(`IndexedDB databases found: ${dbs.map(d => `${d.name} (v${d.version})`).join(', ') || 'none'}`);
      } catch (e) {
        appendLog(`Could not list databases: ${e.message}`);
      }
    }

    try {
      const dbInstance = await openMediaDB();
      if (!dbInstance) {
        appendLog(`❌ Could not open IndexedDB ${DB_NAME}`);
        clipsList.innerHTML = `<div style="color: #ffd60a; padding: 16px;">Could not open media storage database.</div>`;
        return;
      }

      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        appendLog(`❌ Store "${STORE_NAME}" does not exist in ${DB_NAME}`);
        clipsList.innerHTML = `<div style="color: #ffd60a; padding: 16px;">Object store "${STORE_NAME}" not found. No clips have been saved yet.</div>`;
        return;
      }

      appendLog(`✓ Opened database "${DB_NAME}", inspecting store "${STORE_NAME}"...`);

      const tx = dbInstance.transaction(STORE_NAME, 'readonly');
      const storeObj = tx.objectStore(STORE_NAME);

      const keys = await new Promise((resolve, reject) => {
        const req = storeObj.getAllKeys();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      appendLog(`Found ${keys.length} keys in IndexedDB "${STORE_NAME}": [${keys.join(', ')}]`);

      const matchState = store.getState();
      const edgewoodMatch = (matchState.matches || []).find(m => m.opponent && m.opponent.toLowerCase().includes('edgewood'));
      const allHighlightMeta = (edgewoodMatch ? edgewoodMatch.highlights : []) || [];

      let totalBytes = 0;

      for (const key of keys) {
        const record = await new Promise((resolve) => {
          const req = storeObj.get(key);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        });

        if (!record) continue;

        let blob = null;
        if (record instanceof Blob) {
          blob = record;
        } else if (record instanceof ArrayBuffer) {
          blob = new Blob([record], { type: 'video/mp4' });
        } else if (record && record.buffer instanceof ArrayBuffer) {
          blob = new Blob([record.buffer], { type: record.type || 'video/mp4' });
        } else if (record && record.blob && record.blob instanceof Blob) {
          blob = record.blob;
        }

        if (!blob) continue;

        const size = blob.size || record.size || 0;
        totalBytes += size;

        // Try to cross-reference with match highlights or direct record metadata
        const meta = allHighlightMeta.find(h => h.id === key || h.localBlobId === key) || {};
        const label = record.label || meta.label || 'Highlight';
        const set = record.set || meta.set || 1;
        const score = record.score || meta.score || '0-0';
        const opponent = record.opponent || (edgewoodMatch ? edgewoodMatch.opponent : 'Match');
        const filename = `Set ${String(set).padStart(2, '0')} (${score.replace(/\s+/g, '')}) - ${label}.mp4`.replace(/[/\\?%*:|"<>]/g, '');

        discoveredClips.push({
          key,
          blob,
          sizeBytes: size,
          sizeMb: (size / (1024 * 1024)).toFixed(2),
          meta,
          label,
          set,
          score,
          opponent,
          filename,
          syncedToDrive: Boolean(record.syncedToDrive),
          driveFileId: record.driveFileId || null
        });
      }

      badgeClipCount.textContent = `${discoveredClips.length} found (${(totalBytes / (1024 * 1024)).toFixed(1)} MB)`;
      badgeClipCount.style.background = discoveredClips.length > 0 ? '#30d158' : 'rgba(255,255,255,0.1)';
      badgeClipCount.style.color = discoveredClips.length > 0 ? '#000' : '#8e8e93';

      if (discoveredClips.length > 0) {
        recoveryActions.style.display = 'block';
        foundSummary.textContent = `${discoveredClips.length} video recordings totaling ${(totalBytes / (1024 * 1024)).toFixed(1)} MB were discovered in this phone's IndexedDB storage!`;
        renderClipsList();
        appendLog(`✓ Scan complete: ${discoveredClips.length} clips ready for extraction.`);
      } else {
        recoveryActions.style.display = 'none';
        clipsList.innerHTML = `
          <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 10px; border: 1px dashed rgba(255,255,255,0.2); text-align: center;">
            <div style="font-size: 15px; font-weight: 600; color: #ffd60a; margin-bottom: 6px;">0 Clips in Storage</div>
            <div style="font-size: 12px; color: #8e8e93; line-height: 1.4;">No recordings were found under "${STORE_NAME}". Check if Safari data was recently cleared or if clips were stored under a different origin.</div>
          </div>
        `;
        appendLog('Scan finished: 0 clips found.');
      }
    } catch (err) {
      appendLog(`❌ Storage scan error: ${err.message}`);
      clipsList.innerHTML = `<div style="color: #ff453a; padding: 16px;">Error scanning storage: ${err.message}</div>`;
    }
  }

  function renderClipsList() {
    clipsList.innerHTML = discoveredClips.map((c, i) => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-radius: 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);">
        <div>
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 2px;">${c.label} (${c.score})</div>
          <div style="font-size: 11px; color: #8e8e93;">Set ${c.set} • ${c.sizeMb} MB • ID: ${c.key}</div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn-play-clip" data-index="${i}" style="background: rgba(10,132,255,0.2); border: 1px solid #0a84ff; color: #0a84ff; border-radius: 6px; padding: 6px 10px; font-size: 12px; font-weight: 600; cursor: pointer;">▶ Play</button>
          <button class="btn-share-clip" data-index="${i}" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; border-radius: 6px; padding: 6px 10px; font-size: 12px; font-weight: 600; cursor: pointer;">💾 Save</button>
          <button class="btn-delete-clip" data-index="${i}" style="background: rgba(255,69,58,0.15); border: 1px solid rgba(255,69,58,0.4); color: #ff453a; border-radius: 6px; padding: 6px 10px; font-size: 12px; font-weight: 600; cursor: pointer;">🗑️</button>
        </div>
      </div>
    `).join('');

    clipsList.querySelectorAll('.btn-play-clip').forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.dataset.index, 10);
        const item = discoveredClips[idx];
        if (!item || !item.blob) return;
        const blobUrl = URL.createObjectURL(item.blob);
        const w = window.open(blobUrl, '_blank');
        if (!w) window.location.href = blobUrl;
      };
    });

    clipsList.querySelectorAll('.btn-delete-clip').forEach(btn => {
      btn.onclick = async () => {
        const idx = parseInt(btn.dataset.index, 10);
        const item = discoveredClips[idx];
        if (!item) return;
        if (!confirm(`Delete "${item.filename}" from phone storage?`)) return;
        await deleteLocalClipBlob(item.key);
        appendLog(`🗑️ Deleted ${item.filename} from IndexedDB.`);
        scanPhoneStorage();
      };
    });

    clipsList.querySelectorAll('.btn-share-clip').forEach(btn => {
      btn.onclick = async () => {
        const idx = parseInt(btn.dataset.index, 10);
        const item = discoveredClips[idx];
        if (!item || !item.blob) return;

        try {
          const file = new File([item.blob], item.filename, { type: 'video/mp4' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: item.filename,
              text: `GameStreamer Highlight: ${item.label} (${item.score})`
            });
          } else {
            const url = URL.createObjectURL(item.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = item.filename;
            a.click();
          }
        } catch (e) {
          appendLog(`Save failed: ${e.message}`);
        }
      };
    });
  }

  if (btnClearAll) {
    btnClearAll.onclick = async () => {
      if (!confirm('Are you sure you want to delete all local highlight video recordings from this phone? This cannot be undone.')) return;
      await clearAllLocalClipBlobs();
      appendLog('🗑️ Cleared all local recordings from IndexedDB.');
      scanPhoneStorage();
    };
  }

  // --- 3. 1-Tap Transfer All to Mac over WiFi ---
  btnTransferMac.onclick = async () => {
    if (discoveredClips.length === 0) return;
    appendLog(`🚀 Starting WiFi transfer of ${discoveredClips.length} clips to Mac at http://${DEFAULT_MAC_IP}:${MAC_PORT}...`);

    progressBox.style.display = 'block';
    btnTransferMac.disabled = true;
    btnTransferMac.style.opacity = '0.6';

    let successCount = 0;

    for (let i = 0; i < discoveredClips.length; i++) {
      const item = discoveredClips[i];
      const pct = Math.round(((i + 1) / discoveredClips.length) * 100);
      progressFill.style.width = `${pct}%`;
      progressLabel.textContent = `[${i + 1}/${discoveredClips.length}] Transferring ${item.filename} (${item.sizeMb} MB)...`;
      appendLog(`Sending [${i + 1}/${discoveredClips.length}] "${item.filename}" to Mac...`);

      try {
        const res = await fetch(`http://${DEFAULT_MAC_IP}:${MAC_PORT}/upload?name=${encodeURIComponent(item.filename)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'video/mp4',
            'X-Filename': item.filename,
            'X-Clip-Id': item.key
          },
          body: item.blob
        });

        if (res.ok) {
          successCount++;
          appendLog(`✓ Saved to Mac: ${item.filename}`);
        } else {
          appendLog(`❌ Mac returned HTTP ${res.status} for ${item.filename}`);
        }
      } catch (err) {
        appendLog(`❌ Network error sending to Mac: ${err.message}`);
      }
    }

    progressLabel.textContent = `✓ Transfer Complete: ${successCount} of ${discoveredClips.length} clips saved to your Mac!`;
    appendLog(`🎉 Transfer finished! Successfully saved ${successCount} clips into /recovered_videos on your Mac.`);
    btnTransferMac.disabled = false;
    btnTransferMac.style.opacity = '1';
  };

  // --- 4. Force Upload All to Google Drive ---
  btnUploadDrive.onclick = async () => {
    if (discoveredClips.length === 0) return;
    appendLog(`☁️ Starting sequential Google Drive backup of ${discoveredClips.length} clips...`);

    progressBox.style.display = 'block';
    btnUploadDrive.disabled = true;
    btnUploadDrive.style.opacity = '0.6';

    let uploadedCount = 0;
    const matchState = store.getState();
    const edgewoodMatch = (matchState.matches || []).find(m => m.opponent && m.opponent.toLowerCase().includes('edgewood'));
    const matchId = edgewoodMatch ? edgewoodMatch.id : 'match_1793145552168';
    const matchFolder = edgewoodMatch ? (edgewoodMatch.folderName || `${edgewoodMatch.date} vs. ${edgewoodMatch.opponent}`) : 'Today vs. Edgewood';

    for (let i = 0; i < discoveredClips.length; i++) {
      const item = discoveredClips[i];
      const pct = Math.round(((i + 1) / discoveredClips.length) * 100);
      progressFill.style.width = `${pct}%`;
      progressLabel.textContent = `[${i + 1}/${discoveredClips.length}] Uploading ${item.label} to Google Drive...`;
      appendLog(`Uploading [${i + 1}/${discoveredClips.length}] "${item.filename}" to Drive...`);

      try {
        const driveRes = await uploadHighlightViaMailSlot({
          id: item.key,
          matchFolder,
          matchDate: edgewoodMatch ? edgewoodMatch.date : 'Today',
          opponent: edgewoodMatch ? edgewoodMatch.opponent : 'Edgewood',
          set: item.set,
          score: item.score,
          label: item.label,
          filename: item.filename
        }, item.blob, (status) => {
          progressLabel.textContent = `[${i + 1}/${discoveredClips.length}] ${status}`;
        });

        if (driveRes && driveRes.success && driveRes.fileId) {
          uploadedCount++;
          appendLog(`✓ Drive upload succeeded: ${item.filename} (File ID: ${driveRes.fileId})`);

          // Update local state and Firestore
          const cloudDetails = {
            videoUrl: driveRes.downloadUrl,
            driveFileId: driveRes.fileId,
            driveUrl: driveRes.webViewLink,
            driveDownloadUrl: driveRes.downloadUrl,
            storageTier: 'synced',
            cloudUploaded: true
          };

          try {
            store.updateClipCloudDetails(matchId, item.key, cloudDetails);
          } catch (e) {}

          try {
            const matchDocRef = doc(db, 'matches', matchId);
            const snap = await getDoc(matchDocRef);
            if (snap.exists()) {
              const data = snap.data();
              const updatedHighlights = (data.highlights || []).map(h => {
                if (h.id === item.key) return { ...h, ...cloudDetails };
                return h;
              });
              await updateDoc(matchDocRef, {
                highlights: updatedHighlights,
                updatedAt: Date.now()
              });
            }
          } catch (dbErr) {
            appendLog(`Firestore update warning: ${dbErr.message}`);
          }
        } else {
          appendLog(`❌ Drive returned error for ${item.filename}`);
        }
      } catch (err) {
        appendLog(`❌ Drive upload failed: ${err.message}`);
      }
    }

    progressLabel.textContent = `✓ Drive Backup Complete: ${uploadedCount} of ${discoveredClips.length} highlights synced!`;
    appendLog(`🎉 Google Drive sync complete! ${uploadedCount} clips backed up.`);
    btnUploadDrive.disabled = false;
    btnUploadDrive.style.opacity = '1';
  };

  // Run initial checks on mount
  checkMacServer();
  scanPhoneStorage();

  return () => {
    // Cleanup if any
  };
}
