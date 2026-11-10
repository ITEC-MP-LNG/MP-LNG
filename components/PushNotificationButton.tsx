
"use client";

import { useState } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export default function PushNotificationButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubscribe = async () => {
    if (loading) return;

    setLoading(true);
    setMessage("");

    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setMessage("이 브라우저는 푸시 알림을 지원하지 않습니다.");
        return;
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!publicKey) {
        setMessage("푸시 알림 공개키가 설정되지 않았습니다.");
        return;
      }

      // 1. 알림 권한 요청
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        setMessage(
          permission === "denied"
            ? "브라우저 설정에서 알림 권한을 허용해 주세요."
            : "알림 권한이 허용되지 않았습니다."
        );
        return;
      }

          // 2. 서비스 워커 준비
      const registration = await navigator.serviceWorker.ready;

      // 3. 기존 구독 확인 또는 새 구독 생성
      let subscription = await registration.pushManager.getSubscription();

      console.log("[Push] 서비스 워커 상태:", registration.active?.state);
      console.log("[Push] 알림 권한:", Notification.permission);
      console.log("[Push] 기존 구독:", !!subscription);
      console.log("[Push] VAPID 공개키 길이:", publicKey.length);

      if (!subscription) {
        try {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
          });
        } catch (error) {
          console.error("[Push] 브라우저 구독 생성 실패:", error);
          throw error;
        }
      }

      console.log("[Push] 구독 생성 결과:", !!subscription);
      // 4. 서버에 구독 정보 저장
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          subscription: subscription.toJSON(),
        }),
      });
const responseText = await response.text();

console.log("[Push] 응답 상태:", response.status);
console.log("[Push] 응답 내용:", responseText);

let result;

try {
  result = JSON.parse(responseText);
} catch {
  throw new Error(
    `서버에서 JSON이 아닌 응답을 받았습니다. HTTP ${response.status}`
  );
}

if (!response.ok || !result.success) {
  throw new Error(result.error || "푸시 구독 등록에 실패했습니다.");
}
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleSubscribe}
        disabled={loading}
        className="w-full rounded-lg border border-[#D6DEE8] bg-white px-3 py-2 text-sm font-semibold text-[#243B5A] hover:bg-[#F3F6FA] disabled:opacity-50"
      >
        {loading ? "알림 등록 중..." : "푸시 알림 받기"}
      </button>

      {message && (
        <p className="text-xs text-[#64748B]" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
