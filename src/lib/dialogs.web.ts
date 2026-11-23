// Web versions: react-native-web's Alert is a no-op, so use the browser's dialogs.

export async function confirm(title: string, message: string, _confirmLabel: string, _destructive = false): Promise<boolean> {
  return window.confirm(`${title}\n\n${message}`);
}

export function notify(title: string, message: string): void {
  window.alert(`${title}\n\n${message}`);
}

/** Uses the Web Share API when available; otherwise downloads a file (with a filename) or copies to the clipboard. */
export async function shareText(text: string, filename?: string): Promise<void> {
  if (filename) {
    const blob = new Blob([`﻿${text}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch {
      // cancelled or unsupported → fall through to clipboard
    }
  }
  await navigator.clipboard?.writeText(text);
  window.alert('Text copiat al porta-retalls.');
}
