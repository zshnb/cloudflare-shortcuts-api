import assert from 'node:assert/strict'
import test from 'node:test'
import { extractReaderArticle, extractZhihuArticle, extractZhihuTarget, htmlToText } from '../src/zhihu-answer.ts'

test('extracts plain text from a shared Zhihu answer', () => {
	const sharedContent = '知乎回答 https://www.zhihu.com/question/2045559758153946579/answer/2069584596400967693'
	const html = '<p>第一段 &amp; 内容</p><p>第二段<br>换行，&#x4E2D;&#25991;</p>'

	assert.deepEqual(extractZhihuTarget(sharedContent), { type: 'answer', id: '2069584596400967693' })
	assert.equal(extractZhihuTarget('https://www.zhihu.com.evil.test/question/1/answer/2'), undefined)
	assert.equal(htmlToText(html), '第一段 & 内容\n\n第二段\n换行，中文')
})

test('extracts a Zhihu article from shared content and initial page data', () => {
	const articleId = '2062894434782654668'
	const sharedContent = `知乎文章 https://zhuanlan.zhihu.com/p/${articleId}`
	const article = {
		id: articleId,
		title: 'Gucci也开始拍故事短片啦？让我来试试咸淡',
		content: '<p>文章正文</p>',
		created: 1786240826,
		updated: 1786240869,
		author: { name: '李小丢' },
	}
	const page = `<script id="js-initialData" type="text/json">${JSON.stringify({
		initialState: { entities: { articles: { [articleId]: article } } },
	})}</script>`

	assert.deepEqual(extractZhihuTarget(sharedContent), { type: 'article', id: articleId })
	assert.deepEqual(
		extractZhihuTarget(`${sharedContent}?share_code=abc&utm_psn=123`),
		{ type: 'article', id: articleId },
	)
	assert.deepEqual(extractZhihuArticle(page, articleId), {
		type: 'article',
		id: articleId,
		sourceUrl: sharedContent.slice(5),
		title: article.title,
		author: '李小丢',
		createdAt: '2026-08-09T02:00:26.000Z',
		updatedAt: '2026-08-09T02:01:09.000Z',
		content: '文章正文',
	})
})

test('extracts a challenged Zhihu article from Reader markdown', () => {
	const articleId = '2055782042420372097'
	const markdown = `Title: 对Agent技术的一些随思

URL Source: https://zhuanlan.zhihu.com/p/${articleId}

Markdown Content:
[Agent](https://example.com) 很强。

**边界也很重要。**`

	assert.deepEqual(extractReaderArticle(markdown, articleId), {
		type: 'article',
		id: articleId,
		sourceUrl: `https://zhuanlan.zhihu.com/p/${articleId}`,
		title: '对Agent技术的一些随思',
		author: null,
		createdAt: null,
		updatedAt: null,
		content: 'Agent 很强。\n\n边界也很重要。',
	})
})
