import type { Theme, PosterMode, Marker, LegendPosition } from '../../types'

interface GeneratePosterParams {
  mode: PosterMode
  lat: number
  lon: number
  radius: number
  theme: Theme
  width: number
  height: number
  cityName: string
  countryName: string
  reliefIntensity: number
  countyId?: string
  townId?: string
  markers?: Marker[]
  legendPosition?: LegendPosition
}

export function usePosterGeneration() {
  const isGenerating = ref(false)
  const previewUrl = ref('')
  const errorMessage = ref('')

  const generatePoster = async (params: GeneratePosterParams) => {
    isGenerating.value = true
    errorMessage.value = ''

    // Clean up previous preview
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value)
      previewUrl.value = ''
    }

    try {
      const body: Record<string, any> = {
        theme: params.theme,
        width: params.width,
        height: params.height,
        cityName: params.cityName,
        countryName: params.countryName,
        reliefIntensity: params.reliefIntensity,
        mode: params.mode
      }

      if (params.mode === 'taiwan-town') {
        body.townId = params.townId
      } else if (params.mode === 'taiwan-county') {
        body.countyId = params.countyId
      } else {
        body.lat = params.lat
        body.lon = params.lon
        body.dist = params.radius
      }

      if (params.markers && params.markers.length > 0) {
        body.markers = params.markers
        body.legendPosition = params.legendPosition || 'bottom-left'
      }

      const response = await $fetch('/api/generate', {
        method: 'POST',
        body,
        responseType: 'blob'
      })

      previewUrl.value = URL.createObjectURL(response as Blob)
      return true
    } catch (error: any) {
      errorMessage.value = error.message || 'Failed to generate poster'
      return false
    } finally {
      isGenerating.value = false
    }
  }

  const downloadPoster = (fileName: string) => {
    if (!previewUrl.value) return

    const a = document.createElement('a')
    a.href = previewUrl.value
    a.download = `${fileName.replace(/[<>:"/\\|?*]/g, '_')}_poster.png`
    a.click()
  }

  const cleanup = () => {
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value)
      previewUrl.value = ''
    }
  }

  return {
    // State
    isGenerating,
    previewUrl,
    errorMessage,
    // Methods
    generatePoster,
    downloadPoster,
    cleanup
  }
}
