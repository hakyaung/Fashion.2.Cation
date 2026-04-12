// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // 하경님이 변환한 CSS
import App from './App'; // 여기서 .jsx를 알아서 찾습니다.

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);