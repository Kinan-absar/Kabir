import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBHaHjioTm5WcyQkfWNk3dV-pClCmHZsfs",
  authDomain: "gen-lang-client-0526881899.firebaseapp.com",
  projectId: "gen-lang-client-0526881899",
  storageBucket: "gen-lang-client-0526881899.firebasestorage.app",
  messagingSenderId: "527683375787",
  appId: "1:527683375787:web:ca5080d43564e237489dee",
  measurementId: "G-8HZS9VQME1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// ✅ THESE TWO EXPORTS ARE REQUIRED
export const auth = getAuth(app);
export const db = getFirestore(app);
