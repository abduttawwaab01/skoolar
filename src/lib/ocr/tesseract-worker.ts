import Tesseract from 'tesseract.js';

type ProgressCallback = (progress: number, status: string) => void;

let worker: Tesseract.Worker | null = null;
let currentLang = 'eng';
let currentProgressCallback: ProgressCallback | null = null;

const LANG_MAP: Record<string, string> = {
  eng: 'English',
  yor: 'Yoruba',
  hau: 'Hausa',
  ibo: 'Igbo',
  fra: 'French',
  ara: 'Arabic',
};

export const OCR_LANGUAGES = Object.entries(LANG_MAP).map(([id, label]) => ({ id, label }));

function buildLangString(languages: string[]): string {
  return [...new Set(languages)].join('+');
}

export async function getWorker(languages: string[] = ['eng']): Promise<Tesseract.Worker> {
  const langStr = buildLangString(languages);
  if (worker && currentLang === langStr) return worker;

  if (worker) {
    await worker.terminate().catch(() => {});
    worker = null;
  }

  try {
    worker = await Tesseract.createWorker(langStr, 2, {
      logger: (m: Tesseract.LoggerMessage) => {
        if (m.status === 'recognizing text' && typeof m.progress === 'number') {
          currentProgressCallback?.(m.progress, m.status);
        } else if (m.status) {
          currentProgressCallback?.(0, m.status);
        }
      },
    } as any);
  } catch {
    worker = await Tesseract.createWorker(langStr, 1);
  }
  
  currentLang = langStr;
  return worker;
}

export async function terminateWorker(): Promise<void> {
  if (worker) {
    await worker.terminate().catch(() => {});
    worker = null;
    currentLang = 'eng';
  }
}

export async function recognizeImage(
  image: File | Blob | string,
  languages: string[] = ['eng'],
  onProgress?: ProgressCallback
): Promise<string> {
  const w = await getWorker(languages);
  currentProgressCallback = onProgress || null;

  const { data } = await w.recognize(image);

  currentProgressCallback = null;
  return data.text;
}

export async function recognizeMultiple(
  images: (File | Blob)[],
  languages: string[] = ['eng'],
  onImageProgress?: (index: number, progress: number, status: string) => void,
  onComplete?: (index: number, text: string) => void
): Promise<string[]> {
  const results: string[] = [];

  for (let i = 0; i < images.length; i++) {
    const text = await recognizeImage(images[i], languages, (p, s) => {
      onImageProgress?.(i, p, s);
    });
    results.push(text);
    onComplete?.(i, text);
  }

  return results;
}
