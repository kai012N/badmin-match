# 技術架構說明

## 技術選型

| 技術 | 版本 | 選用原因 |
|------|------|----------|
| React | 19 | 主流生態系、hooks 成熟 |
| Vite | 7 | 開發速度快，HMR 體驗好 |
| Tailwind CSS | 3 | utility-first，RWD 調整快速 |
| @dnd-kit/core | latest | 比 react-beautiful-dnd 更輕量，支援觸控 |
| uuid | latest | 產生唯一選手/場次 ID |

---

## 資料流

```
使用者操作
    ↓
Component 呼叫 dispatch(action)
    ↓
reducer.js 處理 action，回傳新 state
    ↓
GameContext 更新，所有訂閱元件重新渲染
    ↓
useEffect([state]) 觸發 → saveState(state) → localStorage
```

---

## 狀態分層

### 持久化狀態（存 localStorage）

透過 reducer 管理：

```js
{
  players[],        // 選手資料 + 統計 + 動態 rating
  courts[],         // 場地 + 進行中場次
  waitingQueue[],   // 等待順序
  settings{},       // 規則設定（含招募等級區間）
  history[]         // 完成場次紀錄（含比分）
}
```

#### Player 欄位

```js
{
  id, name, level,
  rating,           // 動態評分，初始 = levelIndex × 100
  rd,               // Rating Deviation，初始 200，每場 -10，最低 50
  gamesPlayed,      // 總上場局數
  waitCount,        // 當前等待局數
  consecutiveGames, // 連續上場局數
  partnerHistory,   // { playerId: count } 隊友配對次數
  opponentHistory,  // { playerId: count } 對手配對次數
  lastPartners,
  lastOpponents,
}
```

#### History Entry 欄位

```js
{
  id, courtId, team1, team2,
  scoreA,    // 隊A得分，null 表示略過記分
  scoreB,    // 隊B得分，null 表示略過記分
  endTime,
}
```

### UI 暫存狀態（不存 localStorage）

放在 GameContext 的 `useState`，頁面重整後清除：

```js
selectedPlayerId      // tap-to-assign 選中的選手
assigningCourtId      // 哪個場地在指派模式
assigningSlots[]      // 指派模式的 4 個槽位
suggestionsOverride   // 替補後的推薦結果（覆蓋）
```

---

## 動態評分系統（Elo + RD）

### 初始化

```
rating = levelIndex(level) × 100   // L6 → 600
rd     = 200                        // 高不確定性，快速收斂
```

### 更新公式（每局結束，有記分時觸發）

```
K = max(16, rd / 5)                          // RD 越高 K 越大
expected = 1 / (1 + 10^((對隊平均 - 我隊平均) / 400))
margin   = 1 + (|scoreA - scoreB| / 21) × 0.3
delta    = round(K × (actual - expected) × margin)

new_rating = max(100, rating + delta)
new_rd     = max(50, rd - 10)
```

### RD 對 K 的影響

| rd | K 值 | 適用對象 |
|----|------|----------|
| 200 | 40 | 新人，快速收斂 |
| 100 | 20 | 一般穩定 |
| 50 | 16 | 資深，不易大幅波動 |

---

## 配對演算法架構

```
generateSuggestions(state)
    ├── 篩選可上場選手（waitingQueue × consecutiveLimit）
    ├── prioritySort() — 等待優先，waitCount ≥ 3 → 10x 權重
    ├── 漸進式等級篩選（gapLimit 從設定值逐步放寬到 8）
    ├── bestTeamSplit() — 3 種分組取 rating 總和差最小
    └── buildWarnings() — 隊友/對手重複警告

substitutePlayerInSuggestion(suggestions, courtId, playerId, state, substituteId?)
    ├── findEligibleSubstitutes() — 排除已在推薦/上場中的選手
    ├── substituteId 指定 → 直接用；未指定 → 取 prioritySort 第一位
    └── 替換 + 重算警告

getSubstituteCandidates(suggestions, playerId, state, count=3)
    └── 回傳前 N 位候選 ID，供 SuggestionPanel 下拉選單使用

getTeamRatingSum(team, players)
    └── 回傳隊伍 rating 總和，供 SuggestionPanel 顯示平衡度
```

> **注意：** 等級差（gapLimit）仍用 `levelIndex` 篩選 4 人候選池；
> 分隊平衡改用 `rating`，能辨識「強弱搭配」是否真的均等。

---

## 比分驗證規則

```js
// 羽球 21 分制，deuce 上限 30-29
if (winner === 21) return loser <= 19;           // 普通勝
if (winner >= 22 && winner <= 29) return diff === 2;  // deuce：差距恰好 2
if (winner === 30) return loser === 29;          // 上限 deuce
```

---

