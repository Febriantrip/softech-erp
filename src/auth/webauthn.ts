import { apiRequest } from '../api/http';
import type { LoginResponse } from '../api/session';

type Ceremony = { ceremonyId: string; options: Record<string, any> };
const decode = (input: string): ArrayBuffer => {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '='));
  return Uint8Array.from(raw, char => char.charCodeAt(0)).buffer;
};
const encode = (buffer: ArrayBuffer | null): string | null => {
  if (!buffer) return null;
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const capabilities = () => {
  if (!window.isSecureContext || typeof PublicKeyCredential === 'undefined' || !navigator.credentials) {
    throw new Error('Passkey memerlukan browser WebAuthn di localhost atau HTTPS.');
  }
};
export async function hasPlatformPasskey(): Promise<boolean> {
  if (!window.isSecureContext || typeof PublicKeyCredential === 'undefined' || !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return false;
  try { return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); }
  catch { return false; }
}
const optionsObject = (ceremony: Ceremony): Record<string, any> => ceremony.options.publicKey || ceremony.options;

export async function registerPasskey(token: string): Promise<void> {
  capabilities();
  const ceremony = await apiRequest<Ceremony>('/auth/passkeys/register/begin', { method: 'POST', token });
  const option = optionsObject(ceremony);
  const options = {
    ...option,
    challenge: decode(option.challenge),
    user: { ...option.user, id: decode(option.user.id) },
    excludeCredentials: (option.excludeCredentials || []).map((item: Record<string, any>) => ({
      ...item, id: decode(item.id),
    })),
  } as PublicKeyCredentialCreationOptions;
  const credential = await navigator.credentials.create({ publicKey: options }) as PublicKeyCredential | null;
  if (!credential) throw new Error('Pendaftaran perangkat dibatalkan.');
  const response = credential.response as AuthenticatorAttestationResponse;
  await apiRequest('/auth/passkeys/register/finish', {
    method: 'POST', token,
    body: JSON.stringify({ ceremonyId: ceremony.ceremonyId, credential: {
      id: credential.id, rawId: encode(credential.rawId), type: credential.type,
      authenticatorAttachment: credential.authenticatorAttachment,
      response: {
        clientDataJSON: encode(response.clientDataJSON),
        attestationObject: encode(response.attestationObject),
        transports: response.getTransports?.() || [],
      }, clientExtensionResults: credential.getClientExtensionResults(),
    } }),
  });
}
export async function loginWithPasskey(username: string): Promise<LoginResponse> {
  capabilities();
  const ceremony = await apiRequest<Ceremony>('/auth/passkeys/login/begin', {
    method: 'POST', body: JSON.stringify({ username }),
  });
  const option = optionsObject(ceremony);
  const options: PublicKeyCredentialRequestOptions = {
    ...option,
    challenge: decode(option.challenge),
    allowCredentials: (option.allowCredentials || []).map((item: Record<string, any>) => ({
      ...item, id: decode(item.id),
    })),
  };
  const credential = await navigator.credentials.get({ publicKey: options }) as PublicKeyCredential | null;
  if (!credential) throw new Error('Login perangkat dibatalkan.');
  const response = credential.response as AuthenticatorAssertionResponse;
  return apiRequest<LoginResponse>('/auth/passkeys/login/finish', {
    method: 'POST', body: JSON.stringify({ ceremonyId: ceremony.ceremonyId, credential: {
      id: credential.id, rawId: encode(credential.rawId), type: credential.type,
      authenticatorAttachment: credential.authenticatorAttachment,
      response: {
        clientDataJSON: encode(response.clientDataJSON),
        authenticatorData: encode(response.authenticatorData),
        signature: encode(response.signature),
        userHandle: encode(response.userHandle),
      }, clientExtensionResults: credential.getClientExtensionResults(),
    } }),
  });
}
