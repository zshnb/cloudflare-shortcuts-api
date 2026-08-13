import type { Context } from 'hono'

const USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
const ZHIHU_HOSTS = new Set(['zhihu.com', 'www.zhihu.com', 'zhuanlan.zhihu.com'])

type ZhihuAnswerRequest = {
	sharedContent?: string
}

type Bindings = {
	JINA_API_KEY?: string
}

class ReaderRateLimitError extends Error {
	readonly retryAfter: string

	constructor(retryAfter: string) {
		super('Zhihu article reader is rate limited')
		this.retryAfter = retryAfter
	}
}

type ZhihuAnswerResponse = {
	id: string
	content: string
	created_time: number
	updated_time: number
	author: { name: string }
	question: { id: string; title: string }
}

type ZhihuArticle = {
	id: string
	title: string
	content: string
	created: number
	updated: number
	author: { name: string }
}

type ZhihuTarget = {
	type: 'answer' | 'article'
	id: string
}

export function extractZhihuTarget(sharedContent: string): ZhihuTarget | undefined {
	for (const value of sharedContent.match(/https?:\/\/[^\s]+/gi) ?? []) {
		try {
			const url = new URL(value.replace(/[)\]}>，。！？；："'、]+$/u, ''))
			if (!ZHIHU_HOSTS.has(url.hostname.toLowerCase())) continue

			const answerId = url.pathname.match(/\/answer\/(\d+)(?:\/|$)/)?.[1]
			if (answerId) return { type: 'answer', id: answerId }

			const articleId = url.hostname.toLowerCase() === 'zhuanlan.zhihu.com'
				&& url.pathname.match(/^\/p\/(\d+)(?:\/|$)/)?.[1]
			if (articleId) return { type: 'article', id: articleId }
		} catch {
			// Ignore malformed URLs and keep looking through the shared text.
		}
	}
}

export function htmlToText(html: string) {
	return decodeHtmlEntities(html
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<li(?:\s[^>]*)?>/gi, '- ')
		.replace(/<\/(?:p|div|h[1-6]|li|blockquote|pre|section|article)>/gi, '\n\n')
		.replace(/<[^>]+>/g, ''))
		.replace(/\u00a0/g, ' ')
		.replace(/\t+/g, ' ')
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim()
}

function decodeHtmlEntities(value: string) {
	const named: Record<string, string> = {
		amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"',
	}
	return value.replace(/&(#x[\da-f]+|#\d+|amp|apos|gt|lt|nbsp|quot);/gi, (entity, code: string) => {
		if (!code.startsWith('#')) return named[code.toLowerCase()]
		const number = Number.parseInt(code.slice(code[1]?.toLowerCase() === 'x' ? 2 : 1), code[1]?.toLowerCase() === 'x' ? 16 : 10)
		try {
			return String.fromCodePoint(number)
		} catch {
			return entity
		}
	})
}

async function getZhihuAnswer(answerId: string) {
	const response = await fetch(`https://www.zhihu.com/api/v4/answers/${answerId}?include=content`, {
		headers: {
			Accept: 'application/json',
			Referer: `https://www.zhihu.com/answer/${answerId}`,
			'User-Agent': USER_AGENT,
		},
	})
	if (!response.ok) throw new Error(`Zhihu API returned ${response.status}`)

	const answer = await response.json() as ZhihuAnswerResponse
	if (!answer.content || !answer.author?.name || !answer.question?.title) {
		throw new Error('Zhihu API returned an incomplete answer')
	}

	return {
		type: 'answer' as const,
		id: answer.id,
		sourceUrl: `https://www.zhihu.com/question/${answer.question.id}/answer/${answer.id}`,
		title: answer.question.title,
		question: answer.question.title,
		author: answer.author.name,
		createdAt: new Date(answer.created_time * 1000).toISOString(),
		updatedAt: new Date(answer.updated_time * 1000).toISOString(),
		content: htmlToText(answer.content),
	}
}

