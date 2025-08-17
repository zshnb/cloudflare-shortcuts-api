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