# Third-party notices

Verified against the linked upstream sources on October 11, 2026.

The root `LICENSE` applies to original Look Again source and documentation. It does not relicense model weights, third-party libraries, or photographs. The current app downloads its model and runtime dependencies from their public hosts; those weights and libraries are not bundled in this source directory. Their original license files and notices must accompany any future redistribution that requires them.

## Google SigLIP and the Xenova ONNX conversion

- Upstream model: [google/siglip-base-patch16-224](https://huggingface.co/google/siglip-base-patch16-224).
- Upstream model license: **Apache License 2.0**, explicitly identified on the Google model page.
- Browser model: [Xenova/siglip-base-patch16-224](https://huggingface.co/Xenova/siglip-base-patch16-224).
- Conversion provenance: the Xenova model card identifies the Google model as its source and provides ONNX weights for Transformers.js.
- Weight inventory: [ONNX files](https://huggingface.co/Xenova/siglip-base-patch16-224/tree/main/onnx). The q8 combined file is approximately 211 MB; this size excludes other downloaded dependencies.
- License text: [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).

The Apache-2.0 statement here is the explicit upstream model license. The conversion card does not separately declare a different license, and this project does not claim to relicense the conversion. The project uses these existing weights without training or fine-tuning them. Google and Xenova are identified for provenance, not as sponsors or endorsers.

## Transformers.js 3.8.1

- Project: [huggingface/transformers.js](https://github.com/huggingface/transformers.js).
- License: **Apache License 2.0**; [license at version 3.8.1](https://github.com/huggingface/transformers.js/blob/3.8.1/LICENSE).
- Runtime import: `https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1`.
- Official browser API: [Transformers.js 3.8.1 documentation](https://huggingface.co/docs/transformers.js/v3.8.1/en/index).

## ONNX Runtime

- Project: [microsoft/onnxruntime](https://github.com/microsoft/onnxruntime).
- License: **MIT**, copyright Microsoft Corporation; [official license](https://github.com/microsoft/onnxruntime/blob/main/LICENSE).
- Used through Transformers.js for browser WASM inference. Look Again does not specify or claim a separately tested ONNX Runtime version.

## Demonstration photographs

Both images are real public-source photographs supplied through Wikimedia Commons. They are not creator field-test photos and are not AI-generated images. The Commons file pages explicitly identify the following CC0 dedications:

| Local asset | Work and author | Source | Terms |
| --- | --- | --- | --- |
| `dist/assets/demo-leaf.jpg` | “Leaf c.jpg” by E.Prabha | [Wikimedia Commons file page](https://commons.wikimedia.org/wiki/File:Leaf_c.jpg) | CC0 1.0 Universal |
| `dist/assets/demo-bark.jpg` | “Tree Bark.jpg” by Juliane Collins (Sparkveela) | [Wikimedia Commons file page](https://commons.wikimedia.org/wiki/File:Tree_Bark.jpg) | CC0 1.0 Universal |

The app uses Wikimedia-generated thumbnails, without local image edits. Attribution is retained for provenance even though CC0 does not require attribution. See the [CC0 deed](https://creativecommons.org/publicdomain/zero/1.0/) and [legal text](https://creativecommons.org/publicdomain/zero/1.0/legalcode). Exact source revisions, dimensions, downloaded URLs, and SHA-256 hashes are recorded in `dist/assets/credits.json`.

User-selected photographs remain separate from these sample assets; selecting a local file does not assign it the project's MIT license.
