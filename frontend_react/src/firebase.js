// src/firebase.js
import { initializeApp } from "firebase/app";
import { getMessaging, onMessage } from "firebase/messaging";
// 💡 인증 기능을 위해 Auth 모듈 추가 임포트
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAs7_aWLEutr9_mAARn39GwiInruxMXdYM",
  authDomain: "fashion2cation.firebaseapp.com",
  projectId: "fashion2cation",
  storageBucket: "fashion2cation.firebasestorage.app",
  messagingSenderId: "611333260846",
  appId: "1:611333260846:web:48ddac6d0451cfab19c1bf",
  measurementId: "G-2G6096MV9D"
};

// 1. 파이어베이스 초기화
const app = initializeApp(firebaseConfig);

// 2. 메시징(FCM) 초기화 및 내보내기
export const messaging = getMessaging(app);

// 3. 인증(Auth) 초기화 및 내보내기 💡 (추가됨)
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// 💡 구글 로그인 시 팝업에 항상 계정 선택창이 뜨도록 설정 (선택 사항)
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// 포그라운드 메시지 리스너 (기존 코드 유지)
export const onMessageListener = () =>
  new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });