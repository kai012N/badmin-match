# v1.0 — 基礎架構

## 目標

從零建立一個可以實際使用的羽球排場系統，解決手工輪場的混亂問題。

---

## 核心設計決策

### 資料模型

系統圍繞三個核心實體設計：

```
players[]     — 選手（含等級、歷史統計）
courts[]      — 場地（含進行中場次）
waitingQueue  — 等待隊列（有序陣列，順序即優先權）
```

每位選手攜帶完整的競技歷史：
- `gamesPlayed` — 總上場局數
- `waitCount` — 當前等待局數
- `consecutiveGames` — 連續上場局數
- `partnerHistory` — 每位隊友配對次數
- `opponentHistory` — 每位對手對戰次數

### 為什麼用 localStorage

這是一個**場館現場工具**，不需要帳號、不需要雲端同步。使用 localStorage 讓系統：
- 無需後端，部署成本為零
- 離線可用（球館 Wi-Fi 不穩沒關係）
- 資料永久保留（不會因重新整理消失）

### 狀態管理選擇

使用 React Context + useReducer 而非 Redux，原因：
- 狀態邏輯單純，不需要中間件
- reducer.js 集中所有業務邏輯，易於追蹤
- 無需額外安裝依賴

---

## 配對演算法 v1

```
1. 篩選可上場選手（waitingQueue 中，consecutiveGames < 上限）
2. 依 waitCount 降序排列（等最久的優先）
3. 選等級差在設定範圍內的前 4 人
4. 用暴力法找 3 種分隊組合，取兩隊等級總和差最小的
5. 計算隊友/對手重複警告
```

### 等級系統 v1（A/B/C 制）

| 等級 | 說明 |
|------|------|
| A | 高手 |
| B | 中階 |
| C | 初學 |

---

## 建立的元件

| 元件 | 功能 |
|------|------|
| `CourtCard` | 場地卡片，顯示 4 個選手格、計時、結束按鈕 |
| `CourtList` | 場地列表容器 |
| `PlayerCard` | 可拖曳的選手卡片 |
| `PlayerForm` | 新增/編輯選手表單 |
| `WaitingArea` | 等待區，拖曳目標 |
| `SuggestionPanel` | 推薦配對顯示 |
| `SettingsPanel` | 設定面板 |
| `Header` | 頂部狀態列 |
| `TabBar` | 手機底部 Tab 導航 |

---

## RWD 策略

| 裝置 | 佈局 |
|------|------|
| 手機 (< 1024px) | 單欄 + 底部 TabBar |
| 桌機 (≥ 1024px) | 三欄：場地 \| 等待區 \| 選手管理 |

---

## 核心 Actions

```
ADD_PLAYER / UPDATE_PLAYER / REMOVE_PLAYER
START_GAME / END_GAME
ASSIGN_PLAYER_TO_COURT / REMOVE_PLAYER_FROM_COURT
CONFIRM_SUGGESTION
TOGGLE_PLAYER_ACTIVE
UPDATE_SETTINGS
```

---

## 這版的限制

- 手機無法跨 Tab 拖曳選手到場地
- 等級系統只有 A/B/C 三級，精度不夠
- 配對警告訊息太多、太嘈雜
- 沒有批次匯入選手功能
- 拖曳在手機上不穩定
