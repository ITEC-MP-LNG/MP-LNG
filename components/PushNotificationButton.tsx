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
  const [testLoading, setTestLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info");

  const handleSubscribe = async () => {
    if (loading) return;

    setLoading(true);
    setMessage("");

    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("이 브라우저는 푸시 알림을 지원하지 않습니다.");
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        throw new Error("푸시 알림 공개키가 설정되지 않았습니다.");
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error(
          permission === "denied"
            ? "브라우저 설정에서 알림 권한을 허용해 주세요."
            : "알림 권한이 허용되지 않았습니다."
        );
      }

      // 서비스 워커가 준비될 때까지 대기
      const registration = await navigator.serviceWorker.ready;

      // 기존 구독이 있으면 재사용하고, 없으면 새로 생성
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        });
      }

      // 현재 로그인한 직원의 구독 정보를 서버에 저장
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
      let result: { success?: boolean; error?: string };

      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error(`서버 응답을 확인할 수 없습니다. (HTTP ${response.status})`);
      }

      if (!response.ok || !result.success) {
        throw new Error(result.error || `푸시 등록에 실패했습니다. (HTTP ${response.status})`);
      }

      setSubscribed(true);
      setMessageType("success");
      setMessage("푸시 알림 등록이 완료되었습니다. 아래에서 테스트 알림을 보낼 수 있습니다.");
    } catch (error) {
      console.error("[Push] 구독 등록 오류:", error);
      setMessageType("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "푸시 알림 등록 중 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTestPush = async () => {
    if (testLoading) return;

    setTestLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/push/test", {
        method: "POST",
        credentials: "include",
      });
      const responseText = await response.text();
      let result: { success?: boolean; message?: string; error?: string };

      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error(`서버 응답을 확인할 수 없습니다. (HTTP ${response.status})`);
      }

      if (!response.ok || !result.success) {
        throw new Error(result.error || `테스트 발송에 실패했습니다. (HTTP ${response.status})`);
      }

      setMessageType("success");
      setMessage("테스트 푸시 발송 요청이 완료되었습니다. 휴대폰 알림을 확인해 주세요.");
    } catch (error) {
      console.error("[Push] 테스트 발송 오류:", error);
      setMessageType("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "테스트 푸시 발송 중 오류가 발생했습니다."
      );
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleSubscribe}
        disabled={loading}
        className="w-full rounded-lg border border-[#D6DEE8] bg-white px-3 py-2 text-sm font-semibold text-[#243B5A] transition hover:bg-[#F3F6FA] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "알림 등록 중..." : "푸시 알림 받기"}
      </button>

      {subscribed && (
        <button
          type="button"
          onClick={handleTestPush}
          disabled={testLoading}
          className="w-full rounded-lg bg-[#243B5A] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#1B2F49] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {testLoading ? "테스트 발송 중..." : "내 휴대폰으로 테스트 알림 보내기"}
        </button>
      )}

      {message && (
        <p
          className={`rounded-lg px-3 py-2 text-xs leading-5 ${
            messageType === "success"
              ? "bg-[#ECFDF5] text-[#047857]"
              : messageType === "error"
                ? "bg-[#FEF2F2] text-[#B91C1C]"
                : "bg-[#F3F6FA] text-[#64748B]"
          }`}
          role="status"
        >
          {message}
        </p>
      )}
    </div>
  );
}
