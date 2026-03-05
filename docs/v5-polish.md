# v5.0 — 精修與修復

## 問題清單

實際使用中發現的 bug 與體驗問題，逐一修復。

---

## Bug 修復

### 1. 批次匯入面板無法顯示

**原因：** `BatchImportPanel` 被包在手風琴的 `{open && ...}` 裡面，但觸發按鈕在手風琴外面。手風琴收起時按鈕可見，但面板永遠不顯示。

**修復：** 將 `BatchImportPanel` 和 `PlayerForm` 移到手風琴 `{open && ...}` **外面**，確保無論展開狀態都能顯示。

```jsx
// 修復前
{open && (
  <>
    {showBatch && <BatchImportPanel />}  // ← 被手風琴鎖住
    {showForm && <PlayerForm />}
    {/* 選手列表 */}
  </>
)}

// 修復後
{showBatch && <BatchImportPanel />}     // ← 獨立在外
{showForm && <PlayerForm />}
{open && (
  <>
    {/* 選手列表 */}
  </>
)}
```

---

### 2. 進入指派模式清空已有選手

**情境：** 拖曳 A、B 兩位選手到場地後，再點擊場地進入指派模式，A 和 B 消失了。確認新的 4 人後，A 和 B 既不在場上也不在等待區，變成「休息」狀態。

**根本原因：**
- `startAssigning` 重置 `assigningSlots` 為 `[null, null, null, null]`，沒有帶入現有選手
- `START_GAME` dispatcher 沒有把被頂掉的舊選手送回等待區

**修復一：進入指派模式時預填現有選手**

```js
function startAssigning(courtId) {
  setSelectedPlayerId(null);
  setAssigningCourtId(courtId);
  const court = state.courts.find(c => c.id === courtId);
  const t1 = court?.currentGame?.team1 ?? [null, null];
  const t2 = court?.currentGame?.team2 ?? [null, null];
  // 預填現有選手到對應槽位
  setAssigningSlots([t1[0] ?? null, t1[1] ?? null, t2[0] ?? null, t2[1] ?? null]);
}
```

**修復二：START_GAME 把被頂掉的選手送回等待區**

```js
case 'START_GAME': {
  // 找出這個場地原本的選手
  const prevPlayers = prevCourt?.currentGame
    ? [...team1Old, ...team2Old].filter(Boolean)
    : [];

  // 不在新 4 人名單中的舊選手 → 送回等待區
  const displaced = prevPlayers.filter(id => !newPlayers.includes(id));
  displaced.forEach(id => {
    if (!waitingQueue.includes(id)) waitingQueue.push(id);
  });
}
```

---

### 3. 休息後回來優先權不合理

**問題：** 選手帶著 `waitCount: 5` 去休息，回來後還是 5，直接享有 10x 優先權。但他是「主動」休息，不是「被動」等待。

**修復：** 選手從休息回到待機時，`waitCount` 歸零。

```js
case 'TOGGLE_PLAYER_ACTIVE': {
  const inQueue = state.waitingQueue.includes(playerId);
  // 重新加入等待時，重置等待計數
  const players = !inQueue
    ? state.players.map(p =>
        p.id === playerId ? { ...p, waitCount: 0 } : p
      )
    : state.players;
  return { ...state, waitingQueue, players };
}
```

**邏輯：** 主動選擇休息 ≠ 被動等待。回來後從零開始排隊，公平競爭。

---

## 佈局優化

### 右側面板：從 fixed 改為正常流

**問題：** `position: fixed` 在不同螢幕解析度下對齊失準，滾動條出現時會跑版。

**改法：** 改用 flex 佈局 + `overflow-hidden` 的寬度動畫：

```jsx
<div className={`overflow-hidden transition-all duration-300 ${rightOpen ? 'w-80' : 'w-7'}`}>
  {rightOpen ? <PanelContent /> : <ToggleButton />}
</div>
```

右欄寬度從 `w-72` 增加到 `w-80`，並改用 `overflow-y-scroll`（固定保留 scrollbar 空間，防止頁面跳動）。

---

### 等待區釘在底部

**設計目標：** 隨時可以看到等待選手，隨時可以指派。

**PC 版：** 左欄分為上下兩段
- 上段：場地列表（`flex-1 overflow-y-auto`），獨立捲動
- 下段：等待區（`shrink-0`），固定在底部，不會因捲動消失

