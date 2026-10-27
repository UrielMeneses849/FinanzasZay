import React from "react";
import { createRoot } from "react-dom/client";
import { ZayApp } from "./Prototype";
import "./prototype.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ZayApp />
  </React.StrictMode>,
);
if (import.meta.env.PROD && "serviceWorker" in navigator)
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(import.meta.env.BASE_URL + "sw.js", {
        scope: import.meta.env.BASE_URL,
      })
      .catch(() => console.warn("El modo sin conexión no está disponible."));
  });
