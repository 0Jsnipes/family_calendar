import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence,
  type Auth,
} from "firebase/auth";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export function isFirebaseClientConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId,
  );
}

function ensureFirebaseApp(): FirebaseApp {
  if (!isFirebaseClientConfigured()) {
    throw new Error("firebase-client-not-configured");
  }

  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

let firebaseAppInstance: FirebaseApp | null = null;
let firebaseAuthInstance: Auth | null = null;
let firebaseDbInstance: Firestore | null = null;

export function getFirebaseApp() {
  if (!firebaseAppInstance) {
    firebaseAppInstance = ensureFirebaseApp();
  }

  return firebaseAppInstance;
}

export function getFirebaseAuth() {
  if (!firebaseAuthInstance) {
    firebaseAuthInstance = getAuth(getFirebaseApp());
  }

  return firebaseAuthInstance;
}

export function getFirebaseDb() {
  if (!firebaseDbInstance) {
    firebaseDbInstance = getFirestore(getFirebaseApp());
  }

  return firebaseDbInstance;
}

export const googleProvider = new GoogleAuthProvider();
export let firebaseAnalytics: Analytics | null = null;

googleProvider.setCustomParameters({ prompt: "select_account" });

if (typeof window !== "undefined" && isFirebaseClientConfigured()) {
  void setPersistence(getFirebaseAuth(), browserLocalPersistence);

  if (firebaseConfig.measurementId) {
    void isSupported().then((supported) => {
      if (supported) {
        firebaseAnalytics = getAnalytics(getFirebaseApp());
      }
    });
  }
}
