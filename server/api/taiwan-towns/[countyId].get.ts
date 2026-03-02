import { getTownsByCountyId } from '../../utils/taiwan-geo'

export default defineEventHandler(async (event) => {
  const countyId = getRouterParam(event, 'countyId')

  if (!countyId) {
    throw createError({
      statusCode: 400,
      message: 'Missing county ID'
    })
  }

  const towns = await getTownsByCountyId(countyId)

  return towns
})
