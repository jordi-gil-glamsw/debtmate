import { Alert, Share } from 'react-native';

/** Native confirmation dialog (UIAlertController / Material dialog). */
export function confirm(title: string, message: string, confirmLabel: string, destructive = false): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel·la', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

export function notify(title: string, message: string): void {
  Alert.alert(title, message);
}

/** Opens the native share sheet (WhatsApp, Messages, Mail, Files…). */
export async function shareText(text: string, _filename?: string): Promise<void> {
  await Share.share({ message: text });
}
