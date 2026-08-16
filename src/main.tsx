import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/global.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// PWA install support — lets the app be added to the home screen / desktop
// and still open (from cache) without a connection. Registered after load
// so it never competes with the initial page render for bandwidth.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // BASE_URL (not a hardcoded "/") since this app can be deployed under a
    // subpath (see vite.config.ts's `base`) — a root-absolute path here
    // would silently register against the wrong scope on such deployments.
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch(() => {
        // Offline install just won't be available this session — not fatal.
      });
  });
}
