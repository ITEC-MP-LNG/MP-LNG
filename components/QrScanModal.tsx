'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface QrScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (data: { qrText: string; latitude: number | null; longitude: number | null }) => void;
}

type ScanPhase = 'idle' | 'scanning' | 'ready' | 'error';

export default function QrScanModal({ isOpen, onClose, onScanSuccess }: QrScanModalProps) {
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [coords, setCoords] = useState<{ lat: number | null; lon: number | null }>({ lat: null, lon: null });
  const [scannedText, setScannedText] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanHandledRef = useRef(false);
  const geoRequestRef = useRef(false);

  const stopCamera = async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      if (scanner.isScanning) await scanner.stop();
      scanner.clear();
    } catch {
      // 카메라 정리 중 발생하는 예외는 무시
    } finally {
      scannerRef.current = null;
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setPhase('idle');
      setCoords({ lat: null, lon: null });
      setScannedText('');
      scanHandledRef.current = false;
      geoRequestRef.current = false;
      void stopCamera();
      return;
    }
    setPhase('idle');
    setCoords({ lat: null, lon: null });
    setScannedText('');
    scanHandledRef.current = false;
    geoRequestRef.current = false;
    return () => { void stopCamera(); };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartScan = async () => {
    scanHandledRef.current = false;
    geoRequestRef.current = false;
    setPhase('scanning');
    setCoords({ lat: null, lon: null });
    setScannedText('');

    try {
      await stopCamera();
      const scanner = new Html5Qrcode('qr-reader-container');
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        async (decodedText) => {
          // QR 인식 후 중복 콜백을 막되, GPS 확보 실패 시 재시도할 수 있도록
          // QR 인식 완료 플래그는 GPS 성공 후에만 확정합니다.
          if (scanHandledRef.current || geoRequestRef.current) return;
          geoRequestRef.current = true;
          setScannedText(decodedText);
          setPhase('scanning');
          await stopCamera();

          if (!navigator.geolocation) {
            geoRequestRef.current = false;
            setPhase('error');
            return;
          }

          navigator.geolocation.getCurrentPosition(
            (position) => {
              const lat = position.coords.latitude;
              const lon = position.coords.longitude;
              if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
                geoRequestRef.current = false;
                setPhase('error');
                return;
              }
              setCoords({ lat, lon });
              scanHandledRef.current = true;
              geoRequestRef.current = false;
              setPhase('ready');
            },
            () => {
              geoRequestRef.current = false;
              scanHandledRef.current = false;
              setPhase('error');
            },
            { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 }
          );
        },
        () => {}
      );
    } catch {
      await stopCamera();
      geoRequestRef.current = false;
      scanHandledRef.current = false;
      setPhase('error');
    }
  };

  const handleCompleteScan = async () => {
    if (phase !== 'ready' || coords.lat == null || coords.lon == null || !scannedText || !scanHandledRef.current) return;
    await stopCamera();
    onScanSuccess({ qrText: scannedText, latitude: coords.lat, longitude: coords.lon });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-4 border border-slate-200">
        <style>{`
          @keyframes qrScanSweep {
            0% { transform: translateY(0%); opacity: 0.4; }
            50% { transform: translateY(190px); opacity: 1; }
            100% { transform: translateY(0%); opacity: 0.4; }
          }
          .qr-scan-line { animation: qrScanSweep 1.8s ease-in-out infinite; }
        `}</style>

        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-base font-bold text-slate-800">현장 QR 스캔</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">✕</button>
        </div>

        <div className="relative overflow-hidden rounded-xl bg-slate-900 aspect-square flex items-center justify-center">
          <div id="qr-reader-container" className="w-full h-full" />
          {phase === 'idle' && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-slate-900/65 text-white px-4 text-center"><div className="w-44 h-44 rounded-2xl border-2 border-dashed border-white/50 flex items-center justify-center"><span className="text-xs font-medium text-slate-200">아래 스캔 버튼을 눌러 시작하세요</span></div></div>}
          {phase === 'scanning' && <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><div className="relative w-52 h-52 rounded-2xl border-2 border-emerald-400/80 overflow-hidden"><div className="qr-scan-line absolute left-0 right-0 top-1 h-1 bg-emerald-400 shadow-[0_0_12px_#34d399]" /></div></div>}
          {phase === 'ready' && <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-emerald-950/35"><div className="rounded-xl bg-emerald-600/95 px-4 py-2 text-xs font-bold text-white shadow-lg">QR 인식 및 GPS 위치 확인 완료</div></div>}
        </div>

        <div className="text-center text-xs font-medium min-h-[18px]">
          {phase === 'idle' && <span className="text-slate-600">QR을 인식하면 GPS 위치 확보를 먼저 진행합니다.</span>}
          {phase === 'scanning' && <span className="text-emerald-600 font-bold">QR 인식됨. GPS 위치를 확보하고 있습니다. 확보 전에는 완료 처리되지 않습니다...</span>}
          {phase === 'ready' && <span className="text-emerald-700 font-bold">GPS 좌표 확보 완료. 이제 스캔 완료를 눌러주세요.</span>}
          {phase === 'error' && <span className="text-rose-600 font-medium">QR 인식 또는 GPS 위치 취득에 실패했습니다. GPS 권한, 위치 서비스, HTTPS/localhost를 확인한 후 다시 시도하세요.</span>}
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50">취소</button>
          {phase !== 'ready' ? (
            <button type="button" onClick={handleStartScan} disabled={phase === 'scanning'} className={`flex-2 rounded-xl py-2.5 px-4 text-xs font-bold text-white shadow-sm transition-colors ${phase === 'scanning' ? 'bg-amber-500 cursor-wait' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {phase === 'scanning' ? 'QR/GPS 확인 중...' : phase === 'error' ? '다시 스캔' : '스캔'}
            </button>
          ) : (
            <button type="button" onClick={handleCompleteScan} className="flex-2 rounded-xl py-2.5 px-4 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm">스캔 완료</button>
          )}
        </div>
      </div>
    </div>
  );
}
