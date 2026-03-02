import type { CountyInfo, CountyData, TownInfo, TownData, PosterMode } from '../../types'

export function useTaiwanRegion() {
  const mode = ref<PosterMode>('custom')

  // County state
  const counties = ref<CountyInfo[]>([])
  const selectedCountyId = ref('')
  const selectedCountyData = ref<CountyData | null>(null)
  const isLoadingCounty = ref(false)

  // Town state
  const towns = ref<TownInfo[]>([])
  const selectedTownId = ref('')
  const selectedTownData = ref<TownData | null>(null)
  const isLoadingTown = ref(false)

  const loadCounties = async () => {
    try {
      counties.value = await $fetch<CountyInfo[]>('/api/taiwan-counties')
    } catch (error) {
      console.error('Failed to load counties:', error)
    }
  }

  const selectCounty = async (countyId: string) => {
    if (!countyId) {
      selectedCountyData.value = null
      return
    }

    isLoadingCounty.value = true
    try {
      const data = await $fetch<CountyData>(`/api/taiwan-county/${countyId}`)
      selectedCountyData.value = data
      return data
    } catch (error) {
      console.error('Failed to load county data:', error)
      return null
    } finally {
      isLoadingCounty.value = false
    }
  }

  const loadTowns = async (countyId: string) => {
    if (!countyId) {
      towns.value = []
      return
    }

    try {
      towns.value = await $fetch<TownInfo[]>(`/api/taiwan-towns/${countyId}`)
    } catch (error) {
      console.error('Failed to load towns:', error)
    }
  }

  const selectTown = async (townId: string) => {
    if (!townId) {
      selectedTownData.value = null
      return
    }

    isLoadingTown.value = true
    try {
      const data = await $fetch<TownData>(`/api/taiwan-town/${townId}`)
      selectedTownData.value = data
      return data
    } catch (error) {
      console.error('Failed to load town data:', error)
      return null
    } finally {
      isLoadingTown.value = false
    }
  }

  const resetTownSelection = () => {
    selectedTownId.value = ''
    selectedTownData.value = null
    towns.value = []
  }

  const resetCountySelection = () => {
    selectedCountyId.value = ''
    selectedCountyData.value = null
    resetTownSelection()
  }

  // Computed
  const currentBoundary = computed(() => {
    if (mode.value === 'taiwan-town' && selectedTownData.value) {
      return selectedTownData.value.geometry.coordinates
    }
    if (mode.value === 'taiwan-county' && selectedCountyData.value) {
      return selectedCountyData.value.geometry.coordinates
    }
    return undefined
  })

  const currentBbox = computed(() => {
    if (mode.value === 'taiwan-town' && selectedTownData.value) {
      return selectedTownData.value.bbox
    }
    if (mode.value === 'taiwan-county' && selectedCountyData.value) {
      return selectedCountyData.value.bbox
    }
    return undefined
  })

  const isRegionMode = computed(() =>
    mode.value === 'taiwan-county' || mode.value === 'taiwan-town'
  )

  return {
    // State
    mode,
    counties,
    selectedCountyId,
    selectedCountyData,
    isLoadingCounty,
    towns,
    selectedTownId,
    selectedTownData,
    isLoadingTown,
    // Computed
    currentBoundary,
    currentBbox,
    isRegionMode,
    // Methods
    loadCounties,
    selectCounty,
    loadTowns,
    selectTown,
    resetTownSelection,
    resetCountySelection
  }
}
