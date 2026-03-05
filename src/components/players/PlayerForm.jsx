import { useState } from 'react';
import { useGame } from '../../store/GameContext';

const LEVELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

function getLevelBtnColor(level, active) {
  if (!active) return 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50';
  const n = parseInt(level);
  if (n >= 9) return 'bg-red-500 text-white border-red-500';
  if (n >= 5) return 'bg-yellow-500 text-white border-yellow-500';
  return 'bg-green-500 text-white border-green-500';
}

export function PlayerForm({ onClose, editPlayer = null }) {
  const { dispatch } = useGame();
  const initLevel = (() => {
    const l = editPlayer?.level;
    if (!l) return '5';
    if (l === 'A') return '8';
    if (l === 'B') return '5';
    if (l === 'C') return '3';
    return l;
  })();
  const [name, setName] = useState(editPlayer?.name || '');
  const [level, setLevel] = useState(initLevel);
  function minsToInput(mins) {
    if (mins == null) return '';
    const h = Math.floor(mins / 60), m = mins % 60;
    return m === 0 ? `${h}` : `${h}:${String(m).padStart(2, '0')}`;
  }

  function parseTimeInput(val) {
    const s = val.trim();
    if (!s) return null;
    if (/^\d{4}$/.test(s)) { // 1930
      const h = parseInt(s.slice(0, 2)), m = parseInt(s.slice(2));
      if (h <= 23 && m <= 59) return h * 60 + m;
    }
    const colon = s.match(/^(\d{1,2}):(\d{2})$/); // 19:30
    if (colon) {
      const h = parseInt(colon[1]), m = parseInt(colon[2]);
      if (h <= 23 && m <= 59) return h * 60 + m;
    }
    const simple = s.match(/^(\d{1,2})$/); // 19
    if (simple) { const h = parseInt(simple[1]); if (h <= 24) return h * 60; }
    return null;
  }

  const [slotStart, setSlotStart] = useState(minsToInput(editPlayer?.timeSlot?.start));
  const [slotEnd, setSlotEnd] = useState(minsToInput(editPlayer?.timeSlot?.end));

  function buildTimeSlot() {
    const s = parseTimeInput(slotStart);
    const e = parseTimeInput(slotEnd);
    if (s != null && e != null && e > s) return { start: s, end: e };
    return null;
  }

  function handleSubmit(ev) {
    ev.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const timeSlot = buildTimeSlot();
    if (editPlayer) {
      dispatch({ type: 'UPDATE_PLAYER', payload: { id: editPlayer.id, name: trimmed, level, timeSlot } });
    } else {
      dispatch({ type: 'ADD_PLAYER', payload: { name: trimmed, level, timeSlot } });
    }
    onClose?.();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="輸入選手姓名"
          autoFocus
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          等級　<span className="text-xs text-gray-400 font-normal">L1 初學 → L6 中階 → L12 頂尖</span>
        </label>
        <div className="grid grid-cols-6 gap-1">
          {LEVELS.map(l => (
            <button
              key={l}
              type="button"
              onClick={() => setLevel(l)}
              className={`py-2 rounded-lg font-bold text-xs border min-h-[40px] transition-colors ${getLevelBtnColor(l, level === l)}`}
            >
              L{l}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          零打時段　<span className="text-xs text-gray-400 font-normal">選填，支援 19、19:30、1930</span>
        </label>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={slotStart}
            onChange={e => setSlotStart(e.target.value)}
            placeholder="開始，如 19"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
          />
          <span className="hidden sm:block text-gray-400 shrink-0">—</span>
          <input
            type="text"
            inputMode="numeric"
            value={slotEnd}
            onChange={e => setSlotEnd(e.target.value)}
            placeholder="結束，如 21:30"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
          />
          {(slotStart !== '' || slotEnd !== '') && (
            <button
              type="button"
              onClick={() => { setSlotStart(''); setSlotEnd(''); }}
              className="text-gray-400 hover:text-red-500 shrink-0 text-sm px-1"
              title="清除時段"
            >
              ✕
            </button>
          )}
        </div>
        {slotStart !== '' && slotEnd !== '' && !buildTimeSlot() && (
          <p className="text-xs text-red-500 mt-1">結束時間需大於開始時間（0–24 小時制）</p>
        )}
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 min-h-[44px]"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={!name.trim()}
          className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 min-h-[44px]"
        >
          {editPlayer ? '儲存' : '新增'}
        </button>
      </div>
    </form>
  );
}
