<script setup lang="ts">
import type { Theme } from '../../types'

// Composables
const location = useLocationSearch()
const region = useTaiwanRegion()
const themeState = useTheme()
const poster = usePosterGeneration()
const markerState = useMarkers()

// Poster options
const width = ref(2400)
const height = ref(3200)
const radius = ref(5000)
const reliefIntensity = ref(50)

// Map options
const showMapLabels = ref(true)

// Modal state
const showImageModal = ref(false)

// Computed
const displayName = computed(() => {
  if (region.mode.value === 'taiwan-town' && region.selectedTownData.value) {
    return location.cityName.value || region.selectedTownData.value.name
  }
  if (region.mode.value === 'taiwan-county' && region.selectedCountyData.value) {
    return location.cityName.value || region.selectedCountyData.value.name
  }
  return location.cityName.value
})

const canGenerate = computed(() => {
  if (poster.isGenerating.value) return false
  if (region.mode.value === 'taiwan-county' && !region.selectedCountyId.value) return false
  if (region.mode.value === 'taiwan-town' && !region.selectedTownId.value) return false
  return true
})

// Methods
const handleGeneratePoster = async () => {
  await poster.generatePoster({
    mode: region.mode.value,
    lat: location.lat.value,
    lon: location.lon.value,
    radius: radius.value,
    theme: themeState.currentTheme.value,
    width: width.value,
    height: height.value,
    cityName: displayName.value,
    countryName: location.countryName.value,
    reliefIntensity: reliefIntensity.value,
    countyId: region.selectedCountyId.value,
    townId: region.selectedTownId.value,
    markers: markerState.markers.value,
    legendPosition: markerState.legendPosition.value
  })
}

const handleDownload = () => {
  poster.downloadPoster(displayName.value)
}

// Watch county selection
watch(region.selectedCountyId, async (newId) => {
  if (newId) {
    const data = await region.selectCounty(newId)
    if (data) {
      location.cityName.value = data.name
      location.countryName.value = 'Taiwan'
    }
    if (region.mode.value === 'taiwan-town') {
      await region.loadTowns(newId)
      region.selectedTownId.value = ''
      region.selectedTownData.value = null
    }
  } else {
    region.resetCountySelection()
  }
})

// Watch town selection
watch(region.selectedTownId, async (newId) => {
  if (newId) {
    const data = await region.selectTown(newId)
    if (data) {
      location.cityName.value = data.countyName + data.name
      location.countryName.value = 'Taiwan'
    }
  } else {
    region.selectedTownData.value = null
  }
})

// Watch mode changes
watch(region.mode, async (newMode) => {
  if (region.isRegionMode.value) {
    if (region.counties.value.length === 0) {
      await region.loadCounties()
    }
    if (newMode === 'taiwan-town' && region.selectedCountyId.value) {
      await region.loadTowns(region.selectedCountyId.value)
    }
  }
})

// Keyboard handler
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && showImageModal.value) {
    showImageModal.value = false
  }
}

// Lifecycle
onMounted(async () => {
  document.addEventListener('keydown', handleKeydown)
  await themeState.loadThemes()
})

