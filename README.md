```txt
npm install
npm run dev
```

```txt
npm run deploy
```

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```txt
npm run cf-typegen
```

## Douyin download URL

```bash
curl -X POST http://localhost:8787/api/douyin-download \
  -H 'Content-Type: application/json' \
  -d '{"sharedContent":"复制打开抖音 https://v.douyin.com/Kn2DKYVTm_s/"}'
```

The response contains the work ID, video resource ID, and a reusable 1080p
official playback URL. The playback URL redirects to Douyin's short-lived CDN URL.

Pass the `CloudflareBindings` as generics when instantiation `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>()
```
