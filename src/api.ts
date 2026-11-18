import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export interface User {
  id: number;
  name: string;
  email?: string;
  avatar_url?: string | null;
  status_emoji?: string | null;
  status_text?: string | null;
  is_away?: boolean;
}

export interface Workspace {
  id: number;
  name: string;
  slug: string;
  is_owner?: boolean;
}

export interface Channel {
  id: number;
  name: string | null;
  type: 'public' | 'private' | 'dm';
  dm_user_id: number | null;
  unread: number;
  section_id: number | null;
  muted?: boolean;
}

export interface Attachment {
  id: number;
  name: string;
  size: number;
  is_image: boolean;
  url: string;
}

export interface Card {
  color: string;
  title: string;
  text: string;
  fields: { title: string; value: string }[];
}

export interface Message {
  id: number;
  channel_id: number;
  parent_id: number | null;
  body: string;
  created_at: string;
  edited_at: string | null;
  removed: boolean;
  pinned: boolean;
  is_bot: boolean;
  user: User;
  cards: Card[];
  reactions: { emoji: string; user_ids: number[] }[];
  attachments: Attachment[];
  reply_count: number;
  parent_reply_count: number | null;
}

export interface Session {
  server: string;
  token: string;
  user: User;
}

const KEY = 'ping-chat-session';

let session: Session | null = null;

export const getSession = () => session;

const store = {
  get: (): Promise<string | null> =>
    Platform.OS === 'web' ? Promise.resolve(localStorage.getItem(KEY)) : SecureStore.getItemAsync(KEY),
  set: async (value: string) =>
    Platform.OS === 'web' ? localStorage.setItem(KEY, value) : SecureStore.setItemAsync(KEY, value),
  clear: async () => (Platform.OS === 'web' ? localStorage.removeItem(KEY) : SecureStore.deleteItemAsync(KEY)),
};

export async function loadSession(): Promise<Session | null> {
  const saved = await store.get();
  session = saved ? JSON.parse(saved) : null;

  return session;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public twoFactorRequired = false,
  ) {
    super(message);
  }
}

async function send<T>(server: string, token: string | null, path: string, method: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;

  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';

  let response: Response;

  try {
    response = await fetch(`${server}/api/v1${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Could not reach the server. Check the address and your Wi-Fi.', 0);
  }

  if (response.status === 204) return undefined as T;

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(data?.message ?? 'Something went wrong. Try again.', response.status, Boolean(data?.two_factor_required));
  }

  return data as T;
}

export function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  if (!session) throw new ApiError('Not signed in.', 401);

  return send<T>(session.server, session.token, path, method, body);
}

export async function login(server: string, email: string, password: string, code?: string): Promise<Session> {
  const clean = server.trim().replace(/\/+$/, '');
  const data = await send<{ token: string; user: User }>(clean, null, '/login', 'POST', {
    email: email.trim().toLowerCase(),
    password,
    code: code || undefined,
    device_name: `Ping Chat ${Platform.OS}`,
  });

  return remember(clean, data);
}

/** Emails a sign in code. The server answers the same way for an address it does not know. */
export async function sendLoginCode(server: string, email: string): Promise<void> {
  await send(cleanServer(server), null, '/login/email', 'POST', { email: email.trim().toLowerCase() });
}

export async function loginWithCode(server: string, email: string, code: string, twoFactorCode?: string): Promise<Session> {
  const clean = cleanServer(server);
  const data = await send<{ token: string; user: User }>(clean, null, '/login/code', 'POST', {
    email: email.trim().toLowerCase(),
    code: code.trim(),
    two_factor_code: twoFactorCode || undefined,
    device_name: `Ping Chat ${Platform.OS}`,
  });

  return remember(clean, data);
}

async function remember(server: string, data: { token: string; user: User }): Promise<Session> {
  session = { server, token: data.token, user: data.user };
  await store.set(JSON.stringify(session));

  return session;
}

export const cleanServer = (server: string) => server.trim().replace(/\/+$/, '');

/** The name to show on the single sign-on button, or null when the server has none. */
export async function ssoName(server: string): Promise<string | null> {
  const data = await send<{ name: string | null }>(cleanServer(server), null, '/sso', 'GET');

  return data.name;
}

export async function ssoExchange(server: string, code: string, verifier: string, twoFactorCode?: string): Promise<Session> {
  const clean = cleanServer(server);
  const data = await send<{ token: string; user: User }>(clean, null, '/sso/exchange', 'POST', {
    code,
    verifier,
    two_factor_code: twoFactorCode || undefined,
    device_name: `Ping Chat ${Platform.OS}`,
  });

  return remember(clean, data);
}

/** Check if Google Sign-In is enabled on the server */
export async function googleEnabled(server: string): Promise<boolean> {
  try {
    const data = await send<{ enabled: boolean }>(cleanServer(server), null, '/google/enabled', 'GET');
    return data.enabled;
  } catch {
    return false;
  }
}

/** Exchange Google OAuth code for session token */
export async function googleExchange(server: string, code: string, verifier: string, twoFactorCode?: string): Promise<Session> {
  const clean = cleanServer(server);
  const data = await send<{ token: string; user: User }>(clean, null, '/google/exchange', 'POST', {
    code,
    verifier,
    two_factor_code: twoFactorCode || undefined,
    device_name: `Ping Chat ${Platform.OS}`,
  });

  return remember(clean, data);
}

export async function logout(): Promise<void> {
  await api('/logout', 'POST').catch(() => {});
  session = null;
  await store.clear();
  await clearLastWorkspace();
}

const LAST_WORKSPACE_KEY = 'ping-chat-last-workspace';

export async function saveLastWorkspace(slug: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(LAST_WORKSPACE_KEY, slug);
  } else {
    await SecureStore.setItemAsync(LAST_WORKSPACE_KEY, slug);
  }
}

export async function getLastWorkspace(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(LAST_WORKSPACE_KEY);
  }
  return SecureStore.getItemAsync(LAST_WORKSPACE_KEY);
}

export async function clearLastWorkspace(): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(LAST_WORKSPACE_KEY);
  } else {
    await SecureStore.deleteItemAsync(LAST_WORKSPACE_KEY);
  }
}

/** Files and photos need the sign-in token; the web app's paths work under the API prefix. */
export function fileSource(path: string) {
  const baseUrl = `${session?.server}/api/v1${path}`;

  // On web, headers don't work with Image component, so use token in URL
  if (Platform.OS === 'web') {
    const separator = path.includes('?') ? '&' : '?';
    return {
      uri: `${baseUrl}${separator}token=${session?.token}`,
    };
  }

  return {
    uri: baseUrl,
    headers: { Authorization: `Bearer ${session?.token}` },
  };
}
