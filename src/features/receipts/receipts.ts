// Native (iOS/Android) receipt photos: pick or take a photo, shrink it, and keep it in the
// app's document directory (survives restarts). Upload to the account happens in src/sync.
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/** Photos work without an account on native (they live on the device). */
export const receiptsNeedAccount = false;
export const canTakePhoto = true;

const MAX_SIDE = 1600;
const QUALITY = 0.7;

function receiptsDir(): Directory {
  const dir = new Directory(Paths.document, 'receipts');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export type PickResult = { name: string } | { error: 'permission' } | null;

/** Opens the camera or the photo library; returns the saved file name, or null if cancelled. */
export async function pickReceipt(source: 'camera' | 'library'): Promise<PickResult> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { error: 'permission' };
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const result =
    source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > MAX_SIDE) {
    context.resize(asset.width >= asset.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: QUALITY, format: SaveFormat.JPEG });

  const name = `${Crypto.randomUUID()}.jpg`;
  const temp = new File(saved.uri);
  await temp.copy(new File(receiptsDir(), name));
  if (temp.exists) temp.delete();
  return { name };
}

/** URI to display a photo kept on this device, or null if it only exists in the account. */
export function localReceiptUri(name: string): string | null {
  const file = new File(receiptsDir(), name);
  return file.exists ? file.uri : null;
}

export async function readReceiptBytes(name: string): Promise<ArrayBuffer | null> {
  const file = new File(receiptsDir(), name);
  return file.exists ? file.arrayBuffer() : null;
}

export function deleteLocalReceipt(name: string): void {
  const file = new File(receiptsDir(), name);
  if (file.exists) file.delete();
}

/** Deletes photos no longer referenced (e.g. picked and then cancelled, or removed elsewhere). */
export function cleanupLocalReceipts(keep: ReadonlySet<string>): void {
  for (const entry of receiptsDir().list()) {
    if (entry instanceof File && !keep.has(entry.name)) entry.delete();
  }
}
