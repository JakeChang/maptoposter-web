import { createCanvas } from '@napi-rs/canvas'
import robustPointInPolygon from 'robust-point-in-polygon'
import type { Theme, PosterOptions, Coord, Way, OsmData, BBox, Marker, LegendPosition } from '../../types'

// Re-export types for backward compatibility
export type { Theme, PosterOptions }

/**
 * Check if a point is inside a MultiPolygon
 */
function isPointInMultiPolygon(lon: number, lat: number, multiPolygon: number[][][][]): boolean {
  for (const polygon of multiPolygon) {
    const outerRing = polygon[0]
    const result = robustPointInPolygon(outerRing, [lon, lat])

    if (result <= 0) {
      let inHole = false
      for (let i = 1; i < polygon.length; i++) {
        const holeResult = robustPointInPolygon(polygon[i], [lon, lat])
        if (holeResult <= 0) {
          inHole = true
          break
        }
      }
      if (!inHole) {
        return true
      }
    }
  }
  return false
}

/**
 * Filter Way coordinates to only include points inside the county boundary
 */
function clipWayToCounty(way: Way, countyBoundary: number[][][][]): Way | null {
  let hasPointInside = false

  for (const coord of way.coords) {
    if (isPointInMultiPolygon(coord.lon, coord.lat, countyBoundary)) {
      hasPointInside = true
      break
    }
  }

  if (!hasPointInside) {
    return null
  }

  return { ...way }
}

/**
 * Clip OSM data to county boundary
 */
function clipDataToCounty(osmData: OsmData, countyBoundary: number[][][][]): OsmData {
  const clippedWays: OsmData['ways'] = {
    roads: [],
    water: [],
    parks: []
  }

  for (const road of osmData.ways.roads) {
    const clipped = clipWayToCounty(road, countyBoundary)
    if (clipped) clippedWays.roads.push(clipped)
  }

  for (const water of osmData.ways.water) {
    const clipped = clipWayToCounty(water, countyBoundary)
    if (clipped) clippedWays.water.push(clipped)
  }

  for (const park of osmData.ways.parks) {
    const clipped = clipWayToCounty(park, countyBoundary)
    if (clipped) clippedWays.parks.push(clipped)
  }

  return { ...osmData, ways: clippedWays }
}

/**
 * Calculate the approximate size of a bounding box in meters
 */
function calculateBboxSizeMeters(bbox: BBox): number {
  const centerLat = (bbox.south + bbox.north) / 2
  const latDist = (bbox.north - bbox.south) * 111000
  const lonDist = (bbox.east - bbox.west) * 111000 * Math.cos(centerLat * Math.PI / 180)
  // Return the larger dimension
  return Math.max(latDist, lonDist)
}

/**
 * Build Overpass query for fetching OSM data
 * includeMinorRoads: include service roads, footways, paths when range < 3km
 */
function buildOverpassQuery(bbox: BBox, includeMinorRoads: boolean): string {
  // Major roads always included
  const majorRoads = 'motorway|trunk|primary|secondary|tertiary|residential|living_street|unclassified'
  // Minor roads only for small areas
  const minorRoads = 'service|footway|path|track|pedestrian'
  const roadTypes = includeMinorRoads ? `${majorRoads}|${minorRoads}` : majorRoads

  return `
    [out:json][timeout:120];
    (
      way["highway"~"${roadTypes}"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      way["natural"~"water|bay"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      relation["natural"~"water|bay"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      way["waterway"="riverbank"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      way["waterway"="river"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      way["leisure"="park"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      way["landuse"="grass"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
    );
    out body;
    >;
    out skel qt;
  `
}

/**
 * Process raw OSM API response into structured data
 */
function processOsmResponse(osmData: any, bbox: BBox): OsmData {
  const nodes = new Map<number, Coord>()
  const ways: OsmData['ways'] = { roads: [], water: [], parks: [] }

  for (const el of osmData.elements) {
    if (el.type === 'node') {
      nodes.set(el.id, { lat: el.lat, lon: el.lon })
    }
  }

  for (const el of osmData.elements) {
    if (el.type === 'way' && el.nodes) {
      const coords = el.nodes
        .map((nodeId: number) => nodes.get(nodeId))
        .filter((n: Coord | undefined): n is Coord => n !== undefined)

      if (coords.length < 2) continue

      const tags = el.tags || {}

      if (tags.highway) {
        ways.roads.push({ type: tags.highway, coords })
      } else if (tags.natural === 'water' || tags.natural === 'bay' || tags.waterway) {
        ways.water.push({ coords, isLine: tags.waterway === 'river' })
      } else if (tags.leisure === 'park' || tags.landuse === 'grass') {
        ways.parks.push({ coords })
      }
    }
  }

  return { ways, bbox }
}

