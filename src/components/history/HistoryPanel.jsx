import { useState } from 'react';
import { useGame } from '../../store/GameContext';
import { displayLevel } from '../../utils/levelUtils';

function formatDuration(startTime, endTime) {
  if (!startTime) return '—';
  const total = Math.floor((endTime - startTime) / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m} 分 ${s} 秒` : `${s} 秒`;
}

function MatchHistory({ players, history }) {
  const recent = [...history].reverse().slice(0, 30);

  if (recent.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">尚無對戰紀錄</p>;
  }

  function PlayerChip({ id }) {
    const p = players.find(pl => pl.id === id);
    if (!p) return null;
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-gray-100 rounded-full px-2 py-0.5">
        <span className="text-gray-500">{displayLevel(p.level)}</span>
        <span className="font-medium text-gray-700">{p.name}</span>
      </span>
    );
  }

  return (
    <div className="space-y-2">
      {recent.map(h => (
        <div key={h.id} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
          <div className="text-xs text-gray-400 mb-2">⏱ {formatDuration(h.startTime, h.endTime)}</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex flex-wrap gap-1">
              {h.team1.map(id => <PlayerChip key={id} id={id} />)}
            </div>
            <span className="text-xs text-gray-300 shrink-0">VS</span>
            <div className="flex-1 flex flex-wrap gap-1 justify-end">
              {h.team2.map(id => <PlayerChip key={id} id={id} />)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function HistoryPanel() {
  const { state } = useGame();
  const { players, history } = state;
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 w-full text-left font-semibold text-gray-700 py-1"
      >
        <span>📊 對戰紀錄</span>
        {history.length > 0 && <span className="text-xs text-gray-400 font-normal">{history.length} 場</span>}
        <span className="ml-auto text-xs text-gray-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="mt-2">
          <MatchHistory players={players} history={history} />
        </div>
      )}
    </div>
  );
}
