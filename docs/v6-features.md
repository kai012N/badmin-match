# v6.0 — 功能擴充與 UI 重構

## 本版改動總覽

---

## 1. 選手綁定規則（配對限制）還原

### 功能說明
從舊版還原「強制同隊」與「避免同場」的配對規則，讓管理員可以對指定選手設置限制。

### 資料結構

```js
// state.pairRules
{
  forceTeams: [{ playerA: id, playerB: id }],  // 1-to-1，雙向唯一
  avoidGame:  [{ playerA: id, playerB: id }],  // 多對多
}
```

### 新增 Reducer Actions

| Action | Payload | 說明 |
|--------|---------|------|
| `SET_FORCE_TEAM` | `{ playerA, playerB }` | 設定強制同隊（先移除雙方舊規則再新增） |
| `REMOVE_FORCE_TEAM` | `{ playerId }` | 移除指定選手的強制規則 |
| `ADD_AVOID_GAME` | `{ playerA, playerB }` | 新增避免同場（防重複） |
| `REMOVE_AVOID_GAME` | `{ playerA, playerB }` | 移除指定避免規則 |

REMOVE_PLAYER 時同步清除所有涉及該選手的 pairRules。

### UI

- PlayerList 每個選手卡右側有 `⋮` 圓形按鈕，開啟下拉選單
- 選單項目：編輯、強制同隊、避免同場、設為休息/加入等待、刪除
- 選擇規則後進入「選人模式」，點擊目標選手完成設定
- 選手卡展示規則標籤：`🤝 搭檔名`、`🚫 迴避名`

---

## 2. Header 模態視窗（桌面版）

### 設計目標
桌面版把「選手名單」和「系統設定」從常駐側欄改為 Header 按鈕 + 彈窗，釋放主畫面空間給場地與配對資訊。

### 結構

```
Header（桌面）：
  [👥 選手名單]  [⚙ 系統設定]  [?]

App.jsx：
  SimpleModal（通用外殼）
    ├── title bar + close button
    └── scrollable body（傳入 children）
```

- `playersOpen` / `settingsOpen` / `tutorialOpen` 三個 state 控制
- 手機版 TabBar 不動，Modal 按鈕 `hidden lg:flex` 僅桌面顯示

### SimpleModal 規格

```jsx
<SimpleModal title="選手名單" onClose={() => setPlayersOpen(false)}>
  <PlayerList />
</SimpleModal>
```

---

## 3. 系統設定擴充

| 設定項 | 改動 |
|--------|------|
| 場地數量 | 原 1–12 快選 + 新增自訂輸入框（上限 99） |
| 招募等級 | 最高從 L12 擴展至 L18 |
| 等差限制 | 新增「差 2 級」選項；「不限制」改為內部值 8（原為 2） |

---

## 4. 教學彈窗（Tutorial Modal）

4 個步驟，首次進入自動顯示，`?` 按鈕可隨時重開。

| 步驟 | 標題 | 內容 |
|------|------|------|
| 1 | 👥 選手名單 | 新增、批次匯入、等級設定 |
| 2 | 🎯 手動上場 | 拖曳/點選指派選手到場地 |
| 3 | ⚡ 自動配對 | 使用配對建議一鍵上場 |
| 4 | ⚙ 系統設定 | 場地數量、等級範圍、等差限制 |

- 儲存在 `localStorage('tutorial-seen')` 避免重複顯示
- 步驟底部：圓點導覽（active = 寬膠囊）、上一步/下一步/略過/完成

---

## 5. 零打時段（Time Slot）功能

### 目標
長時間球聚（6–12 小時）中，不同選手有各自的出席時段，系統自動管理進出等待區。

### 資料格式
時段以**分鐘數（從午夜算起）**儲存，例如 `19:30 = 1170`。

```js
player.timeSlot = { start: 1170, end: 1350 }  // 19:30–22:30
```

### 支援批次匯入格式

| 格式 | 範例 |
|------|------|
| 4位數 HHMM（括號）| `鱷魚 L7(1930-2230)` |
| HH:MM（括號）| `Avery L6 (19:30-21:30)` |
| 整點（括號）| `Inez L6 (19-22)` |
| 4位數 HHMM（裸）| `Boris L8 1930-2230` |
| HH:MM（裸）| `小明 L5 18:30-21:30` |
| 整點（裸）| `大豬 L6 19-22` |
| 全形括號 | `選手Ａ L5（19-22）` |

解析優先順序：括號格式 → 去掉括號內容 → 裸格式（在等級解析之前，防止尾數被誤判為等級）

### 自動管理邏輯（GameContext，每 30 秒檢查）

```js
// 自動加入：未在等待區、未上場、時段內
if (!inQueue && !onCourt && cur >= start && cur < end) → TOGGLE_PLAYER_ACTIVE

// 自動移除：在等待區、已過結束時間
if (inQueue && cur >= end) → TOGGLE_PLAYER_ACTIVE
```

使用 `stateRef` pattern 避免 interval 中的 stale closure 問題。

### 新增選手時的智慧加入

```js
// 無時段 → 立即加入等待區（原行為）
// 有時段但尚未開始 → 不加入（等自動觸發）
// 有時段且當前在時段內 → 立即加入
```

### 舊資料遷移

```js
// migrateState：timeSlot.start < 100 表示舊格式（小時），乘以 60 轉換
if (timeSlot && timeSlot.start < 100) {
  timeSlot = { start: timeSlot.start * 60, end: timeSlot.end * 60 };
}
```

---

## 6. 等待區 / 場外選手 UI 更新（WaitingArea）

### 待進場 chip
選手有時段但尚未到開始時間，顯示在「場外選手」區塊：

```
⏰ 小明  19:30
```

### 場外選手區塊

- 標題列：`▶ 場外選手 (N)  ⏰ M 待進場  現在 HH:MM`
- 點擊標題 toggle 收合，預設展開
- 內容區 `max-h-40 overflow-y-auto`，超過則捲動
- 「待進場」子群組（藍色 chip，不可點擊）
- 「休息中」子群組（灰色按鈕，點擊重新加入等待區）

---

## 7. 選手名單排序

PlayerList 顯示順序：

1. **等待中**（inQueue）— 依 `gamesPlayed` 升序（橘色局數最少者在最上面）
2. **上場中**（onCourt）— 依 `gamesPlayed` 升序
3. **休息中**（其餘）— 依 `gamesPlayed` 升序

```js
[...players].sort((a, b) => {
  const statusOrder = p => inQueue ? 0 : onCourt ? 1 : 2;
  if (sa !== sb) return sa - sb;
  return (a.gamesPlayed ?? 0) - (b.gamesPlayed ?? 0);
})
```

---

## 本版完成項目

✅ 選手綁定規則（強制同隊、避免同場）還原
✅ 桌面版 Header 按鈕 + 彈窗（選手名單、系統設定）
✅ 場地數量自訂輸入（上限 99）
✅ 招募等級上限擴展至 L18
✅ 等差限制新增「差 2 級」
✅ 首次使用教學彈窗（4 步驟）
✅ 零打時段批次匯入（6 種格式）
✅ 時段自動進出等待區（30 秒輪詢）
✅ 新增選手時智慧判斷是否立即入隊
✅ 舊資料格式自動遷移
✅ 場外選手區塊（待進場 + 休息中），含 toggle + 高度限制
✅ 選手名單依狀態 + 局數排序
