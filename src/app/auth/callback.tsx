import { Redirect } from 'expo-router';

/**
 * Target of the OAuth redirect (debtmate://auth/callback). The browser session in
 * src/features/account/oauth.ts reads the tokens; if the system also opens this
 * route (Android), just go back home.
 */
export default function AuthCallback() {
  return <Redirect href="/" />;
}
