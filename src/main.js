// ==========================================================================
// GameStreamer Main Entry Point & Router
// ==========================================================================

import { renderHubView } from './components/HubView.js';
import { renderStreamerView } from './components/StreamerView.js';
import { renderWatcherView } from './components/WatcherView.js';

const app = document.getElementById('app');
let cleanupCurrentView = null;

function navigate(route) {
  window.location.hash = route;
}

function handleRoute() {
  const hash = window.location.hash.slice(1) || '/';

  if (cleanupCurrentView) {
    cleanupCurrentView();
    cleanupCurrentView = null;
  }

  app.innerHTML = '';

  if (hash === '/stream') {
    cleanupCurrentView = renderStreamerView(app, navigate);
  } else if (hash === '/watch') {
    cleanupCurrentView = renderWatcherView(app, navigate);
  } else {
    cleanupCurrentView = renderHubView(app, navigate);
  }
}

window.addEventListener('hashchange', handleRoute);
window.addEventListener('DOMContentLoaded', handleRoute);
handleRoute();
