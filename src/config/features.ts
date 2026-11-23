/**
 * Feature switches decided at build time (EXPO_PUBLIC_* variables are inlined into the app).
 *
 * receiptPhotos: receipt photos on movements. Off by default because photos use Supabase
 * Storage (a paid-plan concern). To turn it on:
 *   1. Run supabase/migrations/0003_receipts.sql and redeploy supabase/functions/delete-account.
 *   2. Add the "expo-image-picker" config plugin back to app.json (camera/photos permission texts).
 *   3. Set EXPO_PUBLIC_RECEIPT_PHOTOS=1 (in .env.local or the EAS environment) and rebuild.
 */
export const features = {
  receiptPhotos: process.env.EXPO_PUBLIC_RECEIPT_PHOTOS === '1',
} as const;
