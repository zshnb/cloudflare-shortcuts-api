// @ts-nocheck
import {Context} from "hono";
import {createNotionBuilder} from "notion-helper";
import {createPage} from "./notion";

type RedbookToNotionRequest = {
	sharedContent: string
	key: string
	databaseId: string
	type: string
}

type GetXhsResponse = {
	message: string
	data: {
		'作品标题': string
		'作品描述': string
		'下载地址': string[]
		'发布时间': string
		'作品ID': string
		'作者昵称': string
	}
}

const handle = async (c: Context) =>  {
	const body = await c.req.json<RedbookToNotionRequest>()
	const { sharedContent, key, databaseId, type } = body
	const link = extractRedbookLink(sharedContent)
	if (link) {
		try {
			const response = await fetch('https://zshnb.com/xhs/', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					url: link,
				}),
			})
			const xhsResponse = (await response.json()) as GetXhsResponse
			const builder = createNotionBuilder()
				.parentDb(databaseId)
				.title('标题', xhsResponse.data.作品标题)
				.richText('笔记链接', sharedContent)
				.richText('作者', xhsResponse.data.作者昵称)
				.date('发布时间', xhsResponse.data.发布时间)
				.multiSelect('分类', type)
				.multiSelect('平台', '小红书')

			xhsResponse.data.下载地址.map((it) => {
				builder.file(it)
			})

			const page = builder.build()
			const createResult = await createPage(key, page.content)
			if (createResult) {
				return c.json({
					data: 'success'
				})
			} else {
				return c.json({
					error: true
				})
			}
		} catch (e) {
			console.error(`redbook to notion failed, request: ${JSON.stringify(body)}`, e)
			return c.json({
				error: true
			})
		}
	} else {
		return c.json({
			error: true
		})
	}
}

function extractRedbookLink(sharedContent: string) {
	const re = /http(s)?:\/\/xhslink\.com(\/[0-9a-zA-Z]+)+/
	const result = sharedContent.match(re)
	if (result === null) {
		return undefined
	} else {
		return result[0]
	}
}

export default handle