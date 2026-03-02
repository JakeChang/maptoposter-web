<script setup lang="ts">
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// Fix Leaflet default icon paths (broken in bundled apps)
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
})

import type { Marker } from '../../types'

const props = defineProps<{
  lat: number
  lon: number
  radius: number
  mode?: 'custom' | 'taiwan-county' | 'taiwan-town'
  countyBoundary?: number[][][][]
  countyBbox?: { west: number; south: number; east: number; north: number }
  showLabels?: boolean
  markers?: Marker[]
}>()

const emit = defineEmits<{
  (e: 'update:center', lat: number, lon: number): void
  (e: 'update:marker', index: number, lat: number, lon: number): void
}>()

const mapContainer = ref<HTMLDivElement>()
let map: L.Map | null = null
let circle: L.Circle | null = null
let marker: L.Marker | null = null
let countyPolygon: L.GeoJSON | null = null
let tileLayer: L.TileLayer | null = null
let markerLayers: L.Marker[] = []

// Tile layer URLs
const TILE_WITH_LABELS = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_NO_LABELS = 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png'

// Calculate zoom level based on radius
const getZoomForRadius = (radius: number, lat: number): number => {
  const earthCircumference = 40075016.686
  const metersPerPixelAtZoom0 = earthCircumference * Math.cos(lat * Math.PI / 180) / 256
  const desiredPixels = 140
  const metersPerPixel = radius / desiredPixels
  const zoom = Math.log2(metersPerPixelAtZoom0 / metersPerPixel)
  return Math.min(Math.max(zoom, 1), 18)
}

// Convert GeoJSON MultiPolygon to Leaflet format (swap lon/lat to lat/lon)
const convertToLeafletCoords = (multiPolygon: number[][][][]): L.LatLngExpression[][][] => {
  return multiPolygon.map(polygon =>
    polygon.map(ring =>
      ring.map(coord => [coord[1], coord[0]] as L.LatLngExpression)
    )
  )
}

const initMap = () => {
  if (!mapContainer.value || map) return

  const initialZoom = getZoomForRadius(props.radius, props.lat)
  map = L.map(mapContainer.value, {
    center: [props.lat, props.lon],
    zoom: initialZoom
  })

  const tileUrl = props.showLabels !== false ? TILE_WITH_LABELS : TILE_NO_LABELS
  const attribution = props.showLabels !== false
    ? '© OpenStreetMap contributors'
    : '© OpenStreetMap contributors © CARTO'

  tileLayer = L.tileLayer(tileUrl, { attribution }).addTo(map)

  // Add circle for radius (only in custom mode)
  if (props.mode !== 'taiwan-county' && props.mode !== 'taiwan-town') {
    circle = L.circle([props.lat, props.lon], {
      radius: props.radius,
      color: '#3b82f6',
      fillColor: '#3b82f6',
      fillOpacity: 0.1,
      weight: 2
    }).addTo(map)

    // Add draggable marker
    marker = L.marker([props.lat, props.lon], {
      draggable: true
    }).addTo(map)

    marker.on('dragend', () => {
      const pos = marker!.getLatLng()
      emit('update:center', pos.lat, pos.lng)
    })

    // Click on map to move marker
    map.on('click', (e) => {
      if (props.mode !== 'taiwan-county' && props.mode !== 'taiwan-town') {
        marker!.setLatLng(e.latlng)
        emit('update:center', e.latlng.lat, e.latlng.lng)
      }
    })
  }

  // Add county/town polygon if in taiwan-county or taiwan-town mode
  if ((props.mode === 'taiwan-county' || props.mode === 'taiwan-town') && props.countyBoundary) {
    updateCountyPolygon()
  }
}

const updateCountyPolygon = () => {
  if (!map) return

  // Remove existing polygon
  if (countyPolygon) {
    map.removeLayer(countyPolygon)
    countyPolygon = null
  }

  if (props.countyBoundary && props.countyBoundary.length > 0) {
    // Create GeoJSON for the county boundary
    const geojson: GeoJSON.Feature = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'MultiPolygon',
        coordinates: props.countyBoundary
      }
    }

    countyPolygon = L.geoJSON(geojson, {
      style: {
        color: '#8b5cf6',
        weight: 3,
        fillColor: '#8b5cf6',
        fillOpacity: 0.15
      }
    }).addTo(map)

    // Fit map to county bounds
    if (props.countyBbox) {
      const bounds = L.latLngBounds(
        [props.countyBbox.south, props.countyBbox.west],
        [props.countyBbox.north, props.countyBbox.east]
      )
      map.fitBounds(bounds, { padding: [20, 20] })
    }
  }
}

// Watch for mode changes
watch(() => props.mode, (newMode) => {
  if (!map) return

  if (newMode === 'taiwan-county' || newMode === 'taiwan-town') {
    // Remove circle and marker
    if (circle) {
      map.removeLayer(circle)
      circle = null
    }
    if (marker) {
      map.removeLayer(marker)
      marker = null
    }
    // Add county/town polygon if available
    if (props.countyBoundary) {
      updateCountyPolygon()
    }
  } else {
    // Remove county polygon
    if (countyPolygon) {
      map.removeLayer(countyPolygon)
      countyPolygon = null
    }
    // Add circle and marker
    if (!circle) {
      circle = L.circle([props.lat, props.lon], {
        radius: props.radius,
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.1,
        weight: 2
      }).addTo(map)
    }
    if (!marker) {
      marker = L.marker([props.lat, props.lon], {
        draggable: true
      }).addTo(map)

      marker.on('dragend', () => {
        const pos = marker!.getLatLng()
        emit('update:center', pos.lat, pos.lng)
      })
    }
    // Reset view
    const zoom = getZoomForRadius(props.radius, props.lat)
    map.setView([props.lat, props.lon], zoom)
  }
})

// Watch for county/town boundary changes
watch(() => props.countyBoundary, () => {
  if (props.mode === 'taiwan-county' || props.mode === 'taiwan-town') {
    updateCountyPolygon()
  }
}, { deep: true })

// Watch for center changes (lat/lon) - only in custom mode
watch(() => [props.lat, props.lon], () => {
  if (!map || props.mode === 'taiwan-county' || props.mode === 'taiwan-town') return

  const center: L.LatLngExpression = [props.lat, props.lon]
  if (marker) marker.setLatLng(center)
  if (circle) circle.setLatLng(center)
  map.setView(center, map.getZoom(), { animate: true })
})

// Watch for radius changes separately - only in custom mode
watch(() => props.radius, () => {
  if (!map || props.mode === 'taiwan-county' || props.mode === 'taiwan-town') return

  if (circle) circle.setRadius(props.radius)

  const newZoom = getZoomForRadius(props.radius, props.lat)
  map.setZoom(newZoom, { animate: false })
})

// Update marker layers on map
const updateMarkerLayers = () => {
  if (!map) return

  // Remove existing marker layers
  for (const m of markerLayers) {
    map.removeLayer(m)
  }
  markerLayers = []

  if (!props.markers || props.markers.length === 0) return

  for (let i = 0; i < props.markers.length; i++) {
    const m = props.markers[i]
    if (m.lat === 0 && m.lon === 0) continue

    const icon = L.divIcon({
      className: 'custom-marker',
      html: `<div style="width:24px;height:24px;border-radius:50%;background:#8b5cf6;color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid #fff;">${i + 1}</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    })

    const leafletMarker = L.marker([m.lat, m.lon], { icon, draggable: true }).addTo(map)
    if (m.label) {
      leafletMarker.bindTooltip(m.label, { direction: 'top', offset: [0, -14] })
    }
    const idx = i
    leafletMarker.on('dragend', () => {
      const pos = leafletMarker.getLatLng()
      emit('update:marker', idx, pos.lat, pos.lng)
    })
    markerLayers.push(leafletMarker)
  }
}

// Watch markers prop
watch(() => props.markers, updateMarkerLayers, { deep: true })

// Watch for showLabels changes - switch tile layer
watch(() => props.showLabels, (showLabels) => {
  if (!map || !tileLayer) return

  map.removeLayer(tileLayer)

  const tileUrl = showLabels !== false ? TILE_WITH_LABELS : TILE_NO_LABELS
  const attribution = showLabels !== false
    ? '© OpenStreetMap contributors'
    : '© OpenStreetMap contributors © CARTO'

  tileLayer = L.tileLayer(tileUrl, { attribution }).addTo(map)
})

onMounted(() => {
  nextTick(() => {
    initMap()
  })
})

onUnmounted(() => {
  if (map) {
    map.remove()
    map = null
  }
})
</script>

<template>
  <div ref="mapContainer" class="w-full h-full"></div>
</template>

<style>
.leaflet-container {
  font-family: inherit;
}
</style>