**M 版：** 同樣邏輯，等待區釘在 TabBar 正上方
- TabBar 是 `fixed bottom-0`（高度 56px），不在正常流
- 外層容器加 `pb-14`（= 56px），為 TabBar 保留空間
- 等待區在正常流最底部，剛好落在 TabBar 上方

```jsx
<div className="lg:hidden flex-1 flex flex-col min-h-0 pb-14">
  <div className="flex-1 overflow-y-auto p-3">
    {/* 頁面內容 */}
  </div>
  {activeTab === 'courts' && (
    <div className="shrink-0 bg-white border-t border-gray-200 px-3 py-2">
      <WaitingArea compact />  {/* 釘在 TabBar 上方 */}
    </div>
  )}
</div>
```

---

## 整頁不捲動設計

整個 App 改為 `h-screen overflow-hidden`，由各區塊自己負責捲動：

```
h-screen flex flex-col
├── Header（固定高度）
├── 內容區（flex-1 min-h-0）
│   ├── 場地列表（獨立捲動）
│   └── 等待區（釘底）
└── 右側面板（獨立捲動）
```

避免整頁捲動導致重要資訊滾出畫面。

---

---

## 等級系統升級 + 批次匯入修復

### 批次匯入等級解析失效

**問題：** 解析器正規表示式只能匹配 `L6` 格式，遇到全形 `Ｌ6`、有空格 `L 6` 或小寫 `l6` 時失敗，全部回退為預設值 L5。

**修復：** 擴充正規表示式支援所有常見變體：

```js
// 修復前
const levelMatch = s.match(/\s*[Ll](\d+)\s*/);

// 修復後：支援全形 Ｌ、有空格 L 6、小寫 l
const levelMatch = s.match(/[ＬLl]\s*(\d+)/);
```

---

### 等級系統擴展：L1–L12

**背景：** 實際球聚招募時通常以等級區間為單位（例如「L4–L9 場」或「L7–L12 高手場」），固定的 L1–L9 無法滿足更高等級的描述需求。

**改動：**

| 項目 | 改動前 | 改動後 |
|------|--------|--------|
| 選手等級範圍 | L1–L9 | **L1–L12** |
| PlayerForm 按鈕 | 9 個一排 | 12 個 2×6 格排列 |
| 色帶邏輯 | 絕對值著色 | **相對招募區間著色** |
| 設定項目 | 無 | 新增「本場招募等級區間」 |

### 招募區間設定

在系統設定新增「本場招募等級區間」，可設定最低與最高等級（各自 L1–L12 任選）：

```
本場招募等級區間：L4 – L9
```

### 色帶相對化

所有等級標籤的顏色不再使用固定絕對值，改為**相對於本場招募區間**計算：

| 位置 | 顏色 | 說明 |
|------|------|------|
| 區間底部 33% | 🟢 綠色 | 相對較低等級 |
| 區間中段 34% | 🟡 黃色 | 中階 |
| 區間頂部 33% | 🔴 紅色 | 相對較高等級 |
| 區間外（上/下） | ⬜ 灰色 | 不在本場招募範圍 |

**範例（區間 L4–L9）：**
- L4 → 綠色（底部）
- L6–L7 → 黃色（中段）
- L9 → 紅色（頂部）
- L3 或 L10 → 灰色（區間外）

### 共用工具模組

建立 `src/utils/levelUtils.js`，統一管理等級相關邏輯：

```js
export function levelIndex(level) { ... }   // A/B/C + 數字換算
export function displayLevel(level) { ... } // 顯示格式
export function getLevelColor(level, sessionRange, withBorder) { ... } // 著色
```

原本各元件各自定義的 `getLevelColor`、`displayLevel` 全部移除，改 import 自此共用模組。`matchingAlgorithm.js` 的 `levelIndex` 也改 re-export 自 levelUtils，保持單一來源。

---

## 這版的改善

✅ 批次匯入按鈕隨時可用，不受手風琴影響
✅ 指派模式保留已有選手
✅ 被頂掉的選手自動回等待區
✅ 休息後回來的 waitCount 公平重置
✅ 右側面板不再跑版
✅ 等待區 PC + M 版都釘在底部，隨時可管理
✅ 整頁不捲動，資訊始終在視線內
✅ 批次匯入支援全形/空格/小寫 L 等各種格式
✅ 等級擴展至 L12，支援高手場招募需求
✅ 等級色帶相對化，視覺反映本場結構而非絕對強弱
✅ 等級邏輯統一到 levelUtils，消除重複定義
