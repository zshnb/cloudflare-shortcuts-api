import {Context} from "hono";
import {getAllRedbookTypes} from "./notion";

export default async function handle(c: Context) {
	const key = c.req.query('key')
	const databaseId = c.req.query('databaseId')
	if (!key || !databaseId) {
		return c.json({
			error: true
		})
	}
	const data = await getAllRedbookTypes({auth: key, databaseId: databaseId})
	if (data) {
		return c.json({
			data
		})
	} else {
		c.json({
			error: true
		})
	}
}