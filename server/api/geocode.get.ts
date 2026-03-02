export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const q = query.q as string

  if (!q) {
    throw createError({
      statusCode: 400,
      message: 'Missing query parameter'
    })
  }

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`

  const response = await fetch(url, {
    headers: { 'User-Agent': 'TaiwanMapPoster/1.0' }
  })

  if (!response.ok) {
    throw createError({
      statusCode: 500,
      message: 'Geocoding failed'
    })
  }

  const data = await response.json()

  return data.map((item: any) => ({
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
    displayName: item.display_name,
    name: item.name || item.display_name.split(',')[0]
  }))
})
