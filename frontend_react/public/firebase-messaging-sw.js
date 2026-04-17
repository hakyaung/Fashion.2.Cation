// public/firebase-messaging-sw.js

// 파이어베이스 백그라운드 일꾼 불러오기
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

// 💡 하경님의 firebaseConfig 유지
const firebaseConfig = {
  apiKey: "AIzaSyAs7_aWLEutr9_mAARn39GwiInruxMXdYM",
  authDomain: "fashion2cation.firebaseapp.com",
  projectId: "fashion2cation",
  storageBucket: "fashion2cation.firebasestorage.app",
  messagingSenderId: "611333260846",
  appId: "1:611333260846:web:48ddac6d0451cfab19c1bf",
  measurementId: "G-2G6096MV9D"
};

// 파이어베이스 초기화 (이것만 해두면 알아서 백그라운드 알림을 띄웁니다!)
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// ==========================================
// 💡 [핵심 해결] 수동으로 알림을 띄우던 onBackgroundMessage 블록을 완전히 삭제했습니다!
// (파이어베이스와 iOS가 서로 충돌하여 보초병이 기절하는 현상 완벽 차단)
// ==========================================

// 💡 설치 즉시 불침번(보초병)을 깨우고 활성화하는 마법의 코드
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});