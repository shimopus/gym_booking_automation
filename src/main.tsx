import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Dynamic Favicon Cropping
const updateFavicon = () => {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = "https://storage.googleapis.com/static.miraiproject.io/ai-studio-build/user_uploads/67d66765-8869-450b-932f-a39151044700.png";
  
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const size = 64; // Standard favicon size
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create circular clip
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();

    // Draw image zoomed in to focus on the circular logo
    // The logo is centered, so we scale it up slightly to fill the circle
    const zoom = 1.35; 
    const drawSize = size * zoom;
    const offset = (size - drawSize) / 2;
    ctx.drawImage(img, offset, offset, drawSize, drawSize);

    // Update the link tag
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
