# v6.0 — 動態評分系統

## 需求來源

隨著球聚持續舉辦，累積了足夠的選手資料，原本「只看等級」的配對方式已無法反映實際強弱。需求：

1. **記錄比分** — 每局結束後輸入實際得分
2. **動態評分** — 根據勝負與比分差距，自動調整每位選手的能力評分
3. **更準確的配對** — 配對演算法改用動態 rating 取代固定等級值
4. **替補選單升級** — 替換推薦名單中的人時，應顯示候選清單而非自動替補
5. **3 人先入場** — 踢掉一人後可先讓 3 人入場，再從等待區補第 4 人

---

## 動態評分設計

### Rating 初始值

```
rating = levelIndex(level) × 100

L1 → 100, L6 → 600, L12 → 1200
```

新選手在加入的同時，根據設定的等級自動取得初始 rating。

### Rating Deviation (RD)

每位選手除了 `rating` 之外，還有一個 `rd`（評分偏差值），代表系統對這個評分的**信心程度**：

| rd 值 | 意義 | K 值 |
|-------|------|------|
| 200（初始） | 高度不確定，快速收斂 | 40 |
| 100 | 一般穩定 | 20 |
| 50（最低） | 高度穩定，不易大幅波動 | 16 |

**rd 更新規則：**
- 每場比賽後：`new_rd = max(50, rd - 10)`
- 約 15 場後趨於穩定（rd 到達下限 50）

### Elo 更新公式

```
// 動態 K 值（由 rd 決定）
K = max(16, rd / 5)

// 期望勝率（由雙方平均 rating 計算）
expected = 1 / (1 + 10^((對隊平均 - 我隊平均) / 400))

// 比分差距加成
margin_factor = 1 + (|scoreA - scoreB| / 21) × 0.3

// Rating 更新
delta = round(K × (actual - expected) × margin_factor)
new_rating = max(100, rating + delta)
```

**比分差距加成範例：**

| 比分 | 差距 | margin_factor |
|------|------|--------------|
| 21-5 | 16 | 1.23 |
| 21-15 | 6 | 1.09 |
| 21-19 | 2 | 1.03 |
| 30-29 | 1 | 1.01 |

勝的越懸殊，評分調整越大；驚險過關，調整幅度近乎正常。

---

## 比分記錄流程

### 輸入 UI

點擊場地卡片上的「結束本局」後，展開比分輸入區塊（不直接關閉場次）：

```
┌─────────────────────────────┐
│  隊 A 分數        隊 B 分數  │
│  [ 21  ]    :    [ 15  ]    │
│                 [確認] [略過] │
└─────────────────────────────┘
```

### 驗證規則（21 分制）

```js
function isValidBadmintonScore(a, b) {
  if (a === b) return false;           // 平局不合法
  if (winner < 21) return false;       // 勝者至少 21 分
  if (winner > 30) return false;       // 不超過 30 分
  if (winner === 30 && loser !== 29) return false;   // 30 分時對手必須 29
  if (winner < 30 && winner - loser < 2) return false; // 差距至少 2 分
  return true;
}
```

### 略過比分

若不想記錄比分（臨時性球局、非正式練習），可點「略過」直接結束本局。Rating 不會更新，歷史仍會記錄（scoreA / scoreB 存為 null）。

---

## 配對演算法升級

### 分隊平衡改用 Rating

原本：

```js
// 用等級值加總比較
const diff = Math.abs(teamLevelSum(t1, players) - teamLevelSum(t2, players));
```

現在：

```js
// 用動態 rating 加總比較
const diff = Math.abs(teamRatingSum(t1, players) - teamRatingSum(t2, players));
```

`getPlayerRating` 函式提供相容回退：

```js
export function getPlayerRating(player) {
  if (player?.rating !== undefined) return player.rating;
  return levelIndex(player?.level) * 100;  // 未設定時用等級估算
}
```

### 效果

隨著比賽資料累積，等級相同但實際強弱有差的選手，rating 會逐漸分離，配對越來越準確。例如：

