# v6.0 — 功能簡化 + UX 精修

## 本版目標

移除複雜度高但實際使用率低的功能（評分、比分、連打限制），讓介面更乾淨；同時針對手機體驗做響應式優化，並完善批次匯入的智慧更新邏輯。

---

## 一、功能簡化

### 移除 Rating / ELO 系統

**移除內容：**
- `isValidBadmintonScore`、`eloUpdate` 邏輯
- 選手資料的 `rating`、`rd` 欄位
- `getPlayerRating`（levelUtils）、`getTeamRatingSum`（matchingAlgorithm）
- 結束本局的比分輸入 UI（`scoreA`、`scoreB`、`showScore` state）
- 歷史紀錄的 `RatingTable` 與對戰勝負統計

**保留：** 對戰紀錄（場次歷史列表）。

---

### 移除連打上限（consecutiveLimit）

移除 `consecutiveGames` 計數與設定，配對演算法不再過濾剛打完的選手。

---

### 移除本場招募時段設定（sessionRange）

**改為動態計算色帶：**

```js
// src/utils/levelUtils.js
export function getPlayerRange(players) {
  const levels = players.map(p => parseInt(p.level)).filter(n => !isNaN(n));
  if (levels.length < 2) return null;
  return { min: Math.min(...levels), max: Math.max(...levels) };
}
```

色帶依本場實際匯入選手的等級上下限自動分色。人員等級跨度大，色帶就跨大；跨度小，色帶就密。不再需要手動設定區間。

各元件從 `state.settings.sessionRange` 改為 `getPlayerRange(state.players)` 在 render 時動態取得。

---

### 等級差預設改為「不限制」

```js
// reducer.js initialState
settings: {
  levelGapLimit: 8,  // 原本是 1（差2級）
  ...
}
```

設定選項順序改為：不限制（預設） → 差2級 → 差1級 → 同級。

---

## 二、教學引導重設計

### 問題
舊版教學使用四塊 `div` 拼成鏤空遮罩，實際產生「殘角」（四個 div 邊緣沒有完全對齊）的視覺瑕疵。

### 新設計

**全遮罩 + 定位提示卡**，不再鏤空：

```
┌─ fixed inset-0 overlay (rgba 0.55) ─────────────────┐
│                                                       │
│   [提示卡片] ← 定位在目標元素附近                       │
│                                                       │
└───────────────────────────────────────────────────────┘
```

**PC 版：** `computeDesktopStyle(rect)` 計算卡片位置
- 一般元素：優先放在目標下方，空間不足改放上方
- 高元素（height > 40% viewport）：改放左側或右側
- 所有位置加 viewport clamp，確保不超出畫面

**M 版：** 卡片固定居中，`getArrowDir(rect)` 根據目標位置計算方向，在卡片旁加箭頭動畫（▲▼◀▶）指向對應邊緣。

**步驟內容：**

| 步驟 | 目標（PC）| 目標（M）|
|------|----------|---------|
| 選手名單 | `[data-tutorial="players-btn"]` | `[data-tutorial="players-tab"]` |
| 手動上場 | `[data-tutorial="court-area"]` | 同左 |
| 自動配對 | `[data-tutorial="suggestions"]` | null（M 版無此面板，居中顯示）|
| 系統設定 | `[data-tutorial="settings-btn"]` | `[data-tutorial="settings-tab"]` |

新增「上一步」按鈕（第一步隱藏），末步按鈕改為「開始 🎉」。

---

## 三、選取狀態優化

### 問題：點空白處無法取消選取

`clearAssigning()` 原本只清除 `assigningCourtId` + `assigningSlots`，不清除 `selectedPlayerId`。各欄 `onClick={e => e.stopPropagation()}` 阻擋了事件冒泡，導致點空白區域無效。

### 修復

**GameContext — 統一清除入口：**

```js
function clearAssigning() {
  setAssigningCourtId(null);
  setAssigningSlots([null, null, null, null]);
  setSelectedPlayerId(null);  // ← 新增
}
```

**App.jsx — 欄位改觸發 clearAssigning：**

```jsx
// 修改前
<div onClick={e => e.stopPropagation()}>

// 修改後
<div onClick={clearAssigning}>
```

左欄（場地 + 等待區）、右欄（推薦配對）、M 版等待區 bar 全部改為點擊空白處呼叫 `clearAssigning()`。

**WaitingArea — chip click 加 stopPropagation：**

```jsx
onClick={e => {
  e.stopPropagation();  // ← 避免冒泡到容器的 clearAssigning
  if (assigningCourtId) {
    toggleAssigningPlayer(player.id);
  } else {
    setSelectedPlayerId(isSelected ? null : player.id);
  }
}}
```

**CourtPageView — 背景點擊無條件清除：**

```js
// 修改前
function handleBgClick() {
  if (assigningCourtId) clearAssigning();
}

// 修改後
function handleBgClick() {
  clearAssigning();
}
```

