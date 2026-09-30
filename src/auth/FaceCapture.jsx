import React, { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, RefreshCcw, ShieldAlert, X } from 'lucide-react';
import './face-capture.css';

const LABELS = {
  front: 'Hadapkan wajah ke kamera',
  left: 'Putar kepala perlahan ke kiri',
  right: 'Putar kepala perlahan ke kanan',
};

export default function FaceCapture({ challenge, busy = false, onComplete, onClose, title = 'Verifikasi wajah' }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const framesRef = useRef([]);
  const [step, setStep] = useState(0);
  const [cameraError, setCameraError] = useState('');
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Kamera memerlukan HTTPS atau localhost. IP LAN http:// tidak didukung.');
      setStarting(false);
      return undefined;
    }
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: {
          facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 },
        } });
        if (cancelled) { stream.getTracks().forEach(track => track.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      } catch (error) {
        if (!cancelled) setCameraError(error?.name === 'NotAllowedError'
          ? 'Izin kamera ditolak. Izinkan kamera pada browser lalu coba lagi.'
          : 'Kamera tidak dapat dibuka. Periksa kamera lain atau izin perangkat.');
      } finally { if (!cancelled) setStarting(false); }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      framesRef.current = [];
    };
  }, []);

  async function capture() {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || busy) return;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 384;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    framesRef.current.push(canvas.toDataURL('image/jpeg', 0.74).split(',')[1]);
    if (framesRef.current.length < challenge.steps.length) {
      setStep(framesRef.current.length);
      return;
    }
    const frames = [...framesRef.current];
    framesRef.current = [];
    onComplete({ challengeId: challenge.challengeId, frames });
  }
  return <div className="softech-face-backdrop" role="presentation">
    <section className="softech-face-dialog" role="dialog" aria-modal="true" aria-label={title}>
      <header className="softech-face-header"><div><span className="softech-login-kicker">SOFTECH FACE ID · PILOT</span><h2>{title}</h2></div><button type="button" className="softech-face-close" disabled={busy} onClick={onClose} aria-label="Tutup"><X size={20}/></button></header>
      <div className="softech-face-video-frame"><video ref={videoRef} autoPlay muted playsInline aria-label="Pratinjau kamera"/><div className="softech-face-guide" aria-hidden="true"/><span className="softech-face-camera-badge"><Camera size={14}/> Kamera aktif hanya selama proses ini</span></div>
      {cameraError ? <p className="softech-auth-error" role="alert">{cameraError}</p> : <>
        <p className="softech-face-instruction">{LABELS[challenge.steps[step]]}</p>
        <p className="softech-face-hint">Pastikan hanya satu wajah dalam frame, cahaya merata, dan gerakkan kepala mengikuti instruksi. Kembalikan wajah ke depan sebelum langkah berikutnya jika perlu.</p>
        <div className="softech-face-progress">{challenge.steps.map((pose, index) => <span key={`${index}-${pose}`} className={index < step ? 'done' : index === step ? 'current' : ''}>{index < step ? <CheckCircle2 size={13}/> : index + 1} {index === step ? LABELS[pose] : pose === 'front' ? 'Depan' : pose === 'left' ? 'Kiri' : 'Kanan'}</span>)}</div>
        <button type="button" className="softech-login-primary" onClick={capture} disabled={starting || busy}>{busy ? 'Memeriksa wajah...' : starting ? 'Membuka kamera...' : step === 2 ? 'Ambil & verifikasi' : 'Ambil foto langkah ini'} <Camera size={17}/></button>
      </>}
      <p className="softech-face-disclaimer"><ShieldAlert size={15}/> Gerakan kepala bukan anti-spoofing tersertifikasi. Login wajah SOFTECH memerlukan password sebagai faktor kedua. Foto tidak disimpan ke database.</p>
      <button type="button" className="softech-face-cancel" disabled={busy} onClick={onClose}><RefreshCcw size={15}/> Batal, tutup kamera</button>
    </section>
  </div>;
}
