import { useGame } from '../../store/GameContext';
import { CourtList } from './CourtList';
import { SuggestionPanel } from '../matching/SuggestionPanel';

export function CourtPageView() {
  const { state, selectedPlayerId, assigningCourtId, clearAssigning } = useGame();

  function handleBgClick() { clearAssigning(); }

  const assigningCourt = assigningCourtId
    ? state.courts.find(c => c.id === assigningCourtId)
    : null;

  return (
    <div onClick={handleBgClick} className="space-y-3">
      <div onClick={e => e.stopPropagation()}>
        <CourtList />
      </div>

      {assigningCourt && (
        <div className="text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-center">
          正在指派 <strong>{assigningCourt.name}</strong>　點等待中的選手加入（點空白處退出）
        </div>
      )}
      {!assigningCourtId && selectedPlayerId && (() => {
        const player = state.players.find(p => p.id === selectedPlayerId);
        return player ? (
          <div className="text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-center">
            已選：<strong>{player.name}</strong>　點場地空格指派上場
          </div>
        ) : null;
      })()}

      <div onClick={e => e.stopPropagation()}>
        <SuggestionPanel />
      </div>
    </div>
  );
}
