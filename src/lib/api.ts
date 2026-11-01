import { auth } from './firebase';

/**
 * Authenticated fetch wrapper for /api/* routes.
 * Automatically attaches the signed-in user's Firebase ID token as a Bearer header.
 */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  const currentUser = auth.currentUser;
  if (currentUser) {
    const idToken = await currentUser.getIdToken();
    headers.set('Authorization', `Bearer ${idToken}`);
  }
  return fetch(input, {
    ...init,
    headers,
  });
}
