
"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const registerServiceWorker = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
        console.log("[PWA] 서비스 워커 등록 완료");
      } catch (error) {
        console.error("[PWA] 서비스 워커 등록 실패:", error);
      }
    };

    registerServiceWorker();
  }, []);

  return null;
}
