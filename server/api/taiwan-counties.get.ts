import { getTaiwanCountiesList } from '../utils/taiwan-geo'

export default defineEventHandler(async () => {
  return await getTaiwanCountiesList()
})
