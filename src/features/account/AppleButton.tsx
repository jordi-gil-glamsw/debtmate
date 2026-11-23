import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';

import { radius, touchTarget } from '@/theme/tokens';

import { isAppleSignInAvailable } from './oauth';

/** Apple's own button (required by the App Store guidelines). Renders nothing where unavailable. */
export function AppleButton({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    isAppleSignInAvailable().then((ok) => {
      if (!cancelled) setAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!available) return null;
  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
      cornerRadius={radius.lg}
      onPress={disabled ? () => {} : onPress}
      style={{ width: '100%', height: touchTarget + 8, opacity: disabled ? 0.4 : 1 }}
    />
  );
}
