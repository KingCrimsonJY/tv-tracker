import { auth } from './firebase';

/**
 * Authenticated fetch wrapper for /api/* routes.
 * Automatically attaches the signed-in user's Firebase ID token as a Bearer header.
 * Resilient against STS (securetoken.googleapis.com) token refresh errors or disabled API in project.
 */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  const currentUser = auth.currentUser;

  if (currentUser) {
    let idToken: string | null = null;
    try {
      // Pass false to avoid forced network refresh if token is cached
      idToken = await currentUser.getIdToken(false);
    } catch (tokenErr) {
      console.warn('currentUser.getIdToken(false) threw, attempting cached token extraction:', tokenErr);
      const userObj = currentUser as unknown as {
        accessToken?: string;
        stsTokenManager?: { accessToken?: string };
      };
      idToken = userObj.accessToken || userObj.stsTokenManager?.accessToken || null;
    }

    if (idToken) {
      headers.set('Authorization', `Bearer ${idToken}`);
    }
    // Always attach UID header as secondary identifier
    headers.set('X-Firebase-Uid', currentUser.uid);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