- 同為 L7 的甲、乙，甲連勝 → rating 800，乙連敗 → rating 550
- 系統優先讓甲對上高 rating 對手，乙與相近 rating 搭配

---

## 推薦配對 UI 升級

### 替補下拉選單（v5.1 帶入）

點擊推薦配對中任一選手的 ✕，不再自動替補，改為展開候選清單：

```
替換 豬                    [3 人先入場] [取消]
[L5 Alice] [L6 Bob] [L7 Charlie]
```

候選清單取等待區中優先順序最高的 3 位（`getSubstituteCandidates`）。

### 3 人先入場

點「3 人先入場」後：

1. 觸發 `PARTIAL_ASSIGN_TO_COURT` action
2. 3 人從等待區移除，填入場地（`currentGame` 含 null 槽位）
3. 場地顯示 3 格有人、1 格「空位」
4. 推薦配對中該場地的建議自動消失（場地已有 `currentGame`）
5. 使用者從等待區拖曳或點選第 4 人補上 → 自動開始計時

### 推薦配對顯示隊伍 Rating

配對卡片標題列顯示兩隊 rating 總和，方便一眼判斷平衡度：

```
[ 1號場  680 vs 670 ]  [確認上場]
```

---

## 選手卡片顯示 Rating

PlayerCard 右側新增藍色 rating 數字：

```
[L6] 豬       10局
              680?    ← ? 代表 rd > 100（仍在校準中）
              等2
```

`?` 標記在選手打滿約 15 場後消失，表示 rating 已趨穩定。

---

## 資料相容性

### 舊資料 Migration

載入舊版 localStorage 時，`GameContext` 初始化會自動補上缺少的欄位：

```js
function migrateState(saved) {
  return {
    ...saved,
    players: saved.players.map(p => ({
      ...p,
      rating: p.rating ?? levelIndex(p.level) * 100,
      rd: p.rd ?? 200,
    })),
  };
}
```

舊選手載入後立即獲得基於等級的初始 rating，下一局開始就能參與評分更新。

### History 格式更新

```js
historyEntry: {
  id, courtId, team1, team2,
  scoreA: 21,   // null 表示略過
  scoreB: 15,   // null 表示略過
  endTime,
}
```

---

## 修改的檔案

| 檔案 | 修改內容 |
|------|----------|
| `utils/levelUtils.js` | 新增 `getPlayerRating()` |
| `store/reducer.js` | 新增 `isValidBadmintonScore()`、`eloUpdate()`；`ADD_PLAYER` 加 rating/rd；`END_GAME` 加 Elo 計算；新增 `PARTIAL_ASSIGN_TO_COURT` action |
| `store/GameContext.jsx` | 新增 `migrateState()`；新增 `getSubstituteCandidates` 到 context |
| `utils/matchingAlgorithm.js` | `teamLevelSum` → `teamRatingSum`；新增 `getSubstituteCandidates()`、`getTeamRatingSum()` |
| `components/courts/CourtCard.jsx` | 「結束本局」改為展開比分輸入；新增確認/略過邏輯 |
| `components/players/PlayerCard.jsx` | 顯示 rating 及 `?` 信心指標 |
| `components/matching/SuggestionPanel.jsx` | 替補改為下拉選單；新增「3 人先入場」；顯示隊伍 rating 總和 |

---

## 修復（v6.1）

### 比分驗證邏輯錯誤

**問題：** 原本只檢查「差距 ≥ 2」，導致 deuce 區間的非法比分（如 22-19、23-20）被接受。

**羽球正確規則：**

| 情境 | 條件 |
|------|------|
| 普通勝 | `winner = 21`，`loser ≤ 19` |
| Deuce 勝 | `winner 22–29`，差距**恰好 = 2** |
| 上限 | `winner = 30`，`loser = 29`（唯一合法） |

**修正後：**

```js
if (winner === 21) return loser <= 19;
if (winner >= 22 && winner <= 29) return winner - loser === 2;
if (winner === 30) return loser === 29;
return false;
```

---

## 紀錄後台（v6.1 新增）

