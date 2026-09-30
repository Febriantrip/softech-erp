import React, { useCallback, useEffect, useState } from 'react';
import { Fingerprint, KeyRound, Plus, ShieldCheck, Trash2, ScanFace } from 'lucide-react';
import FaceCapture from '../auth/FaceCapture';
import { useApiAuth } from '../context/ApiAuthContext';
import { apiRequest } from '../api/http';
import { hasPlatformPasskey, registerPasskey } from '../auth/webauthn';

export default function AccountSecurityPage() {
  const { session } = useApiAuth();
  const [data, setData] = useState({ passkeys: [], mfaRequired: false });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [available, setAvailable] = useState(false);
  const [face, setFace] = useState(null);
  const [faceChallenge, setFaceChallenge] = useState(null);
  const refresh = useCallback(async () => {
    setError('');
    try {
      setData(await apiRequest('/auth/passkeys', { token: session.accessToken }));
    } catch (err) { setError(err?.message || 'Tidak bisa membaca daftar perangkat.'); }
  }, [session.accessToken]);
  const refreshFace = useCallback(async () => {
    try { setFace(await apiRequest('/auth/face/status', { token: session.accessToken })); }
    catch (err) { setFace({ available:false, enrolled:false, error:err?.message || 'Fitur wajah tidak tersedia.' }); }
  }, [session.accessToken]);
  useEffect(() => { void refresh(); void refreshFace(); void hasPlatformPasskey().then(setAvailable); }, [refresh, refreshFace]);
  async function beginFace() {
    setBusy('face'); setError(''); setSuccess('');
    try { setFaceChallenge(await apiRequest('/auth/face/register/begin', { method:'POST', token:session.accessToken })); }
    catch (err) { setError(err?.message || 'Gagal memulai pendaftaran wajah.'); }
    finally { setBusy(''); }
  }
  async function finishFace(capture) {
    setBusy('face'); setError('');
    try {
      await apiRequest('/auth/face/register/finish', { method:'POST', token:session.accessToken, timeoutMs:30000, body:JSON.stringify(capture) });
      setFaceChallenge(null); await refreshFace(); setSuccess('Wajah berhasil didaftarkan. Gunakan wajah + password pada halaman login.');
    } catch (err) { setFaceChallenge(null); setError(err?.message || 'Pendaftaran wajah gagal. Coba kembali ke kamera dengan cahaya merata.'); }
    finally { setBusy(''); }
  }
  async function deleteFace() {
    if (!window.confirm('Hapus profil wajah dari akun ini? Passkey tidak ikut dihapus.')) return;
    setBusy('face-delete'); setError(''); setSuccess('');
    try { await apiRequest('/auth/face', { method:'DELETE', token:session.accessToken }); await refreshFace(); setSuccess('Profil wajah berhasil dihapus.'); }
    catch (err) { setError(err?.message || 'Gagal menghapus profil wajah.'); }
    finally { setBusy(''); }
  }
  async function enroll() {
    setBusy('enroll'); setError(''); setSuccess('');
    try { await registerPasskey(session.accessToken); await refresh(); setSuccess('Passkey perangkat berhasil didaftarkan.'); }
    catch (err) { setError(err?.name === 'NotAllowedError' ? 'Pendaftaran dibatalkan oleh perangkat.' : (err?.message || 'Gagal mendaftarkan perangkat.')); }
    finally { setBusy(''); }
  }
  async function remove(id) {
    if (!window.confirm('Hapus passkey perangkat ini dari akun?')) return;
    setBusy(id); setError(''); setSuccess('');
    try {
      await apiRequest(`/auth/passkeys/${id}`, { method: 'DELETE', token: session.accessToken });
      await refresh(); setSuccess('Passkey berhasil dihapus.');
    } catch (err) { setError(err?.message || 'Gagal menghapus passkey.'); }
    finally { setBusy(''); }
  }
  return <div className="softech-account-security">
    {faceChallenge && <FaceCapture challenge={faceChallenge} busy={busy==='face'} title="Daftarkan wajah SOFTECH" onComplete={finishFace} onClose={() => setFaceChallenge(null)}/>}
    <span className="softech-login-kicker">MY ACCOUNT / SECURITY</span>
    <h1>Keamanan akun</h1><p>Kelola metode masuk untuk <strong>{session.user.name}</strong> ({session.user.sub}).</p>
    <section className="softech-security-card">
      <div className="softech-security-top"><div className="softech-security-icon"><Fingerprint size={27}/></div><div><h2>Passkey perangkat</h2><p>Daftarkan Face ID, fingerprint, atau Windows Hello. Biometrik tetap tersimpan di perangkat; server hanya menyimpan credential public key.</p></div></div>
      <button type="button" className="softech-login-primary softech-security-add" disabled={!!busy || !available} onClick={enroll}><Plus size={18}/>{busy==='enroll'?'Menyiapkan perangkat...':'Daftarkan perangkat ini'}</button>
      {!available && <p className="softech-security-warning">Perangkat atau browser ini belum menyediakan authenticator WebAuthn. Coba Chrome/Edge di localhost dengan Windows Hello aktif.</p>}
      {data.mfaRequired && <p className="softech-security-note"><ShieldCheck size={17}/> Akun ini mewajibkan passkey setelah berhasil didaftarkan.</p>}
      {error && <p className="softech-auth-error" role="alert">{error}</p>}
      {success && <p className="softech-security-success" role="status">{success}</p>}
      <h3>Perangkat terdaftar</h3>
      {!data.passkeys.length && <div className="softech-empty-passkeys"><KeyRound size={23}/> Belum ada perangkat yang terdaftar.</div>}
      {data.passkeys.map(item => <div key={item.id} className="softech-security-row"><Fingerprint size={20}/><div><strong>{item.label}</strong><small>Ditambahkan {new Date(item.createdAt).toLocaleDateString('id-ID')} · terakhir digunakan {item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleDateString('id-ID') : 'belum pernah'}</small></div><button type="button" className="softech-security-remove" disabled={!!busy || (data.mfaRequired && data.passkeys.length===1)} onClick={() => remove(item.id)} title="Hapus passkey"><Trash2 size={17}/></button></div>)}
    </section>
    <section className="softech-security-card softech-security-face-card">
      <div className="softech-security-top"><div className="softech-security-icon"><ScanFace size={27}/></div><div><h2>Wajah SOFTECH (kamera lintas perangkat)</h2><p>Daftar dari kamera iPhone/Android/PC, lalu verifikasi wajah yang sama dari kamera perangkat lain. Sistem memproses foto secara sementara dan menyimpan descriptor wajah terenkripsi di PostgreSQL.</p></div></div>
      <p className="softech-security-note"><ShieldCheck size={17}/> Pilot: verifikasi gerakan kepala bukan liveness tersertifikasi. Login selalu memerlukan password selain wajah.</p>
      {face?.error && <p className="softech-security-warning">{face.error}</p>}
      <p className="softech-face-status">{face?.enrolled ? 'Wajah terdaftar pada akun ini.' : 'Belum ada wajah terdaftar.'}</p>
      <div className="softech-security-face-actions"><button type="button" className="softech-login-primary" disabled={!!busy || !face?.available} onClick={beginFace}><ScanFace size={18}/>{face?.enrolled ? 'Daftarkan ulang wajah' : 'Daftarkan wajah menggunakan kamera'}</button>
      {face?.enrolled && <button type="button" className="softech-face-delete" disabled={!!busy} onClick={deleteFace}>Hapus wajah</button>}</div>
      {!face?.available && <p className="softech-security-warning">Model wajah belum tersedia atau backend belum dikonfigurasi. Jalankan installer model dan restart Go API. Registrasi dari HP membutuhkan HTTPS, bukan HTTP IP LAN.</p>}
      {error && <p role="alert" className="softech-auth-error">{error}</p>}
      {success && <p role="status" className="softech-security-success">{success}</p>}
    </section>
  </div>;
}
