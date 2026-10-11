# Look Again

One photo. A small invitation to notice more.

Look Again uses an open-weight image–text model to choose an observation card from a photograph. A picture of leaves might prompt you to follow a vein with your eyes; a reflection might prompt you to compare the reflected world with the real one. The next action is to look away from the screen.

This is a working browser prototype for the **Touch Grass** theme. Try the [public demo](https://look-again-field-notes.mighty-lime-2940.chatgpt.site/). The source is available in this public repository under the MIT License.

## Run locally

There is no build step, package installation, API key, or inference server. With Python 3 installed, run these commands from the project directory:

```sh
cd dist
python -m http.server 8899
```

Open [http://localhost:8899](http://localhost:8899). Serve `dist`, which contains the complete static app. The private `.openai` hosting metadata is not part of the app or an intended public repository.

Choose a photo or one of the credited samples, then select the AI analysis button. First use downloads approximately **211 MB of q8 model weights**, plus JavaScript, tokenizer/configuration files, and the ONNX runtime. An internet connection and sufficient browser memory are required for that first load. Subsequent model-file reuse depends on browser caching and available storage. The manual focus selector works without loading the AI model and is clearly labelled as a manual choice.

## What the AI does

1. The main page sends the selected image as a `Blob` to a dedicated module worker.
2. [Transformers.js 3.8.1](https://huggingface.co/docs/transformers.js/v3.8.1/en/index) loads [Xenova's ONNX conversion of SigLIP](https://huggingface.co/Xenova/siglip-base-patch16-224), using q8 weights and the ONNX Runtime WASM backend.
3. The model ranks eight fixed English descriptions: leaves, bark, sky, water, flowers, stone, paths, and small living things.
4. The highest-ranked theme selects a **prewritten observation card**. “Why this card?” shows the top three matches. A person can correct the choice by selecting another focus.

The model does not generate the card text or an unrestricted caption. Its matches compare the eight supplied themes; they do not identify species or establish that an object is definitely present. This project does not train or fine-tune a model.

The worker uses this documented pipeline:

```js
pipeline('zero-shot-image-classification', 'Xenova/siglip-base-patch16-224', {
  device: 'wasm',
  dtype: 'q8',
});
```

The classification call supplies the eight labels and `hypothesis_template: 'a photo of {}'`. The worker uses a single WASM thread and serializes inference requests.

## Data, notes, and offline limits

The application passes the photo directly to local inference. It has no photo-upload endpoint, remote inference call, account, analytics, or location request. Public model/runtime downloads still contact Hugging Face and jsDelivr. Selecting a bundled sample loads its image from this app's static host.

The app does not save uploaded photos. It stores at most **12 text notes**, with their theme and date, in this browser origin's `localStorage`. Notes can be cleared in the interface. A card can also be downloaded as a text file. Private browsing or unavailable storage can prevent note saving.

The service worker caches only allowed public runtime/model dependencies. It does not cache the page shell, scripts, sample photos, credentials, uploaded photos, or cards. Cached model files do not by themselves make the page reloadable offline. **Offline reload and physical mobile devices have not been validated.** No full offline/PWA support or mobile performance claim is made here.

## Validation so far

The checks in the table below were performed on October 11, 2026, in a **desktop browser served from localhost**. A separate check of the public deployment loaded the app without sign-in and ran the real model on the bark sample: Bark & texture, Stone & tiny details, then Leaves & light, with 2.3 seconds displayed for inference. This is one hosted desktop observation, excluding download and initialization.

| Sample | Top three themes, in order | Displayed local inference time |
| --- | --- | --- |
| Public-source leaf photo, which also contains water | Water & reflections; Leaves & light; Stone & tiny details | 2.2 seconds |
| Public-source bark photo | Bark & texture; Stone & tiny details; Leaves & light | 2.1 seconds, then 2.2 seconds on another run |

These timings exclude model download and initialization. They are individual observations, not a benchmark or an accuracy estimate.

The following interactions were also checked:

- Selecting a local image file and running analysis again.
- Cancelling the AI interaction, choosing the manual Sky focus, and confirming that a late AI result did not overwrite that manual card.
- Opening and closing the observation modal.
- Saving a test note, reloading to confirm persistence, and clearing the saved note afterward.
- Downloading a manually selected card as text and confirming that its attribution correctly identifies the manual choice.

A **390 × 844 desktop-browser viewport** check exposed horizontal overflow in the photo frame. After setting the frame width to `100%`, the layout check reported `clientWidth = scrollWidth = 375`; a screenshot was captured. This is a narrow-screen desktop check, not a test on a physical phone.

Physical mobile devices, disconnected page reloads, and outdoor use have **not** been tested. The separate [validation record](validation.json) records the checks; these observations do not establish broader device support or user outcomes.

## Public source checks

Run `node scripts/check-public-source.mjs` from this public source copy. It uses only Node's standard library to check JavaScript syntax without executing imports, local HTML resource paths, the two sample photographs' credited byte counts and SHA-256 hashes, license notices, and an explicit public-file allowlist. The allowlist rejects unexpected files such as private hosting metadata; it is not a content or secrets scanner.

The clean export passed locally on **Node 24.19.0**. Separate test copies correctly rejected a fake `.openai` directory, a changed photo hash, a changed photo byte count, and an HTML path outside `dist`. The GitHub Actions workflow uses **Node 22** on a standard Ubuntu runner; its [first public run](https://github.com/superzym/look-again/actions/runs/38138451431) passed on October 11, 2026 (11 seconds total). These are packaging and integrity checks, not browser-behavior or model-accuracy tests. They do not download or run the model.

## Source layout

| File | Purpose |
| --- | --- |
| `dist/index.html`, `dist/styles.css` | Static interface and styling |
| `dist/app.js` | Eight themes, card library, image selection, correction, and local notes |
| `dist/model-worker.js` | SigLIP loading and browser inference |
| `dist/sw.js` | Restricted caching of public inference dependencies |
| `dist/assets/credits.json` | Sample-photo provenance, licenses, and hashes |
| `research-model.json` | Verified model/API sources and research limits |

## Development and attribution

This project was developed with AI assistance, including code and documentation. Observation-card copy is prewritten in the app; it is not produced by the model at runtime. The demonstration photos are credited public-source photographs, not photographs taken by the creator during a walk. No outdoor field trial or user study is claimed.

Original project source is offered under the [MIT License](LICENSE). The model, libraries, and photographs retain their own terms: Google SigLIP's upstream model is Apache-2.0, Transformers.js is Apache-2.0, ONNX Runtime is MIT, and the two demo photographs are CC0. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for official sources and scope.