### 需求

- 能查看每位選手目前的 rating 與勝負紀錄
- 能查看最近的對戰歷史（含比分）

### HistoryPanel 元件

新建 `src/components/history/HistoryPanel.jsx`，包含兩個子頁面：

**Rating 排行**

| 欄位 | 說明 |
|------|------|
| # | 依 rating 排名 |
| 選手 | 等級色帶 + 姓名 |
| Rating | 藍色數字；`?` 表示 rd > 100（仍在校準） |
| 場次 | 總上場局數 |
| 勝/負 | 僅計有記分的場次；顯示勝率 % |

**對戰紀錄**

- 最近 30 場，新到舊排列
- 每筆顯示：時間、比分（綠色標示勝方）、雙方選手名單
- 未記分場次標示「未記分」

### 進入方式

| 裝置 | 位置 |
|------|------|
| 手機 | 底部 TabBar 新增第 4 個 Tab「📊 紀錄」 |
| 桌機 | 右側面板，位於選手名單與系統設定之間 |

---

## 修改的檔案（v6.1）

| 檔案 | 修改內容 |
|------|----------|
| `store/reducer.js` | 修正 `isValidBadmintonScore()` 邏輯 |
| `components/history/HistoryPanel.jsx` | 新建：Rating 排行 + 對戰紀錄 |
| `components/layout/TabBar.jsx` | 新增「📊 紀錄」Tab |
| `App.jsx` | 手機加 history tab；桌機右側面板加入 HistoryPanel |

---

## 功能開關（v6.2）

### 需求

對戰紀錄與動態評分系統功能較為進階，並非每場球聚都需要啟用。加入開關讓使用者自行決定是否開啟。

### 實作

在「系統設定」面板新增「功能開關」區塊，內含一個 toggle switch：

```
[ 功能開關 ]
對戰紀錄 & Rating     ●───  ← 預設關閉
比分記錄、排行榜、動態評分
```

**行為：**

| 開關 | 效果 |
|------|------|
| OFF（預設） | 手機版底部不顯示「📊 紀錄」Tab；桌機右側面板不顯示 HistoryPanel |
| ON | 📊 Tab 出現；桌機面板顯示 HistoryPanel；比分記錄功能正常運作 |

- 若使用者當前在「紀錄」Tab 時關閉開關，自動導回「排場」Tab
- `showHistory` 存入 `settings`，同樣透過 `UPDATE_SETTINGS` 更新，持久化至 localStorage

### 修改的檔案（v6.2）

| 檔案 | 修改內容 |
|------|----------|
| `store/reducer.js` | `initialState.settings` 新增 `showHistory: false` |
| `components/settings/SettingsPanel.jsx` | 新增「功能開關」區塊，含 toggle switch |
| `components/layout/TabBar.jsx` | 接收 `showHistory` prop，`requireHistory` 標記的 Tab 依此顯示/隱藏 |
| `App.jsx` | HistoryPanel 依 `showHistory` 條件渲染；TabBar 傳入 prop；useEffect 處理 Tab 重導向 |

---

## 這版的改善

✅ 比分記錄（21分制驗證，支援 deuce）
✅ Deuce 比分驗證修正（差距必須恰好 2）
✅ Elo + RD 動態評分，越打越準
✅ 新人快速收斂，老手穩定不飄
✅ 配對分隊用 rating 而非固定等級，能辨識「強弱搭」是否真的平衡
✅ 推薦配對顯示隊伍 rating 供參考
✅ 替補改為下拉選單，使用者自主選擇
✅ 3 人先入場，等待區補第 4 人
✅ 舊資料自動 migration，無縫升級
✅ 紀錄後台：Rating 排行榜 + 對戰歷史

## 這版的限制

- Rating 在選手場數少時（rd 高）仍不夠準確，需累積 10–15 場才趨於穩定
- 目前無法在 UI 上查看單一選手的 Rating 歷史走勢
- 尚未實作時間衰減（長期未出賽的 rd 不會自動上升）
- 尚未實作搭檔協同度（Partner Synergy）
