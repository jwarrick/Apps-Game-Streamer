import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

export const firebaseConfig = {
  projectId: "gamestreamer-live",
  appId: "1:838037548460:web:900ee65200d7434ddd5e09",
  storageBucket: "gamestreamer-live.firebasestorage.app",
  apiKey: "AIzaSyBxDaW9IaGz5txV8YG4EODGmKeRX9Rt3w8",
  authDomain: "gamestreamer-live.firebaseapp.com",
  messagingSenderId: "838037548460",
  projectNumber: "838037548460"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
