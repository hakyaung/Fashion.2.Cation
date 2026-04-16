// import { useEffect, useRef } from 'react';

// export default function useCursor() {
//   const cursorRef = useRef(null);
//   const followerRef = useRef(null);
//   const mouse = useRef({ x: 0, y: 0 });
//   const follower = useRef({ x: 0, y: 0 });
//   const rafId = useRef(null);

//   useEffect(() => {
//     // 터치 기기(모바일)에서는 커서를 활성화하지 않음
//     if (!window.matchMedia('(pointer: fine)').matches) return;

//     const cursor = cursorRef.current;
//     const followerEl = followerRef.current;

//     const onMouseMove = (e) => {
//       mouse.current = { x: e.clientX, y: e.clientY };
//       if (cursor) {
//         cursor.style.left = e.clientX + 'px';
//         cursor.style.top = e.clientY + 'px';
//       }
//     };

//     const animate = () => {
//       follower.current.x += (mouse.current.x - follower.current.x) * 0.1;
//       follower.current.y += (mouse.current.y - follower.current.y) * 0.1;
//       if (followerEl) {
//         followerEl.style.left = follower.current.x + 'px';
//         followerEl.style.top = follower.current.y + 'px';
//       }
//       rafId.current = requestAnimationFrame(animate);
//     };

//     document.addEventListener('mousemove', onMouseMove);
//     rafId.current = requestAnimationFrame(animate);

//     return () => {
//       document.removeEventListener('mousemove', onMouseMove);
//       if (rafId.current) cancelAnimationFrame(rafId.current);
//     };
//   }, []);

//   // 호버 효과를 동적으로 바인딩하는 함수
//   const bindHoverEffect = () => {
//     if (!window.matchMedia('(pointer: fine)').matches) return;
//     const cursor = cursorRef.current;
//     const targets = document.querySelectorAll('a, button, .post-card, .grid-item, label, .post-hashtag');
//     targets.forEach((el) => {
//       el.onmouseenter = () => {
//         if (cursor) {
//           cursor.style.transform = 'translate(-50%, -50%) scale(1.6)';
//           cursor.style.background = 'var(--gold)';
//         }
//       };
//       el.onmouseleave = () => {
//         if (cursor) {
//           cursor.style.transform = 'translate(-50%, -50%) scale(1)';
//           cursor.style.background = 'var(--rust)';
//         }
//       };
//     });
//   };

//   return { cursorRef, followerRef, bindHoverEffect };
// }

// 마우스 커서에 대한 것이지만 너무 조잡하고 렉이 걸리는 경우가 있어 삭제