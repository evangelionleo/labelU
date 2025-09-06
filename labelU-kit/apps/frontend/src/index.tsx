import ReactDOM from 'react-dom/client';
import React from 'react';
import '@labelu/video-annotator-react/dist/style.css';
import '@labelu/audio-annotator-react/dist/style.css';

import './polyfills';
import App from './App';
import './initialize';
import './styles/index.css';

window.React = React;
// 是否是线上演示环境
window.IS_ONLINE = !!import.meta.env.VITE_IS_ONLINE;

// Load runtime server config from public/server.config.json
fetch('/server.config.json')
  .then((r) => (r.ok ? r.json() : { API_BASE_URL: '' }))
  .then((cfg) => {
    (window as any).__SERVER_CONFIG = cfg || {};
    ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
  })
  .catch(() => {
    (window as any).__SERVER_CONFIG = {};
    ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
  });
