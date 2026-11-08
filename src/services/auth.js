// ==========================================================================
// GameStreamer Broadcaster Authentication Service
// Reliable In-App PIN Verification (No Popups, No Blank Windows, Zero Hassle)
// ==========================================================================

const BROADCASTER_KEY = 'gamestreamer_broadcaster_unlocked_v1';
const DEFAULT_BROADCASTER_PIN = '1234';

class AuthService {
  constructor() {
    // Purge legacy permanent localStorage token so existing devices revert to watcher view by default
    try {
      localStorage.removeItem(BROADCASTER_KEY);
      sessionStorage.removeItem(BROADCASTER_KEY);
    } catch (e) {}

    // Initial state is ALWAYS locked (Watcher Mode)
    this.isUnlocked = false;
    this.listeners = new Set();
  }

  isBroadcaster() {
    return this.isUnlocked;
  }

  getUser() {
    if (this.isUnlocked) {
      return {
        name: 'Broadcaster',
        id: 'broadcaster_primary',
        role: 'broadcaster'
      };
    }
    return null;
  }

  unlock(enteredPin) {
    const pin = (enteredPin || '').trim();
    if (pin === DEFAULT_BROADCASTER_PIN || pin === '1234') {
      this.isUnlocked = true;
      this.notify();
      return true;
    }
    return false;
  }

  lock() {
    this.isUnlocked = false;
    try {
      localStorage.removeItem(BROADCASTER_KEY);
      sessionStorage.removeItem(BROADCASTER_KEY);
    } catch (e) {}
    this.notify();
  }

  notify() {
    const user = this.getUser();
    this.listeners.forEach(l => {
      try { l(user); } catch (e) {}
    });
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Request Broadcaster access via in-app frosted modal
  requestBroadcasterAccess() {
    if (this.isBroadcaster()) {
      return Promise.resolve(this.getUser());
    }

    return new Promise((resolve) => {
      // Remove any existing modal
      const existing = document.querySelector('#broadcaster-pin-modal');
      if (existing) existing.remove();

      const modal = document.createElement('div');
      modal.id = 'broadcaster-pin-modal';
      modal.className = 'apple-modal-overlay';
      modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px;';

      modal.innerHTML = `
        <div class="apple-modal frosted-glass" style="max-width: 360px; width: 100%; padding: 24px; border-radius: 20px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.5); background: rgba(28,28,30,0.92); border: 1px solid rgba(255,255,255,0.14);">
          <div style="font-size: 36px; margin-bottom: 8px;">🔐</div>
          <h2 style="font-size: 19px; font-weight: 700; margin: 0 0 6px 0; color: #fff;">Broadcaster Access</h2>
          <p style="font-size: 13px; color: var(--text-secondary, #999); margin: 0 0 18px 0; line-height: 1.45;">
            Enter the 4-digit Broadcaster PIN to go live or manage matches.
          </p>

          <input type="password" id="pin-input" maxlength="8" placeholder="Enter PIN (Default: 1234)" autofocus
            style="width: 100%; box-sizing: border-box; text-align: center; font-size: 18px; letter-spacing: 4px; padding: 12px 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.4); color: #fff; margin-bottom: 8px; outline: none;" />

          <div id="pin-error" style="color: #ff453a; font-size: 12px; margin-bottom: 14px; min-height: 16px; display: none;">
            Incorrect PIN. Try 1234.
          </div>

          <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 10px;">
            <button class="apple-btn" id="btn-cancel-pin" style="flex: 1; padding: 10px 14px; font-size: 14px; border-radius: 10px;">Cancel</button>
            <button class="apple-btn apple-btn-primary" id="btn-submit-pin" style="flex: 1; padding: 10px 14px; font-size: 14px; font-weight: 600; border-radius: 10px;">Unlock</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const pinInput = modal.querySelector('#pin-input');
      const pinError = modal.querySelector('#pin-error');
      const btnCancel = modal.querySelector('#btn-cancel-pin');
      const btnSubmit = modal.querySelector('#btn-submit-pin');

      const close = () => {
        modal.remove();
        resolve(null);
      };

      btnCancel.onclick = close;
      modal.onclick = (e) => {
        if (e.target === modal) close();
      };

      const submit = () => {
        const val = pinInput.value;
        if (this.unlock(val)) {
          modal.remove();
          resolve(this.getUser());
        } else {
          pinError.style.display = 'block';
          pinInput.value = '';
          pinInput.focus();
        }
      };

      btnSubmit.onclick = submit;
      pinInput.onkeydown = (e) => {
        if (e.key === 'Enter') submit();
      };

      setTimeout(() => pinInput.focus(), 50);
    });
  }

  // Backwards compatibility alias for components calling signInWithGoogle
  async signInWithGoogle() {
    return this.requestBroadcasterAccess();
  }

  signOut() {
    this.lock();
  }
}

export const authService = new AuthService();
