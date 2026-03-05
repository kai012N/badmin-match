# v4.0 — 演算法升級 + UI 精緻化

## 需求來源

系統開始在真實球聚中使用，暴露出更細緻的問題：

1. **演算法太死板** — 等級差設定 1 級找不到人就放棄，不會自動放寬
2. **等很久的人沒有強制優先** — waitCount 高的人和低的人排序差距不夠大
3. **推薦配對無法換人** — 演算法推薦了某人，但他臨時說不想打，只能整組重算
4. **視覺空間浪費** — 場地卡片垂直堆疊，同時看到的場地數太少
5. **等待區選手擠在一起** — 20 幾個人的 chip 看不完

---

## 演算法 v2

### 漸進式等級放寬

原本：等級差超過設定值就直接失敗。
改為：從設定值開始，找不到就逐步放寬，最多到差 8 級。

```js
for (let gapLimit = settings.levelGapLimit; gapLimit <= MAX_GAP; gapLimit++) {
  // 在當前 gapLimit 下找 4 人組合
  // 找到就 break
}
// 若全部放寬都找不到 → 強制取優先順序前 4 人
```

若實際使用的等級差超過原始設定，在推薦結果加入警告提示。

### waitCount 超過 3 局 → 10 倍優先權

```js
function prioritySort(ids, players) {
  return [...ids].sort((a, b) => {
    const wa = pa.waitCount >= 3 ? pa.waitCount * 10 : pa.waitCount;
    const wb = pb.waitCount >= 3 ? pb.waitCount * 10 : pb.waitCount;
    if (wb !== wa) return wb - wa;
    return pa.gamesPlayed - pb.gamesPlayed;  // 次要排序：上場少的優先
  });
}
```

等了 3 局以上的選手，優先權直接跳到最頂端，確保不會有人一直等不到上場機會。

### 推薦替補功能

點擊推薦配對中任一選手的 ✕ 按鈕：

```js
function substitutePlayerInSuggestion(suggestions, courtId, playerId, state) {
  // 1. 收集已在推薦或上場中的選手 ID
  // 2. 從 waitingQueue 過濾出可替補的選手
  // 3. 用優先排序取第一位
  // 4. 替換指定選手，重新計算警告
  // 5. 回傳新的 suggestions（不改變 state）
}
```

使用 `suggestionsOverride` 模式：替補結果儲存在 UI 狀態，不影響實際 state。當 state 改變（有人上場/下場），override 自動清除。

---

## 場地卡片水平佈局

### 修改前（垂直）

```
[ 隊 A ]
選手 1
選手 2
[ VS ]
[ 隊 B ]
選手 3
選手 4
```

### 修改後（水平）

```
[ 隊 A ]  │VS│  [ 隊 B ]
選手 1    │  │  選手 3
選手 2    │  │  選手 4
```

高度從約 180px 降到約 110px，同螢幕可同時看到更多場地。

---

## 等待區全面膠囊化

PC 版等待區原本是垂直 PlayerCard 列表（每人約 44px 高），改為 flex-wrap chip 佈局：

```jsx
// 前：垂直列表
<div className="space-y-1.5">
  {waitingPlayers.map(player => <PlayerCard ... />)}
</div>

// 後：膠囊 chip wrap
<div className="flex flex-wrap gap-1">
  {waitingPlayers.map(player => <DraggableChip ... />)}
</div>
```

20 位選手從需要捲動變成大約 4–5 行即可全部顯示。

---

## 右側面板

將選手名單、系統設定、推薦配對整合到右側可收合面板：

- 開啟：`w-80`，內容可獨立捲動
- 收起：窄條 `w-7`，顯示 `‹` 按鈕
- 切換按鈕收在面板內部（不再凸出到其他欄位）

---

## PlayerList 手風琴

選手名單預設展開，整個面板可以看到全部選手。批次匯入和新增表單移到手風琴**外面**，確保點擊後一定顯示（不受展開狀態影響）。

---

## 這版的改善

✅ 演算法不再因等級差卡死，會自動放寬
✅ 等很久的人（waitCount ≥ 3）強制優先上場
✅ 推薦配對可以單獨換人，不用整組重算
✅ 場地卡片更緊湊，同時看到更多場地
✅ 等待區 20+ 人也能清楚顯示
✅ 右側面板整合，桌機操作更流暢

## 這版的限制

- 休息後回來的選手帶著舊 waitCount，可能享有不應得的優先權
- 進入指派模式時會清空已指派的選手
- 右側面板使用 fixed 定位，在某些解析度下跑版
