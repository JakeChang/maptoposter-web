import { generatePoster, type Theme } from '../utils/poster'
import { getCountyById, normalizeToMultiPolygon, getCountyBbox, getTownById, normalizeTownToMultiPolygon, getTownBbox } from '../utils/taiwan-geo'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const {
    lat,
    lon,
    dist = 5000,
    theme,
    width = 2400,
    height = 3200,
    cityName = 'City',
    countryName = 'Country',
    reliefIntensity = 0,
    mode = 'custom',
    countyId,
    townId,
    markers = [],
    legendPosition = 'bottom-left'
  } = body

  // Taiwan Town mode
  if (mode === 'taiwan-town') {
    if (!townId || !theme) {
      throw createError({
        statusCode: 400,
        message: 'Missing required parameters for taiwan-town mode: townId, theme'
      })
    }

    const town = await getTownById(townId)
    if (!town) {
      throw createError({
        statusCode: 404,
        message: `Town not found: ${townId}`
      })
    }

    const townBbox = await getTownBbox(townId)
    const townBoundary = normalizeTownToMultiPolygon(town.geometry)
    const displayName = cityName || town.properties.town

    try {
      const buffer = await generatePoster({
        lat: 0,
        lon: 0,
        dist: 0,
        theme: theme as Theme,
        width: parseInt(width),
        height: parseInt(height),
        cityName: displayName,
        countryName,
        reliefIntensity: parseInt(reliefIntensity) || 0,
        mode: 'taiwan-county', // Reuse county mode logic
        countyBoundary: townBoundary,
        countyBbox: townBbox!,
        markers,
        legendPosition
      })

      setHeader(event, 'Content-Type', 'image/png')
      const filename = displayName.replace(/[^a-zA-Z0-9]/g, '_') + '_poster.png'
      const encodedFilename = encodeURIComponent(displayName + '_poster.png')
      setHeader(event, 'Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`)

      return buffer
    } catch (error: any) {
      console.error('Poster generation error:', error)
      throw createError({
        statusCode: 500,
        message: error.message || 'Failed to generate poster'
      })
    }
  }

  // Taiwan County mode
  if (mode === 'taiwan-county') {
    if (!countyId || !theme) {
      throw createError({
        statusCode: 400,
        message: 'Missing required parameters for taiwan-county mode: countyId, theme'
      })
    }

    const county = await getCountyById(countyId)
    if (!county) {
      throw createError({
        statusCode: 404,
        message: `County not found: ${countyId}`
      })
    }

    const countyBbox = await getCountyBbox(countyId)
    const countyBoundary = normalizeToMultiPolygon(county.geometry)
    const displayName = cityName || county.properties.county

    try {
      const buffer = await generatePoster({
        lat: 0,
        lon: 0,
        dist: 0,
        theme: theme as Theme,
        width: parseInt(width),
        height: parseInt(height),
        cityName: displayName,
        countryName,
        reliefIntensity: parseInt(reliefIntensity) || 0,
        mode: 'taiwan-county',
        countyId,
        countyBoundary,
        countyBbox: countyBbox!,
        markers,
        legendPosition
      })

      setHeader(event, 'Content-Type', 'image/png')
      const filename = displayName.replace(/[^a-zA-Z0-9]/g, '_') + '_poster.png'
      const encodedFilename = encodeURIComponent(displayName + '_poster.png')
      setHeader(event, 'Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`)

      return buffer
    } catch (error: any) {
      console.error('Poster generation error:', error)
      throw createError({
        statusCode: 500,
        message: error.message || 'Failed to generate poster'
      })
    }
  }

  // Custom mode
  if (!lat || !lon || !theme) {
    throw createError({
      statusCode: 400,
      message: 'Missing required parameters: lat, lon, theme'
    })
  }

  try {
    const buffer = await generatePoster({
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      dist: parseInt(dist),
      theme: theme as Theme,
      width: parseInt(width),
      height: parseInt(height),
      cityName,
      countryName,
      reliefIntensity: parseInt(reliefIntensity) || 0,
      mode: 'custom',
      markers,
      legendPosition
    })

    setHeader(event, 'Content-Type', 'image/png')
    const filename = cityName.replace(/[^a-zA-Z0-9]/g, '_') + '_poster.png'
    const encodedFilename = encodeURIComponent(cityName + '_poster.png')
    setHeader(event, 'Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`)

    return buffer
  } catch (error: any) {
    console.error('Poster generation error:', error)
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to generate poster'
    })
  }
})