---

### 選手 chip 選取樣式改善

**問題：** 選取狀態完全覆蓋等級色帶，視覺突兀（整個 chip 變藍）。

**修法：** 保留等級色帶為底，選取/指派狀態只疊加外框 ring：

```jsx
// 修改前
${isSelected ? 'ring-2 ring-blue-400 border-blue-400 bg-blue-50 text-blue-700' : getLevelColor(...)}

// 修改後
${getLevelColor(player.level, sessionRange, true)}
${isSelected && !isInAssigning ? 'ring-2 ring-offset-1 ring-blue-500 font-medium' : ''}
${isInAssigning ? 'ring-2 ring-offset-1 ring-green-500 font-medium' : ''}
```

同時在 overflow 容器加 `p-1`，避免 ring 被 `overflow-y-auto` 裁切。

---

## 四、批次匯入智慧更新

### 舊邏輯

同名選手直接略過，即使等級或時段已改變也不更新。

### 新邏輯

| 狀態 | 條件 | 動作 |
|------|------|------|
| 新增 | 名字不存在 | `ADD_PLAYER` |
| 更新 | 名字存在，但等級或時段不同 | `UPDATE_PLAYER` |
| 略過 | 名字存在，資料完全相同 | 不動作 |

```js
function classify(p) {
  const existing = state.players.find(ep => ep.name === p.name);
  if (!existing) return { status: 'new', existing: null };
  const effectiveLevel = p.level ?? existing.level;
  const levelChanged = String(existing.level) !== String(effectiveLevel);
  const timeSlotChanged =
    JSON.stringify(existing.timeSlot ?? null) !== JSON.stringify(p.timeSlot ?? null);
  if (levelChanged || timeSlotChanged) return { status: 'update', existing };
  return { status: 'skip', existing };
}
```

### 未填等級保留原有等級

解析後 `level` 若為 `null`（使用者沒有填）：
- 新選手 → 預設 L5
- 既有選手更新 → 保留原本等級（不覆蓋）

```js
// 匯入時
if (status === 'new') {
  dispatch({ type: 'ADD_PLAYER', payload: { level: p.level ?? '5', ... } });
} else if (status === 'update') {
  dispatch({ type: 'UPDATE_PLAYER', payload: { level: p.level ?? existing.level, ... } });
}
```

### 預覽表格增強

- 更新列顯示藍底
- 等級欄顯示新值，若有變動則同時顯示舊值（刪除線）
- 時段欄同樣顯示舊值刪除線
- 摘要列顯示「新增 N、更新 N、略過 N」三個獨立計數

---

## 五、手機版兩欄響應式佈局

### 場地列表

```jsx
// CourtList.jsx
// 修改前：grid-cols-1 sm:grid-cols-2
// 修改後：任何寬度都 2 欄
<div className="grid grid-cols-2 gap-2 lg:gap-3">
```

### CourtCard 隊伍改上下排版

```jsx
// 外層容器：預設垂直，桌機水平
<div className="flex flex-col p-2 gap-1.5 lg:flex-row lg:items-stretch lg:p-3 lg:gap-2">

// VS 分隔線：預設橫線，桌機直線
<div className="flex items-center gap-1.5 lg:flex-col lg:shrink-0 lg:px-1 lg:gap-0">
  <div className="flex-1 h-px bg-gray-200 lg:h-auto lg:w-px" />
  <span>VS</span>
  <div className="flex-1 h-px bg-gray-200 lg:h-auto lg:w-px" />
</div>
```

### 推薦配對兩欄

```jsx
// SuggestionPanel.jsx
// 手機 2 欄、桌機單欄
<div className="grid grid-cols-2 gap-2 lg:block lg:space-y-3">
  {suggestions.map(...)}
</div>
```

---

## 改動總覽

| 項目 | 說明 |
|------|------|
| ✅ 移除 Rating/ELO | 減少複雜度，保留對戰歷史 |
| ✅ 移除連打上限 | 簡化設定 |
| ✅ 色帶動態計算 | 依本場選手自動分色 |
| ✅ 等級差預設不限制 | 更符合一般球聚需求 |
| ✅ 教學重設計 | 全遮罩 + 定位卡片，無殘角 |
| ✅ 點空白取消選取 | clearAssigning 統一清除兩種選取狀態 |
| ✅ Chip 選取樣式 | 保留等級色帶，ring overlay 疊加 |
| ✅ 批次匯入智慧更新 | 同名但資料不同者自動 UPDATE_PLAYER |
| ✅ 未填等級保留原值 | 只更新時段時不覆蓋既有等級 |
| ✅ 手機場地兩欄 | 任何寬度維持 2 欄，省空間 |
| ✅ 隊伍上下排版 | 窄卡片可讀性更好 |
| ✅ 推薦配對兩欄 | 手機一屏可同時看到多場建議 |
