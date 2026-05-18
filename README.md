# Reality Hack

Reality Hack 是一款 AI 驅動的安全型現實入侵敘事遊戲。玩家接收「異常訊號」，完成 1 到 5 分鐘的現實世界微任務，AI 會根據玩家狀態、時間偏好與完成紀錄生成後續劇情。

## MVP 功能

- 玩家代號、所在地情境、當前狀態同步
- 可選全感測器沉浸模式：定位、通知、相機、照片庫、麥克風、動作感測
- 預設讀取不需權限的系統情境：時間、時區、語系、深色模式、裝置型號、電量、低耗電模式、網路類型
- AI 生成安全的 ARG 微任務
- 任務類型：觀察、行動、心理、時間觸發
- 劇情風格：Glitch、神秘、校園、冷靜
- 安全等級：低刺激、輕不安
- 本機玩家模型：活躍時間、完成率、偏好任務類型
- 任務檔案本機保存
- 免費 5 次訊號 + Pro gating
- Supabase Edge Function 呼叫 OpenAI API，App 不內嵌 OpenAI key

## 安全設計

Reality Hack 不會要求玩家：

- 進入危險或私人區域
- 跟蹤陌生人
- 深夜外出
- 上傳照片或敏感個資
- 執行違法、危險、羞辱或心理傷害任務

任何任務都可以略過。

## iOS 系統資訊策略

預設先使用不需要跳權限視窗的低風險情境訊號：

- 裝置類型與型號
- iOS 版本
- 語系與時區
- 當前小時與星期
- 深色 / 淺色外觀
- 電量與低耗電模式
- 網路類型與可連線狀態

使用者按下「啟用現實感測器」後，才會逐項請求：

- GPS 精確定位
- 相機 / 相簿
- 麥克風
- 通知
- 動作感測
- 媒體庫讀取權限

仍然不啟用聯絡人、行事曆、健康資料、簡訊或通話資料，避免超出遊戲必要性。

## 技術棧

- Expo 54 + React Native 0.81
- TypeScript
- AsyncStorage
- Supabase Edge Functions
- OpenAI Responses API

## 本機啟動

```powershell
cd C:\crypto\jobcraft-ai
npm install
npm run start
```

## Supabase / OpenAI

前端使用：

```env
EXPO_PUBLIC_SUPABASE_FUNCTION_URL=https://wajiopzwcptvhnfzocwp.supabase.co/functions/v1/generate-reality-mission
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_publishable_key
EXPO_PUBLIC_USE_MOCK_AI=false
```

OpenAI key 必須放在 Supabase Secrets，不要放進 Expo 前端：

```powershell
npx supabase login
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-supabase.ps1
```

部署後 smoke test：

```powershell
$envFile = "C:\crypto\jobcraft-ai\.env"
$url = (Get-Content $envFile | Where-Object { $_ -match "^EXPO_PUBLIC_SUPABASE_FUNCTION_URL=" } | ForEach-Object { ($_ -split "=", 2)[1] })
$key = (Get-Content $envFile | Where-Object { $_ -match "^EXPO_PUBLIC_SUPABASE_ANON_KEY=" } | ForEach-Object { ($_ -split "=", 2)[1] })
$body = @{
  alias = "A-17"
  locationContext = "校園附近"
  currentFeeling = "晚上剛下課，有點累，但想玩 3 分鐘的沉浸任務"
  availableMinutes = 3
  storyMood = "glitch"
  safetyLevel = "low"
  language = "zh-TW"
  systemContext = @{
    platform = "ios"
    deviceType = "phone"
    modelName = "iPhone"
    osName = "iOS"
    osVersion = "17"
    locale = "zh-TW"
    timezone = "Asia/Taipei"
    hour = 22
    weekday = "Monday"
    colorScheme = "dark"
    batteryLevel = 72
    lowPowerMode = $false
    networkType = "wifi"
    isInternetReachable = $true
  }
  playerModel = @{
    activeWindow = "evening"
    responseSpeed = "normal"
    completionRate = 0
    preferredMissionType = "observe"
  }
} | ConvertTo-Json -Depth 5 -Compress
Invoke-RestMethod -Method Post -Uri $url -Headers @{ Authorization = "Bearer $key"; apikey = $key; "Content-Type" = "application/json" } -Body $body
```

## 資料表

目前沿用 `generation_logs` 記錄生成狀態與成本監控，不存完整任務輸入或完整 AI 輸出。

## 收費方向

建議第一版：

- 免費下載
- 免費 5 次訊號
- 月訂閱：`realityhack_pro_monthly`
- 年訂閱：`realityhack_pro_yearly`
- 一次買斷：`realityhack_lifetime`

正式上架前要接 StoreKit 或 RevenueCat，並加入 Restore Purchases。

## iOS Build

```powershell
npx eas build --profile production --platform ios
npx eas submit --platform ios --profile production
```
