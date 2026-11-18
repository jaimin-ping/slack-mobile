import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

export interface SsoGrant {
  code: string;
  verifier: string;
}

const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

/** Creates a PKCE challenge/verifier pair */
async function createPkceChallenge(): Promise<{ verifier: string; challenge: string }> {
  const verifier = hex(Crypto.getRandomBytes(32));
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
  const challenge = digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return { verifier, challenge };
}

/** Opens the provider in the system browser. The verifier never leaves the app until the exchange. */
export async function openSso(server: string): Promise<SsoGrant | null> {
  const { verifier, challenge } = await createPkceChallenge();
  const redirect = Linking.createURL('sso');
  const query = `challenge=${challenge}&redirect_uri=${encodeURIComponent(redirect)}`;

  const result = await WebBrowser.openAuthSessionAsync(`${server}/sso/mobile?${query}`, redirect);

  if (result.type !== 'success') return null;

  const { code, error } = Linking.parse(result.url).queryParams ?? {};

  if (typeof error === 'string') throw new Error(error);
  if (typeof code !== 'string') throw new Error('Single sign-on did not work. Try again.');

  return { code, verifier };
}

/** Opens Google Sign-In in the system browser. Uses PKCE for security. */
export async function openGoogle(server: string): Promise<SsoGrant | null> {
  const { verifier, challenge } = await createPkceChallenge();
  // Use makeUrl for Expo Go compatibility (uses exp:// in development)
  const redirect = Linking.createURL('google');
  const query = `challenge=${challenge}&redirect_uri=${encodeURIComponent(redirect)}`;
  const authUrl = `${server}/auth/google/mobile?${query}`;

  console.log('Google OAuth - Server:', server);
  console.log('Google OAuth - Redirect URI:', redirect);
  console.log('Google OAuth - Challenge:', challenge);
  console.log('Google OAuth - Full URL:', authUrl);
  console.log('Google OAuth - Expected return URL prefix:', redirect);

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirect);

  console.log('Google OAuth - Result:', JSON.stringify(result));

  if (result.type !== 'success') return null;

  const { code, error } = Linking.parse(result.url).queryParams ?? {};

  if (typeof error === 'string') throw new Error(error);
  if (typeof code !== 'string') throw new Error('Google sign-in did not work. Try again.');

  return { code, verifier };
}
