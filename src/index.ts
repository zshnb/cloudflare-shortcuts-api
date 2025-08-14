import { Hono } from 'hono'
import {z} from "zod";
import {tool} from "@langchain/core/tools";
import {format} from "date-fns";
import {ChatDeepSeek} from "@langchain/deepseek";
import {HTTPException} from 'hono/http-exception'
import * as _ from "lodash";
import {HumanMessage, SystemMessage} from "@langchain/core/messages";

type Bindings = {
  DEEPSEEK_API_KEY: string
}

const app = new Hono<{ Bindings: Bindings }>()
const model = new ChatDeepSeek({
  model: 'deepseek-chat',
  temperature: 0,
  verbose: false,
})

const nowTool = tool(
  async () => {
    return format(new Date(), 'yyyy-MM-dd HH:mm:ss')
  },
  {
    name: 'now_tool',
    description: 'get now datetime in javascript ISO string',
  },
)

app.get('/api/reminder-creator', async (c) => {
  const input = c.req.query('input')
  console.log(`input: ${input}`)
  const schema = z.object({
    datetime: z
    .string()
    .describe(
      'yyyy-MM-dd HH:mm:ss formatted string representation of user input',
    ),
    thing: z.string().describe('what plan to do of user input'),
    type: z.enum(['reminder', 'calender']),
  })
  const structuredLlm = model.withStructuredOutput(schema)
  const {
    datetime: rawDatetimeExpression,
    thing,
    type,
  } = await structuredLlm.invoke(input!!)
  console.log(
    `raw structure: datetime: ${rawDatetimeExpression}, thing: ${thing}, type: ${type}`,
  )
  if (_.isEmpty(thing)) {
    throw new HTTPException(400, {message: '没有内容'})
  }
  if (_.isEmpty(rawDatetimeExpression)) {
    throw new HTTPException(400, {message: '没有时间'})
  }

  const toolRes = await nowTool.invoke(rawDatetimeExpression)
  console.log(`now tool result: ${toolRes}`)
  const res = await model.invoke([
    new SystemMessage(`
      detect date expression in user input，convert to yyyy-MM-dd HH:mm:ss format.
      ## Rule
      - only replace date expression, keep others content as same as input
      - calculate user input date expression based on ${toolRes}
      - detect type, convert user input's type into **reminder** or **calender**, if cannot detect the type, use reminder as default
    `),
    new HumanMessage(
      JSON.stringify({ datetime: rawDatetimeExpression, thing, type }),
    ),
  ])

  console.log(`refined answer: ${res.content}`)
  const result =  await structuredLlm.invoke(res.content as string)
  return c.json(result)
})

export default app
