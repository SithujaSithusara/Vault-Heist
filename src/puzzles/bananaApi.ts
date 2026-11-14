import 'server-only';
import { Buffer } from 'node:buffer';

const endpoint = 'https://marcconrad.com/uob/banana/api.php?out=json&base64=yes';
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const maxResponseBytes = 1024 * 1024;

async function readPuzzleResponse(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error('Banana API returned no response body.');
  }

  const chunks: Uint8Array[] = [];
  let bytesRead = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      bytesRead += value.byteLength;
      if (bytesRead > maxResponseBytes) {
        await reader.cancel();
        throw new Error('Banana API response exceeded the size limit.');
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return JSON.parse(Buffer.concat(chunks, bytesRead).toString('utf8'));
}

export async function fetchBananaPuzzle() {
  const response = await fetch(endpoint, {
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Banana API returned HTTP ${response.status}.`);
  }

  const puzzle = await readPuzzleResponse(response);

  if (typeof puzzle !== 'object' || puzzle === null || !('question' in puzzle) ||
      typeof puzzle.question !== 'string' ||
      !('solution' in puzzle) ||
      typeof puzzle.solution !== 'number' ||
      !Number.isInteger(puzzle.solution) ||
      puzzle.solution < 0 ||
      puzzle.solution > 9
  ) {
    throw new Error('Banana API returned an invalid puzzle.');
  }

  const imageBytes = Buffer.from(puzzle.question, 'base64');

  if (
    imageBytes.toString('base64') !== puzzle.question ||
    !imageBytes.subarray(0, pngSignature.length).equals(pngSignature)
  ) {
    throw new Error('Banana API returned an invalid PNG payload.');
  }

  return {
    imageBytes,
    imageContentType: 'image/png',
    solutionDigit: puzzle.solution,
  };
}