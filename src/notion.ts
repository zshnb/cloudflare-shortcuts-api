export async function createPage(auth: string, page: object) {
	const response = await fetch(`https://api.notion.com/v1/pages`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${auth}`,
			'Notion-Version': '2022-06-28'
		},
		body: JSON.stringify(page)
	})
	if (response.ok) {
		return 'success'
	} else {
		const error = await response.text()
		console.error(`create page error: ${error}`)
		return undefined
	}
}

export type NotionDatabaseQueryResponse = {
	object: 'list'
	results: {
		object: 'page'
		id: string
		properties: {
			[property: string]: {
				id: string
				type: 'multi_select'
				multi_select: {
					id: string
					name: string
				}[]
			}
		}
	}[]
	has_more: boolean
	next_cursor: string
}

type QueryDatabaseRequest = {
	auth: string
	databaseId: string
	start_cursor?: string
}

export async function queryDatabase({auth, databaseId, start_cursor}: QueryDatabaseRequest) {
	try {
		const body = {} as Record<string, string>;
		if (start_cursor) {
			body['start_cursor'] = start_cursor
		}
		const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${auth}`,
				'Notion-Version': '2022-06-28'
			},
			body: JSON.stringify(body)
		})
		if (response.ok) {
			return await response.json() as NotionDatabaseQueryResponse
		} else {
			const error = await response.text()
			console.error(`query database error: ${error}`)
			return undefined
		}
	} catch (error) {
		console.error(`query database error: ${error}`)
		return undefined
	}
}

export async function getAllRedbookTypes(request: QueryDatabaseRequest) {
	const set = new Set()
	let response = await queryDatabase(request)
	if (response) {
		addData(response.results.map(it => it.properties['分类'].multi_select.map(itt => itt.name)).flat())
		let hasMore = response.has_more
		while (hasMore) {
			response = await queryDatabase({...request, start_cursor: response?.next_cursor})
			response && addData(response.results.map(it => it.properties['分类'].multi_select.map(itt => itt.name)).flat())
			hasMore = response?.has_more || false
		}
	}
	return Array.from(set)

	function addData(array: string[]) {
		array.map((item) => set.add(item))
	}
}