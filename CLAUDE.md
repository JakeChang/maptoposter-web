# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

maptoposter-web 是 [maptoposter](https://github.com/originalankur/maptoposter) 的 Web UI 版本，使用 Nuxt 4 建構的地圖海報生成器。支援全球任意地點以及台灣縣市/鄉鎮邊界地圖。

## Commands

```bash
npm install      # 安裝依賴
npm run dev      # 開發模式 (http://localhost:3000)
npm run build    # 生產建置
npm run preview  # 預覽生產版本
```

## Architecture

### Frontend (app/)
- **Nuxt 4** + **Vue 3** + **TailwindCSS 4** + **DaisyUI**
- `pages/index.vue` - 主頁面，整合所有 composables
- `components/MapPreview.client.vue` - Leaflet 地圖預覽（client-only）
- `composables/` - 業務邏輯分離：
  - `useLocationSearch.ts` - 地點搜尋（Nominatim API）
  - `useTaiwanRegion.ts` - 台灣縣市/鄉鎮選擇
  - `usePosterGeneration.ts` - 海報生成 API 呼叫
  - `useTheme.ts` - 主題管理

### Backend (server/)
- `api/generate.post.ts` - 海報生成 API 端點，支援三種模式：
  - `custom` - 自訂經緯度 + 半徑
  - `taiwan-county` - 台灣縣市邊界
  - `taiwan-town` - 台灣鄉鎮邊界
- `utils/poster.ts` - 核心繪圖邏輯：
  - 使用 `@napi-rs/canvas` 伺服器端繪製
  - 從 Overpass API 取得 OSM 地圖資料（道路、水域、公園）
  - Web Mercator 投影轉換
  - `robust-point-in-polygon` 邊界裁切
- `utils/taiwan-geo.ts` - 台灣行政區 GeoJSON 資料處理
- `data/` - 台灣縣市/鄉鎮 GeoJSON 邊界資料

### Data Flow
1. 前端選擇地點/區域 → 呼叫 `POST /api/generate`
2. 後端從 Overpass API 取得 OSM 資料
3. 若為台灣區域模式，使用 GeoJSON 邊界裁切資料
4. `@napi-rs/canvas` 繪製海報 → 回傳 PNG

### Types (types/)
- `index.ts` - 共用型別定義（Theme, PosterOptions, OsmData 等）

## Key Dependencies
- `@napi-rs/canvas` - Node.js Canvas 實作（伺服器端圖片繪製）
- `leaflet` - 前端地圖預覽
- `robust-point-in-polygon` - 點在多邊形內判斷（邊界裁切）

## Themes
主題配色檔案位於 `public/themes/*.json`，定義背景、文字、道路、水域、公園等顏色。
