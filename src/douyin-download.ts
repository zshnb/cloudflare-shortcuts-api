import type { Context } from 'hono'

const USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
const DOUYIN_HOSTS = new Set([
	'v.douyin.com',
	'douyin.com',
	'www.douyin.com',
	'm.douyin.com',
	'iesdouyin.com',
	'www.iesdouyin.com',
])

type DouyinDownloadRequest = {
	sharedContent?: string
}

export function extractDouyinUrl(sharedContent: string) {
	for (const value of sharedContent.match(/https?:\/\/[^\s]+/gi) ?? []) {
		try {
			const url = new URL(value.replace(/[)\]}>，。！？；："'、]+$/u, ''))
			if (DOUYIN_HOSTS.has(url.hostname.toLowerCase())) return url
		} catch {
			// Ignore malformed URLs and keep looking through the shared text.
		}
	}
}

export function extractAwemeId(value: string) {
	return value.match(/\/video\/(\d+)/)?.[1]
}

export function extractVideoId(html: string) {
	return html.match(/"play_addr"\s*:\s*\{\s*"uri"\s*:\s*"([^"]+)"/)?.[1]
}

export function buildDownloadUrl(videoId: string) {
	const url = new URL('https://aweme.snssdk.com/aweme/v1/play/')
	url.search = new URLSearchParams({ video_id: videoId, ratio: '720p', line: '0' }).toString()
	return url.toString()
}

async function resolveAwemeId(url: URL) {
	let current = url
	for (let i = 0; i < 3; i++) {
		const awemeId = extractAwemeId(current.pathname)
		if (awemeId) return awemeId

		const response = await fetch(current, {
			redirect: 'manual',
			headers: { 'User-Agent': USER_AGENT },
		})
		const location = response.headers.get('location')
		if (!location) throw new Error(`Douyin redirect missing (${response.status})`)

		current = new URL(location, current)
		if (!DOUYIN_HOSTS.has(current.hostname.toLowerCase())) {
			throw new Error('Douyin redirected to an unsupported host')
		}
	}
	throw new Error('Could not resolve the Douyin video ID')
}

async function getDouyinDownload(url: URL) {
	const awemeId = await resolveAwemeId(url)
	const response = await fetch(`https://www.iesdouyin.com/share/video/${awemeId}/?from_ssr=1`, {
		headers: { 'User-Agent': USER_AGENT },
	})
	if (!response.ok) throw new Error(`Douyin share page returned ${response.status}`)

	const videoId = extractVideoId(await response.text())
	if (!videoId) throw new Error('Could not find the video resource ID')

	return {
		awemeId,
		videoId,
		downloadUrl: buildDownloadUrl(videoId),
	}
}

export default async function handle(c: Context) {
	let body: DouyinDownloadRequest
	try {
		body = await c.req.json<DouyinDownloadRequest>()
	} catch {
		return c.json({ error: true, message: 'Expected a JSON request body' }, 400)
	}

	const url = typeof body.sharedContent === 'string' && extractDouyinUrl(body.sharedContent)
	if (!url) return c.json({ error: true, message: 'No supported Douyin URL found' }, 400)

	try {
		return c.json({ data: await getDouyinDownload(url) })
	} catch (error) {
		console.error('douyin download extraction failed', error)
		return c.json({
			error: true,
			message: error instanceof Error ? error.message : 'Douyin extraction failed',
		}, 502)
	}
}
