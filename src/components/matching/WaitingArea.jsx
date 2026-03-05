import { useDraggable } from '@dnd-kit/core';
import { useState, useEffect } from 'react';
import { useGame } from '../../store/GameContext';
import { PlayerCard } from '../players/PlayerCard';
import { getLevelColor, displayLevel, getPlayerRange } from '../../utils/levelUtils';
import { fmtTime, timeSlotStatus } from '../players/PlayerList';

function useCurrentMinutes() {
  const getNow = () => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  };
  const [cur, setCur] = useState(getNow);
  useEffect(() => {
    const id = setInterval(() => setCur(getNow()), 30000);
    return () => clearInterval(id);
  }, []);
  return cur;
}

function fmtHHMM(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

// Calculate estimated wait rounds for a player at queue position `pos`
// Each round: courtCount courts × 4 players = courtCount*4 spots
// Empty courts can absorb the first batch immediately
function calcWaitRounds(posIndex, emptyCourts, courtCount) {
  const immediateSlots = emptyCourts * 4;
  if (posIndex < immediateSlots) return 0;
  const remaining = posIndex - immediateSlots;
  return Math.ceil((remaining + 1) / (courtCount * 4));
}

function waitBadge(rounds) {
  if (rounds === 0) return { label: '即將', cls: 'bg-green-100 text-green-700 border-green-300' };
  if (rounds === 1) return { label: '等1局', cls: 'bg-yellow-100 text-yellow-700 border-yellow-300' };
  return { label: `等${rounds}局`, cls: 'bg-red-100 text-red-600 border-red-300' };
}

// Compact chip — draggable + supports both tap-to-assign and assigning-mode
function DraggableChip({ player, isSelected, isInAssigning, onClick, sessionRange, waitRounds }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: player.id,
    data: { type: 'player', playerId: player.id },
  });

  const badge = waitBadge(waitRounds);

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`
        inline-flex items-center gap-1 px-2 py-1 rounded-full border text-sm
        select-none transition-colors
        ${isDragging ? 'opacity-40' : 'cursor-grab active:cursor-grabbing'}
        ${getLevelColor(player.level, sessionRange, true)}
        ${isInAssigning ? 'ring-2 ring-offset-1 ring-green-500 font-medium' : ''}
        ${isSelected && !isInAssigning ? 'ring-2 ring-offset-1 ring-blue-500 font-medium' : ''}
      `}
    >
      <span className="font-bold text-xs">{displayLevel(player.level)}</span>
      <span>{player.name}</span>
      <span className={`text-xs px-1 rounded border ${badge.cls}`}>{badge.label}</span>
    </button>
  );
}

