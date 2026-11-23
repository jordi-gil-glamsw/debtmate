import { readReceiptBytes } from '@/features/receipts/receipts';
import { supabase } from '@/lib/supabase';

/**
 * Receipt photos in Supabase Storage: private bucket "receipts", one folder per user
 * (<user id>/<file name>), protected by the policies in supabase/migrations/0003_receipts.sql.
 */
const BUCKET = 'receipts';
const SIGNED_URL_SECONDS = 60 * 60;

const path = (userId: string, name: string) => `${userId}/${name}`;

/** Uploads photos that are still on this device; ones that are gone are skipped. */
export async function uploadReceipts(userId: string, names: string[]): Promise<void> {
  if (!supabase) return;
  for (const name of names) {
    const bytes = await readReceiptBytes(name);
    if (!bytes) continue; // no longer on this device (e.g. web reload): nothing to upload
    const { error } = await supabase.storage.from(BUCKET).upload(path(userId, name), bytes, {
      contentType: 'image/jpeg',
      upsert: true,
    });
    if (error) throw error;
  }
}

export async function removeReceipts(userId: string, names: string[]): Promise<void> {
  if (!supabase || names.length === 0) return;
  const { error } = await supabase.storage.from(BUCKET).remove(names.map((n) => path(userId, n)));
  if (error) throw error;
}

const signed = new Map<string, { url: string; expires: number }>();

/** Temporary URL to show a photo that isn't on this device. Null when signed out or offline. */
export async function signedReceiptUrl(name: string): Promise<string | null> {
  if (!supabase) return null;
  const cached = signed.get(name);
  if (cached && cached.expires > Date.now() + 60_000) return cached.url;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path(session.user.id, name), SIGNED_URL_SECONDS);
  if (error || !data) return null;
  signed.set(name, { url: data.signedUrl, expires: Date.now() + SIGNED_URL_SECONDS * 1000 });
  return data.signedUrl;
}
