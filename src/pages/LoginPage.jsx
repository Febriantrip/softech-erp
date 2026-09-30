import React, { useEffect, useState } from 'react';
import {
  Activity, ArrowRight, ArrowUpRight, Boxes, CircleCheck, Database,
  Eye, EyeOff, Fingerprint, Globe2, KeyRound, LockKeyhole,
  ScanFace, ShieldCheck, Sparkles,
} from 'lucide-react';
import { authApi } from '../api/session';
import FaceCapture from '../auth/FaceCapture';
import { apiRequest } from '../api/http';
import { hasPlatformPasskey, loginWithPasskey } from '../auth/webauthn';
import { useApiAuth } from '../context/ApiAuthContext';
import { useTheme } from '../context/ThemeContext';
import ThemeSwitch from '../components/ThemeSwitch';

// Only presentation has changed. Authentication requests and WebAuthn / face flows
// remain connected to the existing Go API and database-backed account system.
export default function LoginPage() {
  const { login } = useApiAuth();
  const { theme } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [passkeyReady, setPasskeyReady] = useState(false);
  const [faceChallenge, setFaceChallenge] = useState(null);
  useEffect(() => { void hasPlatformPasskey().then(setPasskeyReady); }, []);

  async function submitPassword(event) {
    event.preventDefault();
    if (!username.trim() || !password) return;
    setLoading('password'); setError('');
    try { login(await authApi.password(username.trim(), password)); }
    catch (err) { setError(err?.message || 'Login gagal.'); }
    finally { setLoading(''); }
  }

  async function submitPasskey() {
    if (!username.trim()) { setError('Isi username terlebih dahulu.'); return; }
    setLoading('passkey'); setError('');
    try { login(await loginWithPasskey(username.trim())); }
    catch (err) {
      setError(err?.name === 'NotAllowedError' ? 'Verifikasi perangkat dibatalkan atau tidak tersedia.' : (err?.message || 'Verifikasi perangkat gagal.'));
    } finally { setLoading(''); }
  }

  async function beginFace() {
    if (!username.trim() || !password) { setError('Isi username dan password sebelum verifikasi wajah.'); return; }
    setLoading('face'); setError('');
    try { setFaceChallenge(await apiRequest('/auth/face/login/begin', { method: 'POST', body: JSON.stringify({ username: username.trim() }) })); }
    catch (err) { setError(err?.message || 'Login wajah tidak tersedia.'); }
    finally { setLoading(''); }
  }

  async function finishFace(capture) {
    setLoading('face'); setError('');
    try {
      const response = await apiRequest('/auth/face/login/finish', {
        method: 'POST', timeoutMs: 30000, body: JSON.stringify({ ...capture, password }),
      });
      setFaceChallenge(null); login(response);
    } catch (err) { setFaceChallenge(null); setError(err?.message || 'Wajah tidak terverifikasi.'); }
    finally { setLoading(''); }
  }

  return (
    <div className="softech-login-v2">
      {faceChallenge && <FaceCapture challenge={faceChallenge} busy={loading === 'face'} title="Login dengan wajah" onComplete={finishFace} onClose={() => setFaceChallenge(null)} />}

      <section className="softech-v2-story" aria-label="SOFTECH ERP">
        <div className="softech-v2-brand">
          <span className="softech-v2-brand-mark"><Boxes size={24} strokeWidth={1.7} /></span>
          <span className="softech-v2-brand-name"><strong>SOFTECH<span> ERP</span></strong><small>DISTRIBUTOR SUITE</small></span>
          <span className="softech-v2-brand-version">/ 02</span>
        </div>

        <div className="softech-v2-story-main">
          <div className="softech-v2-orbit" aria-hidden="true">
            <span className="softech-v2-orbit-ring softech-v2-orbit-ring-one" />
            <span className="softech-v2-orbit-ring softech-v2-orbit-ring-two" />
            <span className="softech-v2-orbit-ring softech-v2-orbit-ring-three" />
            <span className="softech-v2-orbit-core"><Boxes size={47} strokeWidth={1.15} /></span>
            <span className="softech-v2-orbit-node softech-v2-orbit-node-one" />
            <span className="softech-v2-orbit-node softech-v2-orbit-node-two" />
          </div>
          <div className="softech-v2-story-copy">
            <span className="softech-v2-eyebrow"><span /> THE CONNECTED ENTERPRISE</span>
            <h1>Everything moves.<br /><em>As one.</em></h1>
            <p>Satu ruang kerja untuk setiap keputusan. Distribusi, persediaan, dan keuangan bergerak dalam satu alur yang terhubung.</p>
          </div>
          <div className="softech-v2-story-grid" aria-hidden="true">
            <div><Activity size={17}/><span>OPERATIONS</span><strong>In sync</strong></div>
            <div><Database size={17}/><span>DATA INTEGRITY</span><strong>Connected</strong></div>
            <div><ShieldCheck size={17}/><span>ACCESS</span><strong>Protected</strong></div>
          </div>
        </div>

        <div className="softech-v2-story-foot"><span>SOFTECH / BUSINESS WITHOUT FRICTION</span><span>POSTGRESQL <span className="softech-v2-foot-dot">·</span> GO API</span></div>
      </section>

      <main className="softech-v2-main">
        <div className="softech-v2-topline">
          <span className="softech-v2-auth-badge"><ShieldCheck size={14}/> PRIVATE WORKSPACE</span>
          <div className="softech-v2-theme-control"><span>{theme === 'dark' ? 'Dark' : 'Light'}</span><ThemeSwitch /></div>
        </div>

        <div className="softech-v2-form-wrap">
          <div className="softech-v2-form-intro">
            <span className="softech-v2-overline">WELCOME BACK <span className="softech-v2-intro-line" /></span>
            <h2>Masuk ke <em>workspace.</em></h2>
            <p>Kelola operasional perusahaan dengan akun SOFTECH yang terdaftar.</p>
          </div>

          <div className="softech-v2-form-card">
            <div className="softech-v2-form-heading"><div><span className="softech-v2-section-number">01 / ACCESS</span><strong>Identitas akun</strong></div><span className="softech-v2-secure-indicator"><CircleCheck size={14}/> SECURE</span></div>

            <form onSubmit={submitPassword}>
              <label className="softech-v2-field">
                <span>Username atau email</span>
                <div className="softech-v2-input"><KeyRound size={18}/><input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" placeholder="Masukkan username" required maxLength={160} /></div>
              </label>
              <label className="softech-v2-field">
                <span>Password</span>
                <div className="softech-v2-input"><LockKeyhole size={18}/><input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" placeholder="Masukkan password" required /><button type="button" className="softech-v2-eye" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'} title={showPassword ? 'Sembunyikan' : 'Tampilkan'}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>
              </label>
              {error && <div role="alert" className="softech-v2-error">{error}</div>}
              <button type="submit" disabled={!!loading} className="softech-v2-primary"><span>{loading === 'password' ? 'Memeriksa akun...' : 'Masuk dengan password'}</span><span className="softech-v2-primary-arrow"><ArrowUpRight size={20}/></span></button>
            </form>

            <div className="softech-v2-divider"><span>ATAU MASUK DENGAN</span></div>
            <div className="softech-v2-methods">
              <button type="button" onClick={submitPasskey} disabled={!!loading || !passkeyReady} className="softech-v2-method"><span className="softech-v2-method-icon"><Fingerprint size={22}/></span><span className="softech-v2-method-copy"><strong>{loading === 'passkey' ? 'Memverifikasi...' : 'Passkey / biometrik perangkat'}</strong><small>{passkeyReady ? 'Face ID, fingerprint atau Windows Hello' : 'Tidak tersedia pada browser/perangkat ini'}</small></span><ArrowRight size={18}/></button>
              <button type="button" onClick={beginFace} disabled={!!loading || !username.trim() || !password} className="softech-v2-method"><span className="softech-v2-method-icon"><ScanFace size={22}/></span><span className="softech-v2-method-copy"><strong>{loading === 'face' ? 'Menyiapkan kamera...' : 'Wajah SOFTECH + password'}</strong><small>Gunakan wajah yang sudah terdaftar</small></span><ArrowRight size={18}/></button>
            </div>
          </div>
          <div className="softech-v2-form-bottom"><Sparkles size={16}/><span>Perangkat baru? Masuk dengan password, kemudian daftarkan biometrik di <strong>Keamanan Akun</strong>.</span></div>
        </div>
        <footer className="softech-v2-page-foot"><span>© SOFTECH ERP</span><span><Globe2 size={13}/> ACCESS FOR AUTHORIZED USERS ONLY</span></footer>
      </main>
    </div>
  );
}