## Action 清單

| Action | 說明 |
|--------|------|
| `ADD_PLAYER` | 新增選手，自動初始化 rating / rd |
| `UPDATE_PLAYER` | 更新姓名、等級 |
| `REMOVE_PLAYER` | 移除選手（含從場地踢出） |
| `START_GAME` | 開始場次，更新 waitCount / consecutiveGames |
| `END_GAME` | 結束場次，傳入 scoreA/scoreB 則計算 Elo |
| `PARTIAL_ASSIGN_TO_COURT` | 3 人先入場（含 null 槽位），不啟動計時 |
| `ASSIGN_PLAYER_TO_COURT` | 拖曳/tap 指派單一選手；4 格滿自動啟動 |
| `REMOVE_PLAYER_FROM_COURT` | 從場地格移除選手 |
| `CONFIRM_SUGGESTION` | 轉發給 `START_GAME` |
| `MOVE_PLAYER_IN_QUEUE` | 拖曳重排等待順序 |
| `TOGGLE_PLAYER_ACTIVE` | 選手休息 ↔ 等待；回歸時 waitCount 歸零 |
| `UPDATE_SETTINGS` | 更新設定（含場地數量同步） |
| `RENAME_COURT` | 場地改名 |
| `LOAD_STATE` | 載入存檔 |

---

## RWD 斷點策略

以 Tailwind 的 `lg`（1024px）為唯一斷點：

```
< 1024px  手機/平板
  ├── 底部 TabBar：排場 | 選手 | 📊 紀錄 | 設定
  ├── 場地頁：CourtList（捲動）+ WaitingArea（釘底）
  └── 等待區位於 TabBar 正上方

≥ 1024px  桌機
  ├── 左欄：CourtList（獨立捲動）+ WaitingArea（釘底）
  └── 右側面板（可收合）：
        SuggestionPanel
        PlayerList
        HistoryPanel   ← v6 新增
        SettingsPanel
```

---

## 元件責任分工

### CourtCard.jsx
- 場地卡片的所有狀態（空場、指派中、進行中、已滿、部分填入）
- PlayerSlot：支援 drop target + tap-to-assign
- AssigningSlot：指派模式的臨時顯示
- 比分輸入：「結束本局」→ 展開 scoreA / scoreB 輸入 → 確認/略過

### WaitingArea.jsx
- `compact=true`：手機版 chip wrap（含 DraggableChip）
- `compact=false`：桌機版 chip wrap
- 同時處理 tap-to-assign 和 assigning-mode 兩種點擊邏輯

### SuggestionPanel.jsx
- 推薦配對卡片，顯示隊伍 rating 總和
- ✕ 點擊 → 展開替補下拉選單（3 位候選 + 「3 人先入場」）
- 「3 人先入場」→ dispatch `PARTIAL_ASSIGN_TO_COURT`

### HistoryPanel.jsx
- 子頁面一：Rating 排行（依 rating 排序，顯示勝/負/勝率）
- 子頁面二：對戰紀錄（最近 30 場，含比分、雙方選手）
- 勝負從 `history[]` 動態計算，不存入 player 欄位

### GameContext.jsx
- 橋接 reducer state 和 UI 暫存狀態
- 啟動時執行 `migrateState()`，補齊舊資料的 rating / rd
- 提供：`startAssigning`、`clearAssigning`、`toggleAssigningPlayer`、`substituteInSuggestion`、`getSubstituteCandidates`

### reducer.js
- 所有業務邏輯的唯一入口
- 匯出 `isValidBadmintonScore()` 供 CourtCard 即時驗證
- `CONFIRM_SUGGESTION` 直接轉發給 `START_GAME`，不重複邏輯
- `END_GAME` 根據 scoreA/scoreB 決定是否執行 Elo 更新

---

## localStorage 存取

```js
const KEY = 'badminton-scheduler-v1';

export function loadState() {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}
```

- key 帶版本號，方便未來做 schema migration
- try/catch 防止 JSON 損壞或隱私模式報錯
- 每次 state 改變都觸發存檔（useEffect）
- 載入時由 `migrateState()` 補齊新欄位，確保向下相容

---

## 拖曳架構

```
DndContext（App.jsx）
    ├── sensors: PointerSensor（滑鼠，distance: 8px 才觸發）
    │            TouchSensor（觸控，delay: 250ms）
    ├── onDragStart → 設定 draggedPlayer（用於 DragOverlay）
    └── onDragEnd → 判斷 drop target → dispatch ASSIGN_PLAYER_TO_COURT

可拖曳來源：DraggableChip（WaitingArea）
可放置目標：PlayerSlot（CourtCard，useDroppable）
拖曳預覽：DragOverlay + PlayerCard overlay 樣式
```
