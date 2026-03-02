import type { GeoResult } from '../../types'

export function useLocationSearch() {
  const searchQuery = ref('')
  const searchResults = ref<GeoResult[]>([])
  const isSearching = ref(false)
  const showResults = ref(false)

  const lat = ref(25.0339)
  const lon = ref(121.5645)
  const cityName = ref('台北')
  const countryName = ref('Taiwan')

  const searchLocation = async () => {
    if (!searchQuery.value.trim()) return

    isSearching.value = true
    try {
      const results = await $fetch<GeoResult[]>('/api/geocode', {
        params: { q: searchQuery.value }
      })
      searchResults.value = results
      showResults.value = true
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      isSearching.value = false
    }
  }

  const selectLocation = (result: GeoResult) => {
    lat.value = result.lat
    lon.value = result.lon
    cityName.value = result.name
    searchQuery.value = result.name
    showResults.value = false

    const parts = result.displayName.split(',')
    if (parts.length > 1) {
      countryName.value = parts[parts.length - 1].trim()
    }
  }

  const updateCenter = (newLat: number, newLon: number) => {
    lat.value = newLat
    lon.value = newLon
  }

  return {
    // State
    searchQuery,
    searchResults,
    isSearching,
    showResults,
    lat,
    lon,
    cityName,
    countryName,
    // Methods
    searchLocation,
    selectLocation,
    updateCenter
  }
}