onUnmounted(() => {
  poster.cleanup()
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="h-screen bg-[#0f0f0f] text-white flex flex-col overflow-hidden">
    <!-- Decorative Background -->
    <div class="fixed inset-0 overflow-hidden pointer-events-none">
      <div class="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
      <div class="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
    </div>

    <!-- Header -->
    <header class="relative border-b border-white/10 shrink-0">
      <div class="px-6 py-4">
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <div>
            <h1 class="text-xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
              Map Poster
            </h1>
            <p class="text-xs text-white/40">打造精美極簡地圖海報</p>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content - Three Columns -->
    <main class="relative flex-1 flex overflow-hidden">
      <!-- Left Column - Search & Settings -->
      <div class="w-80 shrink-0 border-r border-white/10 overflow-y-auto overscroll-contain p-4 space-y-4">

        <!-- Mode Toggle -->
        <div class="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
            </div>
            <h2 class="font-semibold text-white text-sm">模式</h2>
          </div>

          <div class="grid grid-cols-3 gap-2">
            <button
              class="h-10 px-2 rounded-xl text-xs font-medium transition-all cursor-pointer"
              :class="region.mode.value === 'custom' ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'"
              @click="region.mode.value = 'custom'"
            >
              自訂
            </button>
            <button
              class="h-10 px-2 rounded-xl text-xs font-medium transition-all cursor-pointer"
              :class="region.mode.value === 'taiwan-county' ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'"
              @click="region.mode.value = 'taiwan-county'"
            >
              縣市
            </button>
            <button
              class="h-10 px-2 rounded-xl text-xs font-medium transition-all cursor-pointer"
              :class="region.mode.value === 'taiwan-town' ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'"
              @click="region.mode.value = 'taiwan-town'"
            >
              鄉鎮區
            </button>
          </div>
        </div>

        <!-- Custom Mode: Search Section -->
        <div v-if="region.mode.value === 'custom'" class="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4">
          <div class="flex items-center gap-2 mb-4">
            <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 class="font-semibold text-white text-sm">地點</h2>
          </div>

          <!-- Search Input -->
          <div class="relative mb-3">
            <input
              v-model="location.searchQuery.value"
              type="text"
              placeholder="搜尋城市或地址..."
              class="w-full h-10 pl-4 pr-10 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all"
              @keyup.enter="location.searchLocation"
              @focus="location.showResults.value = location.searchResults.value.length > 0"
            />
            <button
              class="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 flex items-center justify-center hover:opacity-90 transition-opacity cursor-pointer disabled:cursor-not-allowed"
              :disabled="location.isSearching.value"
              @click="location.searchLocation"
            >
              <span v-if="location.isSearching.value" class="loading loading-spinner loading-xs text-white"></span>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            <!-- Search Results -->
            <div
              v-if="location.showResults.value && location.searchResults.value.length > 0"
              class="absolute z-50 w-full mt-2 bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden shadow-2xl"
            >
              <button
                v-for="result in location.searchResults.value"
                :key="`${result.lat}-${result.lon}`"
                class="w-full px-4 py-3 text-left hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors cursor-pointer"
                @click="location.selectLocation(result)"
              >
                <div class="font-medium text-white text-sm">{{ result.name }}</div>
                <div class="text-xs text-white/40 truncate">{{ result.displayName }}</div>
              </button>
            </div>
          </div>

          <!-- City & Country Inputs -->
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-medium text-white/50 mb-1">顯示名稱</label>
              <input
                v-model="location.cityName.value"
                type="text"
                class="w-full h-9 px-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500/50 transition-colors"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-white/50 mb-1">國家</label>
              <input
                v-model="location.countryName.value"
                type="text"
                class="w-full h-9 px-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500/50 transition-colors"
              />
            </div>
          </div>

          <!-- Coordinates Display -->
          <div class="mt-3 px-3 py-2 bg-white/5 rounded-lg text-xs text-white/50 text-center">
            {{ location.lat.value.toFixed(4) }}, {{ location.lon.value.toFixed(4) }}
          </div>
        </div>

        <!-- Taiwan County/Town Mode: Selection -->
        <div v-if="region.isRegionMode.value" class="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4">
          <div class="flex items-center gap-2 mb-4">
            <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 class="font-semibold text-white text-sm">{{ region.mode.value === 'taiwan-town' ? '鄉鎮市區' : '縣市' }}</h2>
          </div>

          <!-- County Select -->
          <div class="relative mb-3">
            <label class="block text-xs font-medium text-white/50 mb-1">縣市</label>
            <select
              v-model="region.selectedCountyId.value"
              class="w-full h-10 px-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500/50 transition-colors appearance-none cursor-pointer"
              :disabled="region.isLoadingCounty.value"
            >
              <option value="" class="bg-[#1a1a1a] text-white">選擇縣市...</option>
              <option v-for="county in region.counties.value" :key="county.id" :value="county.id" class="bg-[#1a1a1a] text-white">
                {{ county.name }}
              </option>
            </select>
            <div v-if="region.isLoadingCounty.value" class="absolute right-3 top-1/2 -translate-y-1/2">
              <span class="loading loading-spinner loading-xs text-white"></span>
            </div>
          </div>

          <!-- Town Select (only in town mode) -->
          <div v-if="region.mode.value === 'taiwan-town' && region.selectedCountyId.value" class="relative mb-3">
            <label class="block text-xs font-medium text-white/50 mb-1">鄉鎮市區</label>
            <select
              v-model="region.selectedTownId.value"
              class="w-full h-10 px-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500/50 transition-colors appearance-none cursor-pointer"
              :disabled="region.isLoadingTown.value || region.towns.value.length === 0"
            >
              <option value="" class="bg-[#1a1a1a] text-white">選擇鄉鎮市區...</option>
              <option v-for="town in region.towns.value" :key="town.id" :value="town.id" class="bg-[#1a1a1a] text-white">
                {{ town.name }}
              </option>
            </select>
            <div v-if="region.isLoadingTown.value" class="absolute right-3 top-1/2 -translate-y-1/2">
              <span class="loading loading-spinner loading-xs text-white"></span>
            </div>
          </div>

          <!-- Selected Info -->
          <div v-if="region.mode.value === 'taiwan-town' && region.selectedTownData.value" class="p-3 bg-white/5 rounded-lg">
            <div class="text-sm font-medium text-white mb-1">{{ region.selectedTownData.value.name }}</div>
            <div class="text-xs text-white/50">
              {{ region.selectedTownData.value.countyName }} · {{ region.selectedTownData.value.bbox.west.toFixed(2) }}° - {{ region.selectedTownData.value.bbox.east.toFixed(2) }}° E
            </div>
          </div>
          <div v-else-if="region.mode.value === 'taiwan-county' && region.selectedCountyData.value" class="p-3 bg-white/5 rounded-lg">
            <div class="text-sm font-medium text-white mb-1">{{ region.selectedCountyData.value.name }}</div>
            <div class="text-xs text-white/50">
              {{ region.selectedCountyData.value.bbox.west.toFixed(2) }}° - {{ region.selectedCountyData.value.bbox.east.toFixed(2) }}° E
            </div>
          </div>

          <!-- City & Country Inputs -->
          <div class="space-y-3 mt-3">
            <div>
              <label class="block text-xs font-medium text-white/50 mb-1">顯示名稱</label>
              <input
                v-model="location.cityName.value"
                type="text"
                class="w-full h-9 px-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500/50 transition-colors"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-white/50 mb-1">國家</label>
              <input
                v-model="location.countryName.value"
                type="text"
                class="w-full h-9 px-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500/50 transition-colors"
              />
            </div>
          </div>
        </div>

        <!-- Radius Control (only for custom mode) -->
        <div v-if="region.mode.value === 'custom'" class="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4">
          <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-medium text-white/70">半徑</span>
            <div class="px-3 py-1 bg-gradient-to-r from-violet-500/20 to-purple-500/20 border border-purple-500/30 rounded-lg">
              <span class="text-sm font-bold text-white">{{ (radius / 1000).toFixed(1) }}</span>
              <span class="text-xs text-white/50 ml-1">km</span>
            </div>
          </div>
          <input
            v-model.number="radius"
            type="range"
            min="1000"
            max="30000"
            step="500"
            class="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-violet-500 [&::-webkit-slider-thumb]:to-purple-600 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer"
          />
          <div class="flex justify-between text-[10px] text-white/30 mt-1">
            <span>1km</span>
            <span>30km</span>
          </div>
        </div>

        <!-- 3D Relief Control -->
        <div class="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4">
          <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-medium text-white/70">3D 浮雕</span>
            <div class="px-3 py-1 bg-gradient-to-r from-violet-500/20 to-purple-500/20 border border-purple-500/30 rounded-lg">
              <span class="text-sm font-bold text-white">{{ reliefIntensity }}</span>
              <span class="text-xs text-white/50 ml-1">%</span>
            </div>
          </div>
          <input
            v-model.number="reliefIntensity"
            type="range"
            min="0"
            max="100"
            step="5"
            class="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-violet-500 [&::-webkit-slider-thumb]:to-purple-600 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer"
          />
          <div class="flex justify-between text-[10px] text-white/30 mt-1">
            <span>平面</span>
            <span>最強</span>
          </div>
        </div>

        <!-- Markers Section -->
        <div class="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-400 to-red-500 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h2 class="font-semibold text-white text-sm">標記地點</h2>
            </div>
            <button
              class="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
              @click="markerState.addMarker(location.lat.value, location.lon.value, '')"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          <!-- Marker List -->
          <div v-if="markerState.markers.value.length > 0" class="space-y-2 mb-3">
            <div v-for="(m, i) in markerState.markers.value" :key="i" class="flex items-center gap-2 p-2 bg-white/5 rounded-lg">
              <div class="w-6 h-6 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
                <span class="text-[10px] font-bold text-white">{{ i + 1 }}</span>
              </div>
              <input
                :value="m.label"
                type="text"
                placeholder="名稱"
                class="flex-1 min-w-0 h-7 px-2 bg-white/5 border border-white/10 rounded text-xs text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50"
                @input="markerState.updateMarker(i, { label: ($event.target as HTMLInputElement).value })"
              />
              <div class="text-[9px] text-white/30 shrink-0">
                {{ m.lat.toFixed(2) }}, {{ m.lon.toFixed(2) }}
              </div>
              <button
                class="w-6 h-6 rounded bg-white/5 hover:bg-red-500/20 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                @click="markerState.removeMarker(i)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-white/50 hover:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <p v-else class="text-xs text-white/30 mb-3">點擊 + 新增標記點（使用目前地圖中心座標）</p>

          <!-- Legend Position -->
          <div v-if="markerState.markers.value.length > 0">
            <label class="block text-xs font-medium text-white/50 mb-1">圖例位置</label>
            <select
              v-model="markerState.legendPosition.value"
              class="w-full h-9 px-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500/50 transition-colors appearance-none cursor-pointer"
            >
              <option value="top-left" class="bg-[#1a1a1a] text-white">左上</option>
              <option value="top-right" class="bg-[#1a1a1a] text-white">右上</option>
              <option value="bottom-left" class="bg-[#1a1a1a] text-white">左下</option>
              <option value="bottom-right" class="bg-[#1a1a1a] text-white">右下</option>
            </select>
          </div>
        </div>

        <!-- Theme Section -->
        <div class="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
            </div>
            <h2 class="font-semibold text-white text-sm">主題</h2>
          </div>

          <!-- Theme Preview Card -->
          <div
            v-if="themeState.currentTheme.value"
            class="relative p-3 rounded-xl mb-3 overflow-hidden"
            :style="{ backgroundColor: themeState.currentTheme.value.bg }"
          >
            <div class="flex flex-col gap-2">
              <div class="flex gap-1">
                <div class="h-2 w-10 rounded-full" :style="{ backgroundColor: themeState.currentTheme.value.road_motorway }"></div>
                <div class="h-2 w-8 rounded-full" :style="{ backgroundColor: themeState.currentTheme.value.road_primary }"></div>
                <div class="h-2 w-6 rounded-full" :style="{ backgroundColor: themeState.currentTheme.value.road_secondary }"></div>
              </div>
              <div class="flex items-end justify-between">
                <div class="flex gap-1">
                  <div class="h-5 w-5 rounded" :style="{ backgroundColor: themeState.currentTheme.value.water }"></div>
                  <div class="h-5 w-5 rounded" :style="{ backgroundColor: themeState.currentTheme.value.parks }"></div>
                </div>
                <div class="text-xs font-bold" :style="{ color: themeState.currentTheme.value.text }">{{ themeState.currentTheme.value.name }}</div>
              </div>
            </div>
          </div>

          <!-- Theme Select -->
          <select
            v-model="themeState.selectedThemeId.value"
            class="w-full h-10 px-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500/50 transition-colors appearance-none cursor-pointer"
            @change="themeState.applyThemeColors"
          >
            <option v-for="theme in themeState.themes.value" :key="theme.id" :value="theme.id" class="bg-[#1a1a1a] text-white">
              {{ theme.name }}
            </option>
          </select>

          <!-- Custom Colors Toggle -->
          <label class="flex items-center gap-2 mt-3 cursor-pointer">
            <div class="relative">
              <input v-model="themeState.customColors.value" type="checkbox" class="sr-only peer" />
              <div class="w-9 h-5 bg-white/10 rounded-full peer-checked:bg-gradient-to-r peer-checked:from-violet-500 peer-checked:to-purple-600 transition-all"></div>
              <div class="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform"></div>
            </div>
            <span class="text-xs text-white/70">自訂顏色</span>
          </label>

          <!-- Custom Colors Grid -->
          <div v-if="themeState.customColors.value" class="grid grid-cols-4 gap-2 mt-3 p-3 bg-white/5 rounded-xl">
            <div v-for="(label, key) in {
              bg: '背景',
              text: '文字',
              water: '水域',
              parks: '公園',
              road_motorway: '高速',
              road_primary: '主要',
              road_secondary: '次要',
              road_residential: '住宅'
            }" :key="key" class="flex flex-col items-center gap-1">
              <input
                v-model="themeState.customTheme.value[key as keyof Theme]"
                type="color"
                class="w-8 h-8 rounded-lg cursor-pointer border border-white/20 overflow-hidden"
              />
              <span class="text-[9px] text-white/40">{{ label }}</span>
            </div>
          </div>
        </div>

        <!-- Output Size -->
        <div class="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4">
          <h3 class="text-sm font-medium text-white/70 mb-3">輸出尺寸</h3>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-white/40 mb-1">寬度</label>
              <div class="relative">
                <input
                  v-model.number="width"
                  type="number"
                  min="800"
                  max="4800"
                  step="100"
                  class="w-full h-9 pl-3 pr-8 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500/50 transition-colors"
                />
                <span class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-white/30">px</span>
              </div>
            </div>
            <div>
              <label class="block text-xs text-white/40 mb-1">高度</label>
              <div class="relative">
                <input
                  v-model.number="height"
                  type="number"
                  min="800"
                  max="6400"
                  step="100"
                  class="w-full h-9 pl-3 pr-8 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500/50 transition-colors"
                />
                <span class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-white/30">px</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Generate Button -->
        <button
          class="w-full h-12 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 rounded-xl font-semibold text-white flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!canGenerate"
          @click="handleGeneratePoster"
        >
          <span v-if="poster.isGenerating.value" class="loading loading-spinner loading-sm"></span>
          <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {{ poster.isGenerating.value ? '產生中...' : '產生海報' }}
        </button>

        <!-- Error Message -->
        <div v-if="poster.errorMessage.value" class="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="text-xs text-red-400">{{ poster.errorMessage.value }}</span>
        </div>
      </div>

      <!-- Center Column - Map (Full Width) -->
      <div class="flex-1 relative">
        <ClientOnly>
          <MapPreview
            :lat="location.lat.value"
            :lon="location.lon.value"
            :radius="radius"
            :mode="region.mode.value"
            :county-boundary="region.currentBoundary.value"
            :county-bbox="region.currentBbox.value"
            :show-labels="showMapLabels"
            :markers="markerState.markers.value"
            @update:center="location.updateCenter"
            @update:marker="(i: number, lat: number, lon: number) => markerState.updateMarker(i, { lat, lon })"
            class="absolute inset-0"
          />
        </ClientOnly>

        <!-- Map Labels Toggle -->
        <div class="absolute top-4 right-4 z-[1000]">
          <label class="flex items-center gap-2 px-3 py-2 bg-white/90 dark:bg-[#1a1a1a]/90 backdrop-blur-sm rounded-lg shadow-lg border border-white/20 cursor-pointer">
            <div class="relative">
              <input v-model="showMapLabels" type="checkbox" class="sr-only peer" />
              <div class="w-9 h-5 bg-gray-300 dark:bg-white/20 rounded-full peer-checked:bg-gradient-to-r peer-checked:from-violet-500 peer-checked:to-purple-600 transition-all"></div>
              <div class="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform"></div>
            </div>
            <span class="text-xs font-medium text-gray-700 dark:text-white/70">地標名稱</span>
          </label>
        </div>
      </div>

      <!-- Right Column - Preview -->
      <div class="w-80 shrink-0 border-l border-white/10 overflow-y-auto overscroll-contain p-4 flex flex-col">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 class="font-semibold text-white text-sm">預覽</h2>
          </div>
          <button
            v-if="poster.previewUrl.value"
            class="h-8 px-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-lg font-medium text-white text-xs flex items-center gap-1.5 shadow-lg shadow-green-500/25 transition-all cursor-pointer"
            @click="handleDownload"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            下載
          </button>
        </div>

        <!-- Preview Content -->
        <div class="flex-1 flex flex-col">
          <!-- Loading State -->
          <div v-if="poster.isGenerating.value" class="flex-1 flex flex-col items-center justify-center">
            <div class="relative">
              <div class="w-16 h-16 rounded-full border-4 border-purple-500/20"></div>
              <div class="absolute inset-0 w-16 h-16 rounded-full border-4 border-transparent border-t-purple-500 animate-spin"></div>
            </div>
            <p class="mt-4 font-medium text-white text-sm">產生中...</p>
            <p class="mt-1 text-xs text-white/40">這可能需要一點時間</p>
          </div>

          <!-- Preview Image -->
          <div v-else-if="poster.previewUrl.value" class="flex-1 flex items-center justify-center p-2">
            <div
              class="relative group cursor-pointer"
              @click="showImageModal = true"
            >
              <img
                :src="poster.previewUrl.value"
                alt="Generated Poster"
                class="max-w-full max-h-full object-contain rounded-xl shadow-2xl transition-transform group-hover:scale-[1.02]"
              />
              <!-- Zoom hint overlay -->
              <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-xl transition-all flex items-center justify-center">
                <div class="opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 backdrop-blur-sm rounded-full p-3">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else class="flex-1 flex flex-col items-center justify-center text-center p-4">
            <div class="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p class="text-sm text-white/50">尚無預覽</p>
            <p class="text-xs text-white/30 mt-1">點擊「產生海報」開始建立</p>
          </div>
        </div>
      </div>
    </main>

    <!-- Image Zoom Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showImageModal && poster.previewUrl.value"
          class="fixed inset-0 z-[9999] flex items-center justify-center"
          @click.self="showImageModal = false"
        >
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>

          <!-- Modal Content -->
          <div class="relative z-10 max-w-[90vw] max-h-[90vh] flex flex-col items-center">
            <!-- Close Button -->
            <button
              class="absolute top-2 right-2 z-20 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm border border-white/20 flex items-center justify-center transition-colors cursor-pointer"
              @click="showImageModal = false"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <!-- Image -->
            <img
              :src="poster.previewUrl.value"
              alt="Generated Poster"
              class="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
            />
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style>
/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Color input styling */
input[type="color"] {
  -webkit-appearance: none;
  padding: 0;
}

input[type="color"]::-webkit-color-swatch-wrapper {
  padding: 0;
}

input[type="color"]::-webkit-color-swatch {
  border: none;
  border-radius: 8px;
}

/* Modal transitions */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-active > div:first-child,
.modal-leave-active > div:first-child {
  transition: opacity 0.3s ease;
}

.modal-enter-active > div:last-child,
.modal-leave-active > div:last-child {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from > div:last-child,
.modal-leave-to > div:last-child {
  opacity: 0;
  transform: scale(0.9);
}
</style>
