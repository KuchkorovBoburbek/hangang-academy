import fs from 'node:fs';
import path from 'node:path';
import { dataDir, id } from './db';
import { AppError } from './auth';
export const MAX_FILE = 5 * 1024 * 1024;
export async function limitedBody(request: Request, limit: number) {
  if (Number(request.headers.get('content-length') || 0) > limit)
    throw new AppError(413, 'Yuborilayotgan ma’lumot juda katta.');
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new AppError(413, 'Fayllar hajmi chegaradan oshdi.');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export function validateFile(buffer: Buffer, mime: string) {
  if (!buffer.length || buffer.length > MAX_FILE)
    throw new AppError(400, 'Har bir fayl 5 MB dan kichik bo‘lishi kerak.');
  const valid =
    (mime === 'application/pdf' && buffer.subarray(0, 5).toString() === '%PDF-') ||
    (mime === 'image/png' &&
      buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (mime === 'image/jpeg' && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) ||
    (mime === 'image/webp' &&
      buffer.subarray(0, 4).toString() === 'RIFF' &&
      buffer.subarray(8, 12).toString() === 'WEBP');
  if (!valid) throw new AppError(400, 'JPG, PNG, WebP rasm yoki PDF faylini tanlang.');
}
export function storeFile(buffer: Buffer) {
  const name = id();
  fs.mkdirSync(path.join(dataDir(), 'uploads'), { recursive: true });
  fs.writeFileSync(path.join(dataDir(), 'uploads', name), buffer, { mode: 0o600 });
  return name;
}
export function readFile(name: string) {
  if (!/^[a-f0-9-]{36}$/.test(name)) throw new AppError(404, 'Fayl topilmadi.');
  return fs.readFileSync(path.join(dataDir(), 'uploads', name));
}
export function removeFile(name: string) {
  fs.rmSync(path.join(dataDir(), 'uploads', name), { force: true });
}

export function validateAudio(buffer: Buffer, mime: string) {
  if (!buffer.length || buffer.length > 20 * 1024 * 1024)
    throw new AppError(400, 'Audio 20 MB dan kichik bo‘lishi kerak.');
  const head = buffer.subarray(0, 4).toString();
  const valid =
    (mime === 'audio/mpeg' &&
      (buffer.subarray(0, 3).toString() === 'ID3' ||
        (buffer[0] === 255 && (buffer[1] & 224) === 224))) ||
    (['audio/wav', 'audio/x-wav'].includes(mime) &&
      head === 'RIFF' &&
      buffer.subarray(8, 12).toString() === 'WAVE') ||
    (['audio/ogg', 'application/ogg'].includes(mime) && head === 'OggS') ||
    (mime === 'audio/webm' && buffer.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]))) ||
    (['audio/mp4', 'audio/x-m4a'].includes(mime) && buffer.subarray(4, 8).toString() === 'ftyp');
  if (!valid) throw new AppError(400, 'MP3, M4A, WAV, OGG yoki WebM audio faylini tanlang.');
}
export function validateLessonFile(buffer: Buffer, mime: string) {
  if (mime.startsWith('audio/') || mime === 'application/ogg') validateAudio(buffer, mime);
  else validateFile(buffer, mime);
}