/**
 * Fetch OSM data from Overpass API
 */
async function fetchOsmFromOverpass(bbox: BBox): Promise<OsmData> {
  // Include minor roads only when area is smaller than 3km
  const bboxSize = calculateBboxSizeMeters(bbox)
  const includeMinorRoads = bboxSize < 6000 // 3km radius = 6km diameter

  const query = buildOverpassQuery(bbox, includeMinorRoads)

  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`
  })

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.statusText}`)
  }

  const osmData = await response.json()
  return processOsmResponse(osmData, bbox)
}

/**
 * Fetch OSM data using center point and radius
 */
export async function fetchOSMData(lat: number, lon: number, dist: number): Promise<OsmData> {
  const latDelta = dist / 111000
  const lonDelta = dist / (111000 * Math.cos(lat * Math.PI / 180))

  const bbox: BBox = {
    south: lat - latDelta,
    north: lat + latDelta,
    west: lon - lonDelta,
    east: lon + lonDelta
  }

  return fetchOsmFromOverpass(bbox)
}

/**
 * Fetch OSM data using bbox directly
 */
export async function fetchOSMDataByBbox(bbox: BBox): Promise<OsmData> {
  return fetchOsmFromOverpass(bbox)
}

// Web Mercator projection
function latLonToMercator(lat: number, lon: number) {
  const x = lon * 20037508.34 / 180
  let y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180)
  y = y * 20037508.34 / 180
  return { x, y }
}

function calculateMercatorBounds(bbox: BBox, width: number, height: number, padding: number) {
  const sw = latLonToMercator(bbox.south, bbox.west)
  const ne = latLonToMercator(bbox.north, bbox.east)

  const mercatorWidth = ne.x - sw.x
  const mercatorHeight = ne.y - sw.y

  const drawWidth = width - padding * 2
  const drawHeight = height - padding * 2
  const canvasAspect = drawWidth / drawHeight
  const mercatorAspect = mercatorWidth / mercatorHeight

  let minX, maxX, minY, maxY

  if (mercatorAspect > canvasAspect) {
    minX = sw.x
    maxX = ne.x
    const centerY = (sw.y + ne.y) / 2
    const halfHeight = (mercatorWidth / canvasAspect) / 2
    minY = centerY - halfHeight
    maxY = centerY + halfHeight
  } else {
    minY = sw.y
    maxY = ne.y
    const centerX = (sw.x + ne.x) / 2
    const halfWidth = (mercatorHeight * canvasAspect) / 2
    minX = centerX - halfWidth
    maxX = centerX + halfWidth
  }

  return { minX, maxX, minY, maxY }
}

type MercatorBounds = ReturnType<typeof calculateMercatorBounds>

function projectCoords(lat: number, lon: number, bounds: MercatorBounds, width: number, height: number, padding: number) {
  const point = latLonToMercator(lat, lon)
  const drawWidth = width - padding * 2
  const drawHeight = height - padding * 2

  const x = padding + ((point.x - bounds.minX) / (bounds.maxX - bounds.minX)) * drawWidth
  const y = padding + ((bounds.maxY - point.y) / (bounds.maxY - bounds.minY)) * drawHeight

  return { x, y }
}

function hexToRgba(hex: string, alpha = 1) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function getRoadStyle(type: string, theme: Theme, scale: number) {
  const baseWidths: Record<string, number> = {
    motorway: 4, motorway_link: 3,
    trunk: 3.5, trunk_link: 2.5,
    primary: 3, primary_link: 2.5,
    secondary: 2.5, secondary_link: 2,
    tertiary: 2, tertiary_link: 1.5,
    residential: 1.2, living_street: 1, unclassified: 1,
    // Minor roads (only shown when < 3km)
    service: 0.8, footway: 0.5, path: 0.4, track: 0.6, pedestrian: 0.6,
  }

  const colors: Record<string, string> = {
    motorway: theme.road_motorway, motorway_link: theme.road_motorway,
    trunk: theme.road_primary, trunk_link: theme.road_primary,
    primary: theme.road_primary, primary_link: theme.road_primary,
    secondary: theme.road_secondary, secondary_link: theme.road_secondary,
    tertiary: theme.road_tertiary, tertiary_link: theme.road_tertiary,
    residential: theme.road_residential, living_street: theme.road_residential, unclassified: theme.road_residential,
    // Minor roads use a lighter/default color
    service: theme.road_default, footway: theme.road_default, path: theme.road_default,
    track: theme.road_default, pedestrian: theme.road_default,
  }

  return {
    color: colors[type] || theme.road_default,
    width: (baseWidths[type] || 0.5) * scale
  }
}

