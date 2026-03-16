import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import iconUrl from './assets/Gemini_bot_icon.jpg';

// Dynamic Favicon Cropping & PNG Conversion
const updateFavicon = () => {
  const img = new Image();
  img.src = iconUrl;
  
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const size = 64; // Standard favicon size
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create circular clip (this provides the transparency)
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();

    // Draw the image to the circular canvas
    ctx.drawImage(img, 0, 0, size, size);

    // Update the link tag with a PNG data URL
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.getElementsByTagName('head')[0].appendChild(link);
    }
    link.href = canvas.toDataURL('image/png');
  };
};

updateFavicon();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
