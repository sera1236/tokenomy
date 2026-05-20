'use client';

import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// 🌟 안전하게 .env.local에서 대장님의 새 파이어베이스 프로젝트 키들을 매핑합니다.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// 🌟 Next.js 가동 시 서버 사이드에서 중복으로 앱이 생성되어 터지는 현상을 완벽 방어합니다.
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// 🌟 page.tsx를 비롯한 전 영역에서 긁어다 쓸 핵심 인스턴스 전역 개방!
export const db = getFirestore(app);
export const auth = getAuth(app);