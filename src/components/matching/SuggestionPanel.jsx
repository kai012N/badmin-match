import { useState } from 'react';
import { useGame } from '../../store/GameContext';
import { getLevelColor, displayLevel, getPlayerRange } from '../../utils/levelUtils';

function PlayerBadge({ playerId, players, playerRange, isSelected, onToggle }) {
  const player = players.find(p => p.id === playerId);
  if (!player) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-sm transition-colors
        ${isSelected ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-white'}`}
    >
      <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${getLevelColor(player.level, playerRange)}`}>
        {displayLevel(player.level)}
      </span>
      {player.name}
      {onToggle && (
        <button
          onClick={e => { e.stopPropagation(); onToggle(); }}
          className={`w-4 h-4 flex items-center justify-center text-xs ml-0.5 shrink-0 transition-colors
            ${isSelected ? 'text-orange-400' : 'text-gray-300 hover:text-red-400'}`}
        >
          ✕
        </button>
      )}
    </span>
  );
}

function WarningBadge({ warnings }) {
  const [expanded, setExpanded] = useState(false);
  if (warnings.length === 0) return null;
  return (
    <div className="pt-1">
      <button
        onClick={() => setExpanded(v => !v)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100"
      >
        <span>⚠</span>
        <span>{warnings.length} 項重複配對</span>
        <span>{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="mt-1 space-y-0.5">
          {warnings.map((w, i) => (
            <div key={i} className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
              {w}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SuggestionPanel() {
  const { state, dispatch, suggestions, substituteInSuggestion, getSubstituteCandidates } = useGame();
  const { players } = state;
  const playerRange = getPlayerRange(players);

  const [open, setOpen] = useState(true);
  // openDropdown: { courtId, playerId } | null
  const [openDropdown, setOpenDropdown] = useState(null);

  function toggleDropdown(courtId, playerId) {
    setOpenDropdown(prev =>
      prev?.courtId === courtId && prev?.playerId === playerId
        ? null
        : { courtId, playerId }
    );
  }

  function handleSelectCandidate(candidateId) {
    if (!openDropdown) return;
    substituteInSuggestion(openDropdown.courtId, openDropdown.playerId, candidateId);
    setOpenDropdown(null);
  }

  function handleSendThreeToCourt(suggestion) {
    const removedId = openDropdown?.playerId;
    const newTeam1 = suggestion.team1.map(id => id === removedId ? null : id);
    const newTeam2 = suggestion.team2.map(id => id === removedId ? null : id);
    dispatch({
      type: 'PARTIAL_ASSIGN_TO_COURT',
      payload: { courtId: suggestion.courtId, team1: newTeam1, team2: newTeam2 },
    });
    setOpenDropdown(null);
  }

  if (suggestions.length === 0) {
    const emptyCourts = state.courts.filter(c => !c.currentGame).length;
    const waiting = state.waitingQueue.length;
    return (
      <div className="text-center py-4 text-sm text-gray-400">
        {emptyCourts === 0 ? (
          <p>所有場地都在進行中</p>
        ) : waiting < 4 ? (
          <p>等待區需要至少 4 位選手才能配對</p>
        ) : (
          <p>無法在等級限制內配對，請調整設定</p>
        )}
      </div>
    );
  }

  function handleConfirm(suggestion) {
    dispatch({
      type: 'CONFIRM_SUGGESTION',
      payload: {
        courtId: suggestion.courtId,
        team1: suggestion.team1,
        team2: suggestion.team2,
      },
    });
    setOpenDropdown(null);
  }

  function handleConfirmAll() {
    suggestions.forEach(s => handleConfirm(s));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1.5 font-semibold text-gray-800"
        >
          <span>推薦配對</span>
          <span className="text-xs text-gray-400">{open ? '▲' : '▼'}</span>
        </button>
        {open && suggestions.length > 1 && (
          <button
            onClick={handleConfirmAll}
            className="text-sm px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 min-h-[36px]"
          >
            全部確認上場
          </button>
        )}
      </div>

      {open && <div className="grid grid-cols-2 gap-2 lg:block lg:space-y-3">
      {suggestions.map(suggestion => {
        const isDropdownForThisCourt = openDropdown?.courtId === suggestion.courtId;
        const candidates = isDropdownForThisCourt
          ? getSubstituteCandidates(openDropdown.playerId)
          : [];
        const removedPlayer = isDropdownForThisCourt
          ? players.find(p => p.id === openDropdown.playerId)
          : null;

        return (
          <div
            key={suggestion.courtId}
            className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
          >
            <div className="bg-blue-600 px-3 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-white font-medium text-sm">{suggestion.courtName}</span>
              </div>
              <button
                onClick={() => handleConfirm(suggestion)}
                className="text-xs px-3 py-1 bg-white text-blue-700 rounded font-medium hover:bg-blue-50 min-h-[28px]"
              >
                確認上場
              </button>
            </div>

            <div className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-10 shrink-0">隊伍 A</span>
                <div className="flex flex-wrap gap-1">
                  {suggestion.team1.map(id => (
                    <PlayerBadge
                      key={id}
                      playerId={id}
                      players={players}
                      playerRange={playerRange}
                      isSelected={openDropdown?.playerId === id && openDropdown?.courtId === suggestion.courtId}
                      onToggle={() => toggleDropdown(suggestion.courtId, id)}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-10 text-center">VS</span>
                <div className="h-px flex-1 bg-gray-100" />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-10 shrink-0">隊伍 B</span>
                <div className="flex flex-wrap gap-1">
                  {suggestion.team2.map(id => (
                    <PlayerBadge
                      key={id}
                      playerId={id}
                      players={players}
                      playerRange={playerRange}
                      isSelected={openDropdown?.playerId === id && openDropdown?.courtId === suggestion.courtId}
                      onToggle={() => toggleDropdown(suggestion.courtId, id)}
                    />
                  ))}
                </div>
              </div>

              <WarningBadge warnings={suggestion.warnings} />

              {/* Substitute panel */}
              {isDropdownForThisCourt && (
                <div className="border border-orange-200 rounded-lg bg-orange-50 p-2 mt-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-orange-700">
                      替換 {removedPlayer?.name}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleSendThreeToCourt(suggestion)}
                        className="text-xs px-2 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 min-h-[24px]"
                      >
                        3 人先入場
                      </button>
                      <button
                        onClick={() => setOpenDropdown(null)}
                        className="text-xs px-2 py-1 text-orange-600 border border-orange-300 rounded hover:bg-orange-100 min-h-[24px]"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                  {candidates.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">等待區無可用替補</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {candidates.map(candidateId => {
                        const candidate = players.find(p => p.id === candidateId);
                        if (!candidate) return null;
                        return (
                          <button
                            key={candidateId}
                            onClick={() => handleSelectCandidate(candidateId)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-blue-200 bg-white text-sm hover:bg-blue-50 hover:border-blue-400 transition-colors"
                          >
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${getLevelColor(candidate.level, playerRange)}`}>
                              {displayLevel(candidate.level)}
                            </span>
                            {candidate.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
      </div>}
    </div>
  );
}
