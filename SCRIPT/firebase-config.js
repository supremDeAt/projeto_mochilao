import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAYQlLNkT8RI9qKA6gO_wfXREKMmSUQt_c",
  authDomain: "omochilao.firebaseapp.com",
  projectId: "omochilao",
  storageBucket: "omochilao.firebasestorage.app",
  messagingSenderId: "836614706060",
  appId: "1:836614706060:web:387d12d9bda11a41c17ca9",
  measurementId: "G-2C3LBY7RLP",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

try {
  const analytics = getAnalytics(app);
  console.info("Firebase Analytics inicializado", analytics);
} catch (error) {
  console.warn("Firebase Analytics não disponível nesta sessão.", error);
}

window.__FIREBASE_READY__ = true;
