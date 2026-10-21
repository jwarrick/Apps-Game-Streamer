// ==========================================================================
// GameStreamer Authentication Service (Google Sign-In)
// ==========================================================================

import { store } from './store.js';

class AuthService {
  constructor() {
    this.user = this.loadSavedUser();
  }

  loadSavedUser() {
    try {
      const saved = localStorage.getItem('gamestreamer_auth_user');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Could not load saved user', e);
    }
    return null;
  }

  saveUser(user) {
    this.user = user;
    if (user) {
      localStorage.setItem('gamestreamer_auth_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('gamestreamer_auth_user');
    }
  }

  getUser() {
    return this.user;
  }

  isBroadcaster() {
    return !!this.user;
  }

  // Trigger Google Sign-In directly with zero extra menus
  async signInWithGoogle() {
    // If Firebase credentials are wired up later in Phase 2, this calls signInWithPopup
    // For seamless local testing, if already signed in or using native web credentials:
    return new Promise((resolve) => {
      // Simulate/Trigger immediate Google credential recognition
      const simulatedGoogleUser = {
        name: 'Jay Warrick',
        email: 'jay.warrick@gmail.com',
        avatar: 'https://lh3.googleusercontent.com/a/default-user',
        id: 'google_broadcaster_1'
      };
      
      this.saveUser(simulatedGoogleUser);
      resolve(simulatedGoogleUser);
    });
  }

  signOut() {
    this.saveUser(null);
  }
}

export const authService = new AuthService();
