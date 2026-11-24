import type { Page } from '@playwright/test';

export async function reviewVideoFixture(page: Page) {
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const draw = canvas.getContext('2d')!;
    const stream = canvas.captureStream(15);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
    const chunks: Blob[] = [];
    recorder.ondataavailable = event => chunks.push(event.data);
    const stopped = new Promise<void>(resolve => recorder.addEventListener('stop', () => resolve(), { once: true }));
    recorder.start();
    for (const color of ['#4f46e5', '#38bdf8', '#059669']) {
      draw.fillStyle = color;
      draw.fillRect(0, 0, canvas.width, canvas.height);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    recorder.stop();
    await stopped;
    stream.getTracks().forEach(track => track.stop());
    return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
  });
  return Buffer.from(bytes);
}
