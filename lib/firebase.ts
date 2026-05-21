'use client';

import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// 🌟 Analytics 관련 코드는 싹 날리고 순수 DB/인증 기능만 남겼습니다.
const firebaseConfig = {
apiKey: "AIzaSyC_WqM5hZB4aT-F_0K0vQMcR9zSdlUnvjs",
  authDomain: "tokenomy-f719b.firebaseapp.com",
  projectId: "tokenomy-f719b",
  storageBucket: "tokenomy-f719b.firebasestorage.app",
  messagingSenderId: "137939714156",
  appId: "1:137939714156:web:42f75e4be8d25cea1cd849"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);