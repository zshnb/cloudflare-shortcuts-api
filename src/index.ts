import { Hono } from 'hono'
import reminderCreatorHandler from './reminder-creator'
import redbookToNotionHandler from './redbook-to-notion'
import redbookNotionTypesHandler from './redbook-notion-types'

type Bindings = {
  DEEPSEEK_API_KEY: string
}

const app = new Hono<{ Bindings: Bindings }>()
app.get('/api/reminder-creator', reminderCreatorHandler)
app.post('/api/redbook-to-notion', redbookToNotionHandler)
app.get('/api/redbook-notion-types', redbookNotionTypesHandler)

export default app
