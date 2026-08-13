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

## Zhihu answer extraction

```bash
curl -X POST http://localhost:8787/api/zhihu-answer \
  -H 'Content-Type: application/json' \
  -d '{"sharedContent":"https://www.zhihu.com/question/2045559758153946579/answer/2069584596400967693"}'
```

The response contains the question, author, publication timestamps, canonical URL,
and plain-text answer body. The same endpoint also accepts Zhihu article links such
as `https://zhuanlan.zhihu.com/p/2062894434782654668`, including shared links with
`share_code` and `utm_psn` query parameters. Zhihu JavaScript challenges fall back to
Jina Reader, and successful fallback responses are cached for 24 hours.

Configure the Jina API key as a Worker Secret (or add `JINA_API_KEY` in the Cloudflare
dashboard under Workers & Pages → Settings → Variables and Secrets):

```bash
pnpm exec wrangler secret put JINA_API_KEY
```

Pass the `CloudflareBindings` as generics when instantiation `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>()
```
