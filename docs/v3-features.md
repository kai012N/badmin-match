# v3.0 — 功能補強

## 三個核心需求

1. **批次匯入要能解析真實格式** — 球聚通常用 Line 群組整理名單，格式類似 `1. 豬 L6 (19-22)`
2. **PC 版 compact chips 要可以拖曳** — v2 的 chip 是純 button，拖曳壞了
3. **新增場地指派模式** — 點擊場地進入「指派模式」，依序點選 4 位選手確認上場

---

## 批次匯入 v2 — 真實格式解析

### 支援格式

```
1. 豬 L6
2. 食人妖精 L7 (19-22)
3. Debby (19-22)
4. sp賀L6 (19-22)
```

### 解析邏輯

```js
// 步驟 1：移除行號 "1. " "2、" 等
s = line.replace(/^\d+[.)。、：:]\s*/, '');

// 步驟 2：移除括號內容（時段、備註）
s = s.replace(/[（(][^)）]*[)）]/g, '').trim();

// 步驟 3：擷取等級 L6, L7...（不分大小寫，有無空格都支援）
const levelMatch = s.match(/\s*[Ll](\d+)\s*/);
const level = levelMatch ? levelMatch[1] : '5';  // 找不到預設 L5

// 步驟 4：移除等級部分，剩餘為姓名
const name = s.replace(/\s*[Ll]\d+\s*/g, '').trim();
```

### 預覽機制

匯入前先顯示解析結果表格：

| 姓名 | 等級 | 狀態 |
|------|------|------|
| 豬 | L6 | 新增 |
| 食人妖精 | L7 | 新增 |
| Debby | L5 | 新增 |

已存在的選手標記「略過」，避免重複。

---

## 等級系統升級：L1–L9

### 為什麼要升級

A/B/C 三級太粗略，同樣是「B 級」的選手可能差距很大。改用 1–9 級（數字越大越強），精度更高，配對演算法可以做更細緻的等級差控制。

### 向下相容

舊資料的 A/B/C 等級在演算法中對應到數值：

```js
function levelIndex(level) {
  if (level === 'A') return 8;   // 對應高手
  if (level === 'B') return 5;   // 對應中階
  if (level === 'C') return 3;   // 對應初學
  return parseInt(level) || 5;   // 數字直接用
}
```

顯示時：數字前加 `L`（L6、L7），A/B/C 維持原樣。

---

## PC 版 Chip 拖曳修復

### 問題根因

v2 的 compact chip 是普通 `<button>`，沒有接上 @dnd-kit 的 `useDraggable`，所以拖不動。

### 解法：DraggableChip 元件

```jsx
function DraggableChip({ player, isSelected, isInAssigning, onClick }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: player.id,
    data: { type: 'player', playerId: player.id },
  });

  return (
    <button
      ref={setNodeRef}
      {...listeners}   // 拖曳事件
      {...attributes}  // 無障礙屬性
      onClick={onClick}
      className={`... ${isDragging ? 'opacity-40' : 'cursor-grab'}`}
    >
      {/* chip 內容 */}
    </button>
  );
}
```

現在 chip 同時支援：拖曳到場地格 + 點選（tap-to-assign / assigning mode）。

---

## 場地指派模式

### 流程

```
點擊空場地卡片
↓
進入「指派模式」（藍色 header，顯示「指派模式」標示）
↓
點擊等待區選手 chip（最多 4 人，green ring 標示已選）
↓
4 人選滿後出現「確認上場」按鈕
↓
確認 → 開始計時，選手進入場地
取消 → 清除選中，退出指派模式
點擊空白處 → 退出指派模式
```

### 新增的 Context 狀態

```js
const [assigningCourtId, setAssigningCourtId] = useState(null);
const [assigningSlots, setAssigningSlots] = useState([null, null, null, null]);
// slots[0,1] = 隊 A，slots[2,3] = 隊 B

function startAssigning(courtId) { ... }
function clearAssigning() { ... }
function toggleAssigningPlayer(playerId) { ... }  // 點選/取消選手
```

### 兩種指派模式並存

| 模式 | 觸發方式 | 適用情境 |
|------|----------|----------|
| Tap-to-assign | 點選手 chip → 點空格 | 想精確指定某格位置 |
| 指派模式 | 點場地 → 點 4 位選手 | 快速選 4 人，系統自動分隊 |

兩者互斥，`startAssigning` 會清除 `selectedPlayerId`。

---

## 這版的改善

✅ 批次匯入支援真實 Line 群組名單格式
✅ PC 版 chips 可以拖曳
✅ 新增場地指派模式，快速選 4 人上場
✅ 等級系統升級為 L1–L9，配對更精準

## 這版的限制

- 配對演算法等級限制太硬，找不到符合條件時直接放棄
- 等待很久（waitCount >= 3）的選手沒有特殊優先處理
- 沒有替補功能（推薦配對中無法換人）