function isLatinScript(text: string) {
  if (!text) return true
  let latinCount = 0
  let totalAlpha = 0

  for (const char of text) {
    if (/[a-zA-Z\u00C0-\u024F]/.test(char)) {
      totalAlpha++
      if (char.charCodeAt(0) < 0x250) latinCount++
    } else if (/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(char)) {
      totalAlpha++
    }
  }

  return totalAlpha === 0 || (latinCount / totalAlpha) > 0.8
}

export async function generatePoster(options: PosterOptions): Promise<Buffer> {
  const {
    lat, lon, dist, theme, width, height, cityName, countryName, reliefIntensity = 0,
    mode = 'custom', countyBoundary, countyBbox, markers = [], legendPosition = 'bottom-left'
  } = options

  const intensity = reliefIntensity / 100

  let osmData: OsmData

  if (mode === 'taiwan-county' && countyBbox && countyBoundary) {
    osmData = await fetchOSMDataByBbox(countyBbox)
    osmData = clipDataToCounty(osmData, countyBoundary)
    osmData.bbox = countyBbox
  } else {
    osmData = await fetchOSMData(lat, lon, dist)
  }

  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  // Background
  ctx.fillStyle = theme.bg
  ctx.fillRect(0, 0, width, height)

  const padding = Math.min(width, height) * 0.02
  const mercatorBounds = calculateMercatorBounds(osmData.bbox, width, height, padding)
  const lineScale = Math.min(width, height) / 1200

  // Draw water
  ctx.fillStyle = theme.water
  ctx.strokeStyle = theme.water
  ctx.lineWidth = 3 * lineScale
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (const water of osmData.ways.water) {
    if (water.coords.length < 2) continue
    ctx.beginPath()
    const first = projectCoords(water.coords[0].lat, water.coords[0].lon, mercatorBounds, width, height, padding)
    ctx.moveTo(first.x, first.y)
    for (let i = 1; i < water.coords.length; i++) {
      const pt = projectCoords(water.coords[i].lat, water.coords[i].lon, mercatorBounds, width, height, padding)
      ctx.lineTo(pt.x, pt.y)
    }
    if (water.isLine) {
      ctx.stroke()
    } else {
      ctx.closePath()
      ctx.fill()

      if (intensity > 0) {
        ctx.save()
        ctx.clip()
        ctx.shadowColor = `rgba(0, 0, 0, ${0.5 * intensity})`
        ctx.shadowBlur = 8 * lineScale * intensity
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 0
        ctx.strokeStyle = theme.bg
        ctx.lineWidth = 15 * lineScale
        ctx.stroke()
        ctx.restore()
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
      }
    }
  }

  // Draw parks
  ctx.fillStyle = theme.parks
  for (const park of osmData.ways.parks) {
    if (park.coords.length < 3) continue
    ctx.beginPath()
    const first = projectCoords(park.coords[0].lat, park.coords[0].lon, mercatorBounds, width, height, padding)
    ctx.moveTo(first.x, first.y)
    for (let i = 1; i < park.coords.length; i++) {
      const pt = projectCoords(park.coords[i].lat, park.coords[i].lon, mercatorBounds, width, height, padding)
      ctx.lineTo(pt.x, pt.y)
    }
    ctx.closePath()

    if (intensity > 0) {
      ctx.shadowColor = `rgba(0, 0, 0, ${0.2 * intensity})`
      ctx.shadowBlur = 3 * lineScale * intensity
      ctx.shadowOffsetX = 1.5 * lineScale * intensity
      ctx.shadowOffsetY = 1.5 * lineScale * intensity
    }
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
  }

  // Sort and draw roads (minor roads first so they're drawn below major roads)
  const roadOrder = [
    // Minor roads (only appear when < 3km)
    'footway', 'path', 'track', 'pedestrian', 'service',
    // Major roads
    'residential', 'living_street', 'unclassified', 'tertiary', 'tertiary_link',
    'secondary', 'secondary_link', 'primary', 'primary_link', 'trunk', 'trunk_link',
    'motorway', 'motorway_link'
  ]
  osmData.ways.roads.sort((a, b) => roadOrder.indexOf(a.type || '') - roadOrder.indexOf(b.type || ''))

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const roadShadowOpacity = 0.35 * intensity
  const roadShadowBlur = 5 * lineScale * intensity
  const roadShadowOffset = 2.5 * lineScale * intensity

  for (const road of osmData.ways.roads) {
    const style = getRoadStyle(road.type || '', theme, lineScale)
    ctx.strokeStyle = style.color
    ctx.lineWidth = style.width

    if (intensity > 0) {
      ctx.shadowColor = `rgba(0, 0, 0, ${roadShadowOpacity})`
      ctx.shadowBlur = roadShadowBlur
      ctx.shadowOffsetX = roadShadowOffset
      ctx.shadowOffsetY = roadShadowOffset
    }

    ctx.beginPath()
    const first = projectCoords(road.coords[0].lat, road.coords[0].lon, mercatorBounds, width, height, padding)
    ctx.moveTo(first.x, first.y)
    for (let i = 1; i < road.coords.length; i++) {
      const pt = projectCoords(road.coords[i].lat, road.coords[i].lon, mercatorBounds, width, height, padding)
      ctx.lineTo(pt.x, pt.y)
    }
    ctx.stroke()
  }

  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0

  // Draw markers
  if (markers.length > 0) {
    const markerRadius = 14 * lineScale
    const markerFontSize = Math.round(14 * lineScale)
    const fontFamily = '"Heiti TC", "Noto Sans CJK TC", "Helvetica Neue", Arial, sans-serif'

    for (let i = 0; i < markers.length; i++) {
      const m = markers[i]
      const pt = projectCoords(m.lat, m.lon, mercatorBounds, width, height, padding)

      // Shadow
      ctx.beginPath()
      ctx.arc(pt.x, pt.y, markerRadius + 2 * lineScale, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
      ctx.fill()

      // Filled circle
      ctx.beginPath()
      ctx.arc(pt.x, pt.y, markerRadius, 0, Math.PI * 2)
      ctx.fillStyle = theme.text
      ctx.fill()

      // Number
      ctx.fillStyle = theme.bg
      ctx.font = `bold ${markerFontSize}px ${fontFamily}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(i + 1), pt.x, pt.y)
    }
  }

  // Draw gradients
  const gradientHeight = height * 0.22

  const bottomGradient = ctx.createLinearGradient(0, height, 0, height - gradientHeight)
  bottomGradient.addColorStop(0, hexToRgba(theme.gradient_color, 1))
  bottomGradient.addColorStop(1, hexToRgba(theme.gradient_color, 0))
  ctx.fillStyle = bottomGradient
  ctx.fillRect(0, height - gradientHeight, width, gradientHeight)

  const topGradient = ctx.createLinearGradient(0, 0, 0, gradientHeight)
  topGradient.addColorStop(0, hexToRgba(theme.gradient_color, 1))
  topGradient.addColorStop(1, hexToRgba(theme.gradient_color, 0))
  ctx.fillStyle = topGradient
  ctx.fillRect(0, 0, width, gradientHeight)

  // Draw legend
  if (markers.length > 0) {
    const legendScale = Math.min(width, height) / 1200
    const legendFontSize = Math.round(13 * legendScale)
    const legendDotRadius = 8 * legendScale
    const legendLineHeight = Math.round(24 * legendScale)
    const legendPadding = Math.round(14 * legendScale)
    const legendFontFamily = '"Heiti TC", "Noto Sans CJK TC", "Helvetica Neue", Arial, sans-serif'

    // Measure legend size
    ctx.font = `${legendFontSize}px ${legendFontFamily}`
    let maxTextWidth = 0
    for (let i = 0; i < markers.length; i++) {
      const text = `${i + 1}. ${markers[i].label}`
      const w = ctx.measureText(text).width
      if (w > maxTextWidth) maxTextWidth = w
    }

    const legendWidth = maxTextWidth + legendPadding * 2 + legendDotRadius * 2 + 8 * legendScale
    const legendHeight = markers.length * legendLineHeight + legendPadding * 2
    const margin = 24 * legendScale

    let lx: number, ly: number
    if (legendPosition === 'top-left') {
      lx = margin
      ly = margin
    } else if (legendPosition === 'top-right') {
      lx = width - legendWidth - margin
      ly = margin
    } else if (legendPosition === 'bottom-right') {
      lx = width - legendWidth - margin
      ly = height - legendHeight - margin
    } else {
      // bottom-left
      lx = margin
      ly = height - legendHeight - margin
    }

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
    const cr = 8 * legendScale
    ctx.beginPath()
    ctx.moveTo(lx + cr, ly)
    ctx.lineTo(lx + legendWidth - cr, ly)
    ctx.quadraticCurveTo(lx + legendWidth, ly, lx + legendWidth, ly + cr)
    ctx.lineTo(lx + legendWidth, ly + legendHeight - cr)
    ctx.quadraticCurveTo(lx + legendWidth, ly + legendHeight, lx + legendWidth - cr, ly + legendHeight)
    ctx.lineTo(lx + cr, ly + legendHeight)
    ctx.quadraticCurveTo(lx, ly + legendHeight, lx, ly + legendHeight - cr)
    ctx.lineTo(lx, ly + cr)
    ctx.quadraticCurveTo(lx, ly, lx + cr, ly)
    ctx.closePath()
    ctx.fill()

    // Legend items
    for (let i = 0; i < markers.length; i++) {
      const itemY = ly + legendPadding + i * legendLineHeight + legendLineHeight / 2
      const dotX = lx + legendPadding + legendDotRadius

      // Small circle
      ctx.beginPath()
      ctx.arc(dotX, itemY, legendDotRadius, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()

      // Number in circle
      ctx.fillStyle = '#000000'
      ctx.font = `bold ${Math.round(10 * legendScale)}px ${legendFontFamily}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(i + 1), dotX, itemY)

      // Label text
      ctx.fillStyle = '#ffffff'
      ctx.font = `${legendFontSize}px ${legendFontFamily}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(markers[i].label, dotX + legendDotRadius + 8 * legendScale, itemY)
    }
  }

  // Typography
  const scale = Math.min(width, height) / 1200

  let cityText = cityName
  if (isLatinScript(cityName)) {
    cityText = cityName.toUpperCase().split('').join('  ')
  }

  let cityFontSize = 60 * scale
  if (cityName.length > 10) {
    cityFontSize = cityFontSize * (10 / cityName.length)
  }
  cityFontSize = Math.max(cityFontSize, 20 * scale)

  ctx.fillStyle = theme.text
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const fontFamily = '"Heiti TC", "Noto Sans CJK TC", "Helvetica Neue", Arial, sans-serif'

  ctx.font = `bold ${cityFontSize}px ${fontFamily}`
  ctx.fillText(cityText, width / 2, height * 0.86)

  ctx.font = `${22 * scale}px ${fontFamily}`
  ctx.fillText(countryName.toUpperCase(), width / 2, height * 0.90)

  const displayLat = mode === 'taiwan-county' && countyBbox
    ? (countyBbox.south + countyBbox.north) / 2
    : lat
  const displayLon = mode === 'taiwan-county' && countyBbox
    ? (countyBbox.west + countyBbox.east) / 2
    : lon

  const latStr = displayLat >= 0 ? `${displayLat.toFixed(4)}° N` : `${Math.abs(displayLat).toFixed(4)}° S`
  const lonStr = displayLon >= 0 ? `${displayLon.toFixed(4)}° E` : `${Math.abs(displayLon).toFixed(4)}° W`

  ctx.globalAlpha = 0.7
  ctx.font = `${14 * scale}px "Courier New", monospace`
  ctx.fillText(`${latStr} / ${lonStr}`, width / 2, height * 0.93)
  ctx.globalAlpha = 1

  ctx.strokeStyle = theme.text
  ctx.lineWidth = 1 * scale
  ctx.beginPath()
  ctx.moveTo(width * 0.4, height * 0.875)
  ctx.lineTo(width * 0.6, height * 0.875)
  ctx.stroke()

  ctx.globalAlpha = 0.5
  ctx.font = `${10 * scale}px "Helvetica Neue", Arial, sans-serif`
  ctx.textAlign = 'right'
  ctx.fillText('© OpenStreetMap contributors', width - 30, height - 30)
  ctx.globalAlpha = 1

  return canvas.toBuffer('image/png')
}
