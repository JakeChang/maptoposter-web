// Theme types
export interface Theme {
  id?: string
  name: string
  description?: string
  bg: string
  text: string
  gradient_color: string
  water: string
  parks: string
  road_motorway: string
  road_primary: string
  road_secondary: string
  road_tertiary: string
  road_residential: string
  road_default: string
}

// Geo types
export interface GeoResult {
  lat: number
  lon: number
  displayName: string
  name: string
}

export interface BBox {
  west: number
  south: number
  east: number
  north: number
}

// Taiwan County types
export interface CountyInfo {
  id: string
  name: string
  area: number
}

export interface CountyData {
  id: string
  name: string
  bbox: BBox
  geometry: {
    type: 'MultiPolygon'
    coordinates: number[][][][]
  }
}

// Taiwan Town types
export interface TownInfo {
  id: string
  name: string
  countyId: string
  countyName: string
  area: number
}

export interface TownData {
  id: string
  name: string
  countyId: string
  countyName: string
  bbox: BBox
  geometry: {
    type: 'MultiPolygon'
    coordinates: number[][][][]
  }
}

// Marker types
export interface Marker {
  lat: number
  lon: number
  label: string
}

export type LegendPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

// Poster types
export type PosterMode = 'custom' | 'taiwan-county' | 'taiwan-town'

export interface PosterOptions {
  lat: number
  lon: number
  dist: number
  theme: Theme
  width: number
  height: number
  cityName: string
  countryName: string
  reliefIntensity: number
  mode?: PosterMode
  countyId?: string
  countyBoundary?: number[][][][]
  countyBbox?: BBox
  markers?: Marker[]
  legendPosition?: LegendPosition
}

// OSM types
export interface Coord {
  lat: number
  lon: number
}

export interface Way {
  coords: Coord[]
  type?: string
  isLine?: boolean
}

export interface OsmData {
  ways: {
    roads: Way[]
    water: Way[]
    parks: Way[]
  }
  bbox: BBox
}
