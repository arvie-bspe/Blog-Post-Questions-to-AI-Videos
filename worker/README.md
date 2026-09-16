# Private local worker

This worker connects outward to Railway. It runs Codex CLI with the current Windows user's saved login and runs optional local media models. It never opens an inbound port.

Required environment variables:

- `STUDIO_URL`: the Article Video Studio Railway HTTPS URL.
- `STUDIO_WORKER_TOKEN`: the same random private value configured in Railway.
- `CODEX_BIN`: optional Codex executable path.
- `SSL_CERT_FILE`, `REQUESTS_CA_BUNDLE`, and `NODE_EXTRA_CA_CERTS`: optional organization CA bundle paths when the worker's HTTPS connections require them.
- `LOCAL_MEDIA_PYTHON`: optional Python executable for the isolated media environment.
- `KOKORO_MODEL`: full path to the official `kokoro-v1.0.onnx` model.
- `KOKORO_VOICES`: full path to the official `voices-v1.0.bin` file.
- `SADTALKER_DIR`: local SadTalker checkout containing downloaded checkpoints.
- `SADTALKER_PYTHON`: Python executable in SadTalker's separate pinned environment.
- `LOCAL_MEDIA_DEVICE`: `cpu` is the safe default for the current 2 GB GPU; use another value only after a successful benchmark.
- `MEDIA_RENDER_TIMEOUT_MS`: optional local render timeout. The default is six hours because CPU-only talking-video generation is slow.

Use two isolated Python environments because current Kokoro ONNX and SadTalker's older pinned NumPy stack conflict. `LOCAL_MEDIA_PYTHON` runs this orchestrator with `media-requirements.txt`; `SADTALKER_PYTHON` runs SadTalker's `inference.py`. Kokoro's duration output supplies caption timing without a second speech-recognition model. Review and pin the exact model assets and licenses before production.

Start the worker from this repository with `npm run worker`. The command enables Node's operating-system CA store for managed networks. Keep the computer awake and signed in. Stop it with Ctrl+C.
