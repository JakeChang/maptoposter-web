import type { Theme } from '../../types'

const defaultCustomTheme: Theme = {
  id: 'custom',
  name: 'Custom',
  bg: '#F5EDE4',
  text: '#8B4513',
  gradient_color: '#F5EDE4',
  water: '#A8C4C4',
  parks: '#E8E0D0',
  road_motorway: '#A0522D',
  road_primary: '#B8653A',
  road_secondary: '#C9846A',
  road_tertiary: '#D9A08A',
  road_residential: '#E5C4B0',
  road_default: '#D9A08A'
}

export function useTheme() {
  const themes = ref<Theme[]>([])
  const selectedThemeId = ref('terracotta')
  const customColors = ref(false)
  const customTheme = ref<Theme>({ ...defaultCustomTheme })

  const currentTheme = computed(() => {
    if (customColors.value) return customTheme.value
    return themes.value.find(t => t.id === selectedThemeId.value) || themes.value[0]
  })

  const loadThemes = async () => {
    try {
      themes.value = await $fetch<Theme[]>('/api/themes')
      if (themes.value.length > 0) {
        applyThemeColors()
      }
    } catch (error) {
      console.error('Failed to load themes:', error)
    }
  }

  const applyThemeColors = () => {
    const theme = themes.value.find(t => t.id === selectedThemeId.value)
    if (theme) {
      customTheme.value = { ...theme, id: 'custom', name: 'Custom' }
    }
  }

  return {
    // State
    themes,
    selectedThemeId,
    customColors,
    customTheme,
    // Computed
    currentTheme,
    // Methods
    loadThemes,
    applyThemeColors
  }
}
