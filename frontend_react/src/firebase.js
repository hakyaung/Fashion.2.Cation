// src/firebase.js
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// 💡 1단계 화면에 떠있는 하경님만의 firebaseConfig 내용을 여기에 그대로 덮어씌우세요!
const firebaseConfig = {
  apiKey: "AIzaSyAs7_aWLEutr9_mAARn39GwiInruxMXdYM",
  authDomain: "fashion2cation.firebaseapp.com",
  projectId: "fashion2cation",
  storageBucket: "fashion2cation.firebasestorage.app",
  messagingSenderId: "611333260846",
  appId: "1:611333260846:web:48ddac6d0451cfab19c1bf",
  measurementId: "G-2G6096MV9D"
};

// 파이어베이스 초기화
const app = initializeApp(firebaseConfig);
export const messaging = getMessaging(app);

// 백그라운드 말고, 화면 켜져있을 때(포그라운드) 메시지 받는 함수
export const onMessageListener = () =>
  new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });