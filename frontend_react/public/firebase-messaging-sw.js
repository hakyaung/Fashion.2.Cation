// public/firebase-messaging-sw.js

// 파이어베이스 백그라운드 일꾼 불러오기
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

// 💡 여기에 아까 썼던 firebaseConfig를 똑같이 한 번 더 넣어줍니다!
const firebaseConfig = {
  apiKey: "AIzaSyAs7_aWLEutr9_mAARn39GwiInruxMXdYM",
  authDomain: "fashion2cation.firebaseapp.com",
  projectId: "fashion2cation",
  storageBucket: "fashion2cation.firebasestorage.app",
  messagingSenderId: "611333260846",
  appId: "1:611333260846:web:48ddac6d0451cfab19c1bf",
  measurementId: "G-2G6096MV9D"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// 화면이 꺼져있을 때 푸시 알림을 받으면, 핸드폰 시스템 알림으로 띄워주는 마법의 코드
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] 백그라운드 메시지 수신: ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo192.png' // public 폴더에 있는 로고 이미지 이름
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// 💡 [추가] 설치 즉시 불침번(보초병)을 깨우고 활성화하는 마법의 코드
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});