import { Hono } from 'hono'
import reminderCreatorHandler from './reminder-creator'
import alarmCreatorHandler from './alarm-creator'
import redbookToNotionHandler from './redbook-to-notion'
import redbookNotionTypesHandler from './redbook-notion-types'
import douyinDownloadHandler from './douyin-download'

type Bindings = {
  DEEPSEEK_API_KEY: string
}

const app = new Hono<{ Bindings: Bindings }>()
app.get('/api/reminder-creator', reminderCreatorHandler)
app.post('/api/redbook-to-notion', redbookToNotionHandler)
app.get('/api/redbook-notion-types', redbookNotionTypesHandler)
app.get('/api/alarm-creator', alarmCreatorHandler)
app.get('/api/alarm-creator2', alarmCreatorHandler)
app.post('/api/douyin-download', douyinDownloadHandler)

export default app
