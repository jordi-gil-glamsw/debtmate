// Native (iOS/Android) Apple and Google sign-in.
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

import { AuthCancelled } from './auth';

function client() {
  if (!supabase) throw new Error('Els comptes no estan configurats en aquesta versió.');
  return supabase;
}

/** Native Sign in with Apple exists only on iOS. */
export async function isAppleSignInAvailable(): Promise<boolean> {
  return Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync());
}

export async function signInWithApple(): Promise<void> {
  // Apple receives the SHA-256 of a one-time nonce; Supabase gets the raw value and checks they match.
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') throw new AuthCancelled();
    throw e;
  }
  if (!credential.identityToken) throw new Error('Apple no ha retornat cap identificador.');

  const { error } = await client().auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) throw error;

  // Apple sends the name only the first time: keep it in the account.
  const { givenName, middleName, familyName } = credential.fullName ?? {};
  const fullName = [givenName, middleName, familyName].filter(Boolean).join(' ');
  if (fullName) {
    await client().auth.updateUser({ data: { full_name: fullName, given_name: givenName, family_name: familyName } });
  }
}

/** Reads the tokens (or PKCE code) Supabase appends to the redirect URL. */
async function createSessionFromUrl(url: string): Promise<void> {
  const params = new URLSearchParams();
  const [beforeHash, hash = ''] = url.split('#');
  const query = beforeHash.split('?')[1] ?? '';
  for (const part of [query, hash]) new URLSearchParams(part).forEach((v, k) => params.set(k, v));

  const errorDescription = params.get('error_description');
  if (errorDescription) throw new Error(errorDescription);

  const code = params.get('code');
  if (code) {
    const { error } = await client().auth.exchangeCodeForSession(code);
    if (error) throw error;
    return;
  }
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) throw new Error('No s’ha pogut completar l’inici de sessió.');
  const { error } = await client().auth.setSession({ access_token, refresh_token });
  if (error) throw error;
}

/** Google through the system browser (ASWebAuthenticationSession / Custom Tabs). */
export async function signInWithGoogle(): Promise<void> {
  const redirectTo = Linking.createURL('auth/callback');
  const { data, error } = await client().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') throw new AuthCancelled();
  await createSessionFromUrl(result.url);
}
