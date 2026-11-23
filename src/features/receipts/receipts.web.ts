// Web receipt photos. The browser has no durable file storage here, so a picked photo is
// kept in memory until the sync uploads it; that's why the web needs an account for photos.
import * as Crypto from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export const receiptsNeedAccount = true;
export const canTakePhoto = false;

const MAX_SIDE = 1600;
const QUALITY = 0.7;

const pending = new Map<string, { blob: Blob; url: string }>();

export type PickResult = { name: string } | { error: 'permission' } | null;

export async function pickReceipt(_source: 'camera' | 'library'): Promise<PickResult> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > MAX_SIDE) {
    context.resize(asset.width >= asset.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: QUALITY, format: SaveFormat.JPEG });
  const blob = await (await fetch(saved.uri)).blob();

  const name = `${Crypto.randomUUID()}.jpg`;
  pending.set(name, { blob, url: URL.createObjectURL(blob) });
  return { name };
}

export function localReceiptUri(name: string): string | null {
  return pending.get(name)?.url ?? null;
}

export async function readReceiptBytes(name: string): Promise<ArrayBuffer | null> {
  const entry = pending.get(name);
  return entry ? entry.blob.arrayBuffer() : null;
}

export function deleteLocalReceipt(name: string): void {
  const entry = pending.get(name);
  if (entry) URL.revokeObjectURL(entry.url);
  pending.delete(name);
}

export function cleanupLocalReceipts(_keep: ReadonlySet<string>): void {}