export function WaitingArea({ compact = false }) {
  const {
    state, dispatch,
    selectedPlayerId, setSelectedPlayerId,
    assigningCourtId, assigningSlots, toggleAssigningPlayer,
    clearAssigning,
  } = useGame();
  const { players, waitingQueue, courts, settings } = state;
  const playerRange = getPlayerRange(players);
  const courtCount = settings.courtCount;
  const emptyCourts = courts.filter(c => !c.currentGame).length;

  const waitingPlayers = waitingQueue
    .map(id => players.find(p => p.id === id))
    .filter(Boolean);

  const playingIds = new Set(
    courts.flatMap(c => c.currentGame
      ? [...c.currentGame.team1, ...c.currentGame.team2].filter(Boolean)
      : []
    )
  );

  const sittingOut = players.filter(
    p => !waitingQueue.includes(p.id) && !playingIds.has(p.id)
  );

  const curMinutes = useCurrentMinutes();

  if (compact) {
    if (waitingPlayers.length === 0 && sittingOut.length === 0) return null;

    return (
      <div onClick={clearAssigning} className="space-y-2">
        {waitingPlayers.length > 0 && (
          <div>
            <div className="text-xs text-gray-500 mb-1.5 font-medium">
              等待上場 ({waitingPlayers.length})
              {assigningCourtId && (
                <span className="ml-2 text-blue-500">← 點選手加入指派</span>
              )}
              {!assigningCourtId && (
                <span className="ml-2 text-gray-400 font-normal">可拖曳或點選後指派</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto p-1">
              {waitingPlayers.map((player, posIndex) => {
                const isInAssigning = assigningSlots.includes(player.id);
                const isSelected = selectedPlayerId === player.id;
                const waitRounds = calcWaitRounds(posIndex, emptyCourts, courtCount);
                return (
                  <DraggableChip
                    key={player.id}
                    player={player}
                    isSelected={isSelected}
                    isInAssigning={isInAssigning}
                    sessionRange={playerRange}
                    waitRounds={waitRounds}
                    onClick={e => {
                      e.stopPropagation();
                      if (assigningCourtId) {
                        toggleAssigningPlayer(player.id);
                      } else {
                        setSelectedPlayerId(isSelected ? null : player.id);
                      }
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {sittingOut.length > 0 && (
          <SittingOutSection players={sittingOut} dispatch={dispatch} curMinutes={curMinutes} />
        )}
      </div>
    );
  }

  // Full mode (desktop center column) — also uses chips
  return (
    <div onClick={clearAssigning} className="space-y-3">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-gray-800">等待區 ({waitingPlayers.length})</h2>
          {assigningCourtId ? (
            <span className="text-xs text-blue-500">點選手加入指派</span>
          ) : (
            <span className="text-xs text-gray-400">拖曳或點選後指派</span>
          )}
        </div>

        {waitingPlayers.length === 0 ? (
          <div className="text-center py-6 text-gray-300 text-sm border-2 border-dashed border-gray-200 rounded-xl">
            無等待選手
          </div>
        ) : (
          <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto p-1">
            {waitingPlayers.map((player, posIndex) => {
              const isInAssigning = assigningSlots.includes(player.id);
              const isSelected = selectedPlayerId === player.id;
              const waitRounds = calcWaitRounds(posIndex, emptyCourts, courtCount);
              return (
                <DraggableChip
                  key={player.id}
                  player={player}
                  isSelected={isSelected}
                  isInAssigning={isInAssigning}
                  sessionRange={playerRange}
                  waitRounds={waitRounds}
                  onClick={e => {
                    e.stopPropagation();
                    if (assigningCourtId) {
                      toggleAssigningPlayer(player.id);
                    } else {
                      setSelectedPlayerId(isSelected ? null : player.id);
                    }
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      {sittingOut.length > 0 && (
        <SittingOutSection players={sittingOut} dispatch={dispatch} curMinutes={curMinutes} />
      )}
    </div>
  );
}

function SittingOutSection({ players, dispatch, curMinutes }) {
  const [open, setOpen] = useState(false);
  const pending = players.filter(p => timeSlotStatus(p.timeSlot) === 'pending');
  const resting = players.filter(p => timeSlotStatus(p.timeSlot) !== 'pending');

  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs text-gray-500 font-medium w-full text-left"
      >
        <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
        <span>場外選手 ({players.length})</span>
        {pending.length > 0 && (
          <span className="text-blue-400">⏰ {pending.length} 待進場</span>
        )}
        <span className="ml-auto text-gray-400 font-normal">現在 {fmtHHMM(curMinutes)}</span>
      </button>

      {open && (
        <div className="space-y-2 max-h-40 overflow-y-auto p-1">
          {pending.length > 0 && (
            <div>
              <div className="text-xs text-blue-400 font-medium mb-1">待進場</div>
              <div className="flex flex-wrap gap-1.5">
                {pending.map(player => (
                  <div
                    key={player.id}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-blue-200 bg-blue-50 text-blue-600 text-xs"
                    title={`將於 ${fmtHHMM(player.timeSlot.start)} 自動進場`}
                  >
                    <span>⏰</span>
                    <span>{player.name}</span>
                    <span className="text-blue-400">{fmtHHMM(player.timeSlot.start)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {resting.length > 0 && (
            <div>
              <div className="text-xs text-gray-400 font-medium mb-1">休息中</div>
              <div className="flex flex-wrap gap-1.5">
                {resting.map(player => (
                  <button
                    key={player.id}
                    onClick={() => dispatch({ type: 'TOGGLE_PLAYER_ACTIVE', payload: { playerId: player.id } })}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-gray-200 bg-gray-100 text-gray-400 text-sm hover:bg-gray-200 min-h-[32px]"
                    title="點擊加回等待區"
                  >
                    <span>{player.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
