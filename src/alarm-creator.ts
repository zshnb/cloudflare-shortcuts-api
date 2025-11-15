import {Context} from "hono";
import {HumanMessage, SystemMessage} from "@langchain/core/messages";
import {z} from "zod";
import {tool} from "@langchain/core/tools";
import {format} from "date-fns";
import {createAgent, toolStrategy} from "langchain";
import {ChatDeepSeek} from "@langchain/deepseek";

const nowTool = tool(
	async () => {
		return format(new Date(), 'yyyy-MM-dd HH:mm:ss')
	},
	{
		name: 'now_tool',
		description: 'get now datetime in javascript ISO string',
	},
)

const schema = z.object({
	startDatetime: z.string().describe(
		'yyyy-MM-dd HH:mm:ss formatted string representation of user input',
	).optional(),
	endDatetime: z.string().describe(
		'yyyy-MM-dd HH:mm:ss formatted string representation of user input',
	).optional(),
	count: z.number('number count'),
})

const agent = createAgent({
	model: new ChatDeepSeek({
		model: 'deepseek-chat'
	}),
	tools: [nowTool],
	responseFormat: toolStrategy(schema)
})

export default async function handle(c: Context) {
	const input = c.req.query('input')
	if (!input) {
		return c.json({})
	}
	console.log(`input: ${input}`)
	const res = await agent.invoke({
		messages: [
			new SystemMessage(`
      detect date expression in user input，convert to yyyy-MM-dd HH:mm:ss format. detect number count in user input. for example:
      input: 帮我在明天早上5点到6点定10个闹钟
      detect content:
      	- date expression: 明天早上5点, 明天早上6点
      	- number count: 10
      ## Rule
      - only replace date expression, keep others content as same as input
      - calculate user input date expression based on now_tool
      - if only detect one date expression, convert it as startDatetime
    `),
			new HumanMessage(input),
		]
	})

	return c.json(res.structuredResponse)
}