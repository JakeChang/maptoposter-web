import type { Marker, LegendPosition } from '../../types'

export function useMarkers() {
  const markers = ref<Marker[]>([])
  const legendPosition = ref<LegendPosition>('bottom-left')

  const addMarker = (lat: number = 0, lon: number = 0, label: string = '') => {
    markers.value.push({ lat, lon, label })
  }

  const removeMarker = (index: number) => {
    markers.value.splice(index, 1)
  }

  const updateMarker = (index: number, updates: Partial<Marker>) => {
    if (index >= 0 && index < markers.value.length) {
      markers.value[index] = { ...markers.value[index], ...updates }
    }
  }

  return {
    markers,
    legendPosition,
    addMarker,
    removeMarker,
    updateMarker
  }
}
