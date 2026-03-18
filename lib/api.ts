import * as SecureStore from 'expo-secure-store';

const BASE_URL = 'https://www.toploadcards.com';

const TOKEN_KEY = 'topload_token';
const USER_KEY = 'topload_user';
const DISPLAY_NAME_KEY = 'topload_display_name';

// --- Token management ---

export async function getStoredToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function storeToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function removeToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
  // NOTE: display name is intentionally kept — it persists across sign-outs
  // so the user's chosen nickname survives a session reset or token expiry
}

export async function getDisplayName(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(DISPLAY_NAME_KEY);
  } catch {
    return null;
  }
}

export async function saveDisplayName(name: string): Promise<void> {
  if (name && typeof name === 'string') await SecureStore.setItemAsync(DISPLAY_NAME_KEY, name.trim());
}

export async function getStoredUser(): Promise<{ id: string; email: string; username: string } | null> {
  try {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function storeUser(user: { id: string; email: string; username: string }): Promise<void> {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

// --- Core HTTP using XMLHttpRequest (more reliable in React Native than fetch for POST) ---

function xhrRequest(method: string, url: string, body?: object, token?: string | null): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    xhr.timeout = 15000;
    xhr.ontimeout = () => reject(new Error('Request timed out'));
    xhr.onerror = () => reject(new Error('Network error — check your connection'));
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          reject(new Error(data.error || `Request failed (${xhr.status})`));
        }
      } catch {
        reject(new Error(`Server error (${xhr.status})`));
      }
    };
    xhr.send(body ? JSON.stringify(body) : null);
  });
}

async function apiFetch(path: string, method: string = 'GET', body?: object) {
  const token = await getStoredToken();
  return xhrRequest(method, `${BASE_URL}${path}`, body, token);
}

// --- Auth endpoints ---

export async function login(email: string, password: string) {
  const data = await xhrRequest('POST', `${BASE_URL}/api/auth/login`, { email, password });
  if (data.token && typeof data.token === 'string') await storeToken(data.token);
  const profile = await getMe();
  return { username: data.username, user: profile };
}

export async function signup(email: string, username: string, password: string) {
  const data = await xhrRequest('POST', `${BASE_URL}/api/auth/signup`, { email, username, password });
  if (data.token && typeof data.token === 'string') await storeToken(data.token);
  const profile = await getMe();
  return { username: data.username, user: profile };
}

export async function getMe() {
  const data = await apiFetch('/api/auth/me', 'GET');
  if (data.user) {
    await storeUser(data.user);
  }
  return data.user;
}

export async function logout() {
  try {
    await apiFetch('/api/auth/logout', 'POST');
  } catch {
    // Even if the server call fails, clear local storage
  }
  await removeToken();
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return apiFetch('/api/auth/change-password', 'POST', { currentPassword, newPassword });
}

export async function deleteAccount() {
  const data = await apiFetch('/api/auth/delete-account', 'DELETE');
  await removeToken();
  return data;
}

// --- Cards endpoints ---

export async function getCards() {
  return apiFetch('/api/cards', 'GET');
}

export async function addCard(cardData: Record<string, any>) {
  return apiFetch('/api/cards', 'POST', cardData);
}

export async function updateCard(cardData: Record<string, any>) {
  return apiFetch('/api/cards', 'PUT', cardData);
}

export async function deleteCard(id: string) {
  return apiFetch('/api/cards', 'DELETE', { id });
}

// --- Snapshots ---

export async function getSnapshots() {
  return apiFetch('/api/cards?snapshots=1', 'GET');
}

// --- Activity ---

export async function getActivity() {
  return apiFetch('/api/activity', 'GET');
}

// --- Market ---

export async function searchMarket(query: string) {
  return apiFetch('/api/market', 'POST', { query, source: 'ebay' });
}

// --- PSA ---

export async function lookupPSA(cert: string) {
  return apiFetch(`/api/psa?cert=${encodeURIComponent(cert)}`, 'GET');
}
