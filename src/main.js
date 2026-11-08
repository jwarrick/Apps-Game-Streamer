// ==========================================================================
// GameStreamer Main Entry Point & Router
// ==========================================================================

import { renderHubView } from './components/HubView.js';
import { renderStreamerView } from './components/StreamerView.js';
import { renderWatcherView } from './components/WatcherView.js';
import { renderRecoveryView } from './components/RecoveryView.js';
import { HighlightReelPlayer } from './components/HighlightReelPlayer.js';
import { store } from './services/store.js';
import { syncPendingClipsToDrive, isSyncInProgress, triggerAutoSyncSweep, resetUploadBackoff } from './services/mediaStorage.js';

if (typeof window !== 'undefined') {
  window.store = store;
  window.HighlightReelPlayer = HighlightReelPlayer;

  // Dedicated, calm background Outbox sync sweep:
  // Detects any unsynced clips on phone flash storage and pushes them sequentially to Drive
  const performSyncCheck = () => {
    if (isSyncInProgress()) {
      return;
    }
    triggerAutoSyncSweep().catch(err => {
      console.warn('[Main] Auto-sync background sweep error:', err);
    });
  };

  // Mobile Safari / PWA auto-update checker to bust aggressive iOS memory caches
  const clientBuildTime = typeof __APP_BUILD_TIME__ !== 'undefined' ? __APP_BUILD_TIME__ : Date.now();
  const checkForUpdates = async () => {
    if (isSyncInProgress()) {
      console.log('[Update] Postponing version update check: Drive sync is actively in progress.');
      return;
    }
    try {
      const res = await fetch(`/version.json?_t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data && data.buildTime && data.buildTime > clientBuildTime) {
          if (isSyncInProgress()) {
            console.log('[Update] Drive sync active; postponing app reload.');
            return;
          }
          console.log(`[Update] New app version detected (built at ${data.buildTime}). Reloading...`);
          window.location.reload(true);
        }
      }
    } catch (e) {}
  };

  window.addEventListener('online', () => {
    resetUploadBackoff();
    performSyncCheck();
  });
  window.addEventListener('focus', () => {
    checkForUpdates();
    performSyncCheck();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForUpdates();
      performSyncCheck();
    }
  });
  setInterval(checkForUpdates, 60000);
  setInterval(performSyncCheck, 60000); // Calm 60s sweep for gym battery and radio conservation
  setTimeout(checkForUpdates, 1500);
  setTimeout(performSyncCheck, 2500);
}

const app = document.getElementById('app');
let cleanupCurrentView = null;
let currentRenderedHash = null;

function navigate(route) {
  const targetHash = route.startsWith('#') ? route : '#' + route;
  if (window.location.hash !== targetHash) {
    window.location.hash = targetHash;
  }
  handleRoute();
}

function handleRoute() {
  const fullHash = window.location.hash.slice(1) || '/';
  const hash = fullHash.split('?')[0];
  if (currentRenderedHash === fullHash && app.children.length > 0) {
    return;
  }
  currentRenderedHash = fullHash;

  if (cleanupCurrentView) {
    try {
      cleanupCurrentView();
    } catch (e) {
      console.warn('Error in cleanupCurrentView:', e);
    }
    cleanupCurrentView = null;
  }

  app.innerHTML = '';

  if (hash === '/stream') {
    cleanupCurrentView = renderStreamerView(app, navigate);
  } else if (hash === '/watch') {
    cleanupCurrentView = renderWatcherView(app, navigate);
  } else if (hash === '/recover' || hash === '/recovery') {
    cleanupCurrentView = renderRecoveryView(app, navigate);
  } else {
    cleanupCurrentView = renderHubView(app, navigate);
  }
}

window.addEventListener('hashchange', handleRoute);
window.addEventListener('popstate', handleRoute);
window.addEventListener('DOMContentLoaded', handleRoute);
handleRoute();
