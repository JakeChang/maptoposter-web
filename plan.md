# Electron Mac App 包裝計畫

## 核心策略

將 Nuxt 生產建置（Nitro server）嵌入 Electron 中運行。Electron 主進程啟動內建的 Nitro server，渲染進程載入前端頁面。**現有的 app/ 和 server/ 程式碼幾乎不需修改。**

## 架構示意

```
Electron App (.app)
├── Main Process (electron/main.ts)
│   ├── 啟動 Nitro server (從 .output/server/index.mjs)
│   ├── 建立 BrowserWindow
│   └── 載入 http://localhost:3000
├── Renderer Process (BrowserWindow)
│   └── Nuxt 前端（與現有完全相同）
└── Resources
    └── .output/ (Nuxt build 產物)
```

## 實作步驟

### Step 1: 安裝 Electron 相關依賴

```bash
npm install --save-dev electron electron-builder
```

- `electron` - Electron runtime
- `electron-builder` - 打包工具，支援 `.dmg` / `.app` 輸出

### Step 2: 建立 Electron 主進程檔案 `electron/main.ts`

建立 `electron/main.ts`，負責：

1. **啟動 Nitro server** - 使用 `child_process.fork()` 啟動 `.output/server/index.mjs`
   - 設定 `PORT` 環境變數（使用動態可用 port 避免衝突）
   - 設定 `HOST=127.0.0.1`（僅本機存取）
2. **建立 BrowserWindow** - 載入 `http://localhost:{port}`
   - 設定合理的視窗大小（1280x800）
   - 設定 `nodeIntegration: false`（安全性）
3. **生命週期管理**
   - `app.on('window-all-closed')` - 關閉 app 時結束 Nitro 進程
   - `app.on('before-quit')` - 確保 server 進程正確清理
   - 處理 macOS 的 `activate` 事件（點擊 dock icon 重新開啟視窗）

### Step 3: 建立 Electron preload 腳本 `electron/preload.ts`

簡單的 preload 腳本，用於安全地暴露必要的 API（如果需要）。初始版本可以是空的。

### Step 4: 更新 `package.json`

新增以下設定：

```jsonc
{
  "main": "electron/main.mjs",  // Electron 入口
  "scripts": {
    // 保留原有 scripts...
    "electron:dev": "nuxt build && electron .",
    "electron:build": "nuxt build && electron-builder --mac"
  },
  "build": {
    "appId": "com.maptoposter.app",
    "productName": "Map Poster",
    "mac": {
      "category": "public.app-category.graphics-design",
      "target": ["dmg"],
      "icon": "build/icon.icns"
    },
    "files": [
      "electron/**/*",
      ".output/**/*"
    ],
    "extraMetadata": {
      "main": "electron/main.mjs"
    }
  }
}
```

### Step 5: 處理 `@napi-rs/canvas` native module

這是最關鍵的部分。`@napi-rs/canvas` 是 Node.js native addon，需要：

1. **在 electron-builder 中設定 `asarUnpack`**
   - 將 `node_modules/@napi-rs/canvas` 排除在 asar 壓縮之外
   - native `.node` 檔案無法從 asar 中載入

```jsonc
{
  "build": {
    "asarUnpack": [
      "node_modules/@napi-rs/canvas/**/*"
    ]
  }
}
```

2. **不需要 electron-rebuild**
   - `@napi-rs/canvas` 使用 NAPI，與 Node.js ABI 相容
   - Electron 的 Node.js 版本通常可以直接載入 NAPI 模組
   - 但需確認 Electron 的 Node.js 版本與 `@napi-rs/canvas` 相容

### Step 6: 建立 App Icon

建立 `build/` 目錄放置 macOS App icon：
- `build/icon.icns` - macOS icon 格式
- 可使用現有的 `public/favicon.ico` 轉換，或先使用預設圖示

### Step 7: 調整 Nuxt 建置設定

在 `nuxt.config.ts` 中確認：
- Nitro preset 使用 `node-server`（預設值，不需改動）
- 確保 server 資料檔（GeoJSON）正確包含在建置產物中

### Step 8: 測試流程

1. `npm run build` - 建置 Nuxt
2. `npx electron .` - 本機測試 Electron 啟動
3. `npm run electron:build` - 打包為 `.app` / `.dmg`

## 需要新建的檔案

| 檔案 | 說明 |
|------|------|
| `electron/main.ts` | Electron 主進程 |
| `electron/preload.ts` | Preload 腳本（初始可為空） |
| `build/icon.icns` | macOS App icon（可先略過，使用預設） |

## 需要修改的檔案

| 檔案 | 改動 |
|------|------|
| `package.json` | 新增 `main` 欄位、electron scripts、build 設定、dev dependencies |
| `.gitignore` | 新增 `dist/`（electron-builder 輸出目錄） |

## 不需要修改的檔案

- `app/` 目錄下所有前端程式碼 - 完全不動
- `server/` 目錄下所有後端程式碼 - 完全不動
- `nuxt.config.ts` - 基本上不需要改動
- `types/` - 不需改動

## 風險與注意事項

1. **App 體積** - 包含 Chromium，預計 ~150-200MB
2. **網路依賴** - Overpass API 和 Nominatim API 仍需網路連線，這是原始設計的限制
3. **macOS 簽章** - 正式發佈需要 Apple Developer ID 簽章，開發測試階段可略過
4. **`@napi-rs/canvas` 平台** - 需確保 `@napi-rs/canvas` 包含正確的 macOS binary（arm64/x64）
5. **Port 衝突** - 使用動態 port 避免本機 3000 port 已被佔用
