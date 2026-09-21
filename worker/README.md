# Private local worker

This worker connects outward to Railway and runs Codex CLI with the current Windows user's saved login for article analysis and script revisions. It opens no inbound port. Production video generation uses HeyGen and does not run Kokoro, LiteAvatar, or SadTalker workers.

Required environment variables:

- `STUDIO_URL`: the Article Video Studio Railway HTTPS URL.
- `STUDIO_WORKER_TOKEN`: the same random private value configured in Railway.
- `CODEX_BIN`: optional Codex executable path.
- `SSL_CERT_FILE`, `REQUESTS_CA_BUNDLE`, and `NODE_EXTRA_CA_CERTS`: optional organization CA bundle paths when the worker's HTTPS connections require them.

Set `STUDIO_WORKER_TYPES=ai_codex` so the worker claims reasoning tasks only. Historical local-media environment variables may still appear in old private configuration files, but the current production workflow does not use them.

Start the worker from this repository with `npm run worker`. The command enables Node's operating-system CA store for managed networks. Keep the computer awake and signed in. Stop it with Ctrl+C.
