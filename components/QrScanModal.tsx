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

  const stopCamera = async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      if (scanner.isScanning) await scanner.stop();
      scanner.clear();
    } catch {
      // Ignore camera cleanup errors.
    } finally {
      scannerRef.current = null;
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setPhase('idle'); setCoords({ lat: null, lon: null }); setScannedText('');
      scanHandledRef.current = false; void stopCamera();
      return;
    }
    setPhase('idle'); setCoords({ lat: null, lon: null }); setScannedText(''); scanHandledRef.current = false;
    return () => { void stopCamera(); };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartScan = async () => {
    scanHandledRef.current = false; setPhase('scanning'); setCoords({ lat: null, lon: null }); setScannedText('');
    try {
      await stopCamera();
      const scanner = new Html5Qrcode('qr-reader-container'); scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 15, qrbox: (viewWidth, viewHeight) => {
          const side = Math.min(320, Math.floor(Math.min(viewWidth, viewHeight) * 0.82));
          return { width: side, height: side };
        }, aspectRatio: 1, disableFlip: false },
        async (decodedText) => {
          if (scanHandledRef.current) return;
          scanHandledRef.current = true; setScannedText(decodedText); await stopCamera();
          if (!navigator.geolocation) { setPhase('error'); scanHandledRef.current = false; return; }
          navigator.geolocation.getCurrentPosition(
            (position) => { setCoords({ lat: position.coords.latitude, lon: position.coords.longitude }); setPhase('ready'); },
            () => { setPhase('error'); scanHandledRef.current = false; },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
          );
        }, () => {}
      );
    } catch {
      await stopCamera(); setPhase('error'); scanHandledRef.current = false;
    }
  };

  const handleCompleteScan = async () => {
    if (phase !== 'ready' || coords.lat == null || coords.lon == null || !scannedText) return;
    await stopCamera(); onScanSuccess({ qrText: scannedText, latitude: coords.lat, longitude: coords.lon }); onClose();
  };

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/65 p-3 sm:p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-white p-4 sm:p-5 shadow-2xl space-y-4 border border-slate-200">
        <style>{`@keyframes qrScanSweep { 0% { transform: translateY(0%); opacity: .4; } 50% { transform: translateY(260px); opacity: 1; } 100% { transform: translateY(0%); opacity: .4; } } .qr-scan-line { animation: qrScanSweep 1.8s ease-in-out infinite; } #qr-reader-container video { width: 100% !important; height: 100% !important; object-fit: cover !important; } #qr-reader-container { border: 0 !important; } #qr-reader-container img { display:none !important; }`}</style>
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-base font-bold text-slate-800">현장 QR 스캔</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">✕</button>
        </div>
        <div className="relative overflow-hidden rounded-xl bg-slate-900 aspect-square sm:aspect-[4/3] flex items-center justify-center">
          <div id="qr-reader-container" className="w-full h-full" />
          {phase === 'idle' && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-slate-900/65 text-white px-4 text-center"><div className="w-[min(82vw,320px)] aspect-square rounded-2xl border-2 border-dashed border-white/50 flex items-center justify-center"><span className="text-sm font-medium text-slate-200">스캔 버튼을 눌러 QR을 인식하세요</span></div></div>}
          {phase === 'scanning' && <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><div className="relative w-[min(82vw,320px)] aspect-square rounded-2xl border-2 border-emerald-400/80 overflow-hidden"><div className="qr-scan-line absolute left-0 right-0 top-1 h-1 bg-emerald-400 shadow-[0_0_12px_#34d399]" /></div></div>}
          {phase === 'ready' && <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-emerald-950/35"><div className="rounded-xl bg-emerald-600/95 px-4 py-2 text-sm font-bold text-white shadow-lg">QR 인식 및 위치 확인 완료</div></div>}
        </div>
        <div className="text-center text-xs sm:text-sm font-medium min-h-[20px]">
          {phase === 'idle' && <span className="text-slate-600">QR을 인식한 후에만 위치 확인이 진행됩니다.</span>}
          {phase === 'scanning' && <span className="text-emerald-600 font-bold">QR 인식 대기 중 — QR을 화면 안에 맞춰주세요.</span>}
          {phase === 'ready' && <span className="text-emerald-700 font-bold">위치 확보가 끝났습니다. 스캔 완료를 눌러주세요.</span>}
          {phase === 'error' && <span className="text-rose-600 font-medium">QR 인식 또는 위치 취득에 실패했습니다. 카메라와 위치 권한, HTTPS/localhost 환경을 확인하고 다시 시도하세요.</span>}
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50">취소</button>
          {phase !== 'ready' ? <button type="button" onClick={handleStartScan} disabled={phase === 'scanning'} className={`flex-[2] rounded-xl py-3 px-4 text-sm font-bold text-white shadow-sm transition-colors ${phase === 'scanning' ? 'bg-amber-500 cursor-wait' : 'bg-blue-600 hover:bg-blue-700'}`}>{phase === 'scanning' ? 'QR 인식 대기 중...' : phase === 'error' ? '다시 스캔' : '스캔 시작'}</button>
            : <button type="button" onClick={handleCompleteScan} className="flex-[2] rounded-xl py-3 px-4 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm">스캔 완료</button>}
        </div>
      </div>
    </div>
  );
}
