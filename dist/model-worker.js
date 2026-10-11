// Dedicated module worker. Photos are passed as Blobs to the local pipeline;
// only the library and public model files are downloaded. No inference API.
// API verified against Transformers.js 3.8.1 pipelines.js / utils/image.js and
// https://huggingface.co/Xenova/siglip-base-patch16-224.
const LIBRARY_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
const MODEL_ID = 'Xenova/siglip-base-patch16-224';
const BACKEND = 'wasm';

let classifierPromise = null;
let inferenceQueue = Promise.resolve();

function sendProgress(event) {
  const finite = (value) => (Number.isFinite(value) ? value : null);
  self.postMessage({
    type: 'progress',
    status: typeof event.status === 'string' ? event.status : 'loading',
    file: typeof event.file === 'string' ? event.file : '',
    loaded: finite(event.loaded),
    total: finite(event.total),
    progress: Number.isFinite(event.progress)
      ? Math.max(0, Math.min(100, event.progress))
      : null,
  });
}

function getClassifier() {
  if (!classifierPromise) {
    classifierPromise = (async () => {
      sendProgress({ status: 'loading', file: MODEL_ID });
      const { pipeline, env } = await import(LIBRARY_URL);
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      // Supported ONNX flag: single-thread WASM works without COOP/COEP.
      // We are already in a worker, so a second proxy worker is unnecessary.
      env.backends.onnx.wasm.numThreads = 1;
      env.backends.onnx.wasm.proxy = false;
      return pipeline('zero-shot-image-classification', MODEL_ID, {
        device: BACKEND,
        dtype: 'q8',
        progress_callback: sendProgress,
      });
    })().catch((error) => {
      // A rejected download/initialization must not poison subsequent attempts.
      classifierPromise = null;
      throw error;
    });
  }
  return classifierPromise;
}

function sendError(id, error) {
  self.postMessage({
    type: 'error',
    id,
    message: error instanceof Error ? error.message : String(error),
  });
}

async function load(id) {
  try {
    await getClassifier();
    self.postMessage({ type: 'ready' });
  } catch (error) {
    sendError(id, error);
  }
}

async function classify({ id, image, labels }) {
  try {
    if (!(image instanceof Blob) || image.size === 0) {
      throw new Error('Choose a non-empty image file before trying again.');
    }
    if (!Array.isArray(labels) || labels.length === 0
      || labels.some((label) => typeof label !== 'string' || !label.trim())) {
      throw new Error('Classification needs a non-empty list of text labels.');
    }
    const classifier = await getClassifier();
    self.postMessage({ type: 'ready' });
    const start = performance.now();
    // Blob is an official ImageInput. No object URL, fetch, or photo upload.
    const output = await classifier(image, labels, {
      hypothesis_template: 'a photo of {}',
    });
    const inferenceMs = performance.now() - start;
    if (!Array.isArray(output) || output.some((item) => (
      typeof item.label !== 'string' || !Number.isFinite(item.score)
    ))) {
      throw new Error('The local model returned an unexpected result.');
    }
    self.postMessage({
      type: 'result',
      id,
      predictions: output.map(({ label, score }) => ({ label, score })),
      inferenceMs,
      model: MODEL_ID,
      backend: BACKEND,
    });
  } catch (error) {
    sendError(id, error);
  }
}

self.addEventListener('message', ({ data }) => {
  if (!data || typeof data !== 'object') return;
  if (data.type === 'load') {
    void load(data.id);
  } else if (data.type === 'classify') {
    // Serialize model calls; a rejected job must not block later photos.
    inferenceQueue = inferenceQueue.then(() => classify(data)).catch((error) => {
      sendError(data.id, error);
    });
  }
});