export function extractZhihuArticle(html: string, articleId: string) {
	const json = html.match(/<script[^>]+id=["']js-initialData["'][^>]*>([\s\S]*?)<\/script>/i)?.[1]
	if (!json) throw new Error('Could not find Zhihu article data')

	let article: ZhihuArticle | undefined
	try {
		const data = JSON.parse(json)
		article = data.initialState?.entities?.articles?.[articleId]
	} catch {
		throw new Error('Could not parse Zhihu article data')
	}
	if (!article?.content || !article.author?.name || !article.title) {
		throw new Error('Zhihu returned an incomplete article')
	}

	return {
		type: 'article' as const,
		id: article.id,
		sourceUrl: `https://zhuanlan.zhihu.com/p/${article.id}`,
		title: article.title,
		author: article.author.name,
		createdAt: new Date(article.created * 1000).toISOString(),
		updatedAt: new Date(article.updated * 1000).toISOString(),
		content: htmlToText(article.content),
	}
}

export function extractReaderArticle(markdown: string, articleId: string) {
	const title = markdown.match(/^Title:\s*(.+)$/m)?.[1]?.trim()
	const content = markdown.split(/^Markdown Content:\s*$/m)[1]?.trim()
	if (!title || !content || content.includes('Target URL returned error')) {
		throw new Error('Could not read Zhihu article')
	}

	return {
		type: 'article' as const,
		id: articleId,
		sourceUrl: `https://zhuanlan.zhihu.com/p/${articleId}`,
		title,
		author: null,
		createdAt: null,
		updatedAt: null,
		content: content
			.replace(/!\[[^\]]*]\([^)]*\)/g, '')
			.replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
			.replace(/^#{1,6}\s+/gm, '')
			.replace(/[*_]{1,2}/g, '')
			.replace(/\n{3,}/g, '\n\n')
			.trim(),
	}
}

async function getZhihuArticle(
	articleId: string,
	apiKey: string | undefined,
	executionCtx: { waitUntil(promise: Promise<unknown>): void },
) {
	const articleUrl = `https://zhuanlan.zhihu.com/p/${articleId}`
	const response = await fetch(articleUrl, {
		headers: { 'User-Agent': USER_AGENT },
	})
	if (response.ok) {
		try {
			return extractZhihuArticle(await response.text(), articleId)
		} catch {
		}
	}

	const readerUrl = `https://r.jina.ai/${articleUrl}`
	const cache = await caches.open('zhihu-articles')
	const cached = await cache.match(readerUrl)
	if (cached) return extractReaderArticle(await cached.text(), articleId)

	const reader = await fetch(readerUrl, {
		headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
	})
	if (reader.status === 429) {
		throw new ReaderRateLimitError(reader.headers.get('retry-after') ?? '60')
	}
	if (!reader.ok) throw new Error(`Zhihu article fallback returned ${reader.status}`)

	const markdown = await reader.text()
	const result = extractReaderArticle(markdown, articleId)
	const cachedResponse = new Response(markdown, {
		headers: {
			'Cache-Control': 'public, max-age=86400',
			'Content-Type': 'text/plain; charset=utf-8',
		},
	})
	executionCtx.waitUntil(cache.put(readerUrl, cachedResponse))
	return result
}

export default async function handle(c: Context<{ Bindings: Bindings }>) {
	let body: ZhihuAnswerRequest
	try {
		body = await c.req.json<ZhihuAnswerRequest>()
	} catch {
		return c.json({ error: true, message: 'Expected a JSON request body' }, 400)
	}

	const target = typeof body.sharedContent === 'string' && extractZhihuTarget(body.sharedContent)
	if (!target) return c.json({ error: true, message: 'No supported Zhihu answer or article URL found' }, 400)

	try {
		return c.json({
			data: target.type === 'answer'
				? await getZhihuAnswer(target.id)
				: await getZhihuArticle(target.id, c.env.JINA_API_KEY, c.executionCtx),
		})
	} catch (error) {
		console.error('zhihu answer extraction failed', error)
		if (error instanceof ReaderRateLimitError) {
			return c.json({ error: true, message: error.message }, 503, {
				'Retry-After': error.retryAfter,
			})
		}
		return c.json({
			error: true,
			message: error instanceof Error ? error.message : 'Zhihu extraction failed',
		}, 502)
	}
}
