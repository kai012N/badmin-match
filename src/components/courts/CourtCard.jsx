import { useDroppable } from '@dnd-kit/core';
import { useGame } from '../../store/GameContext';
import { useTimer } from '../../hooks/useTimer';
import { useState } from 'react';
import { getLevelColor, displayLevel, getPlayerRange } from '../../utils/levelUtils';

// Normal slot — supports drag-and-drop + tap-to-assign
function PlayerSlot({ courtId, teamIndex, slotIndex, playerId }) {
  const { state, dispatch, selectedPlayerId, setSelectedPlayerId, assigningCourtId } = useGame();
  const player = state.players.find(p => p.id === playerId);
  const playerRange = getPlayerRange(state.players);

  const { setNodeRef, isOver } = useDroppable({
    id: `${courtId}-team${teamIndex}-slot${slotIndex}`,
    data: { type: 'court-slot', courtId, teamIndex, slotIndex },
  });

  function handleRemove(e) {
    e.stopPropagation();
    if (playerId) {
      dispatch({ type: 'REMOVE_PLAYER_FROM_COURT', payload: { playerId, courtId } });
    }
  }

  function handleClick(e) {
    e.stopPropagation();
    if (!player && !assigningCourtId && selectedPlayerId) {
      dispatch({
        type: 'ASSIGN_PLAYER_TO_COURT',
        payload: { playerId: selectedPlayerId, courtId, teamIndex, slotIndex },
      });
      setSelectedPlayerId(null);
    }
  }

  const isTargetSlot = !player && !assigningCourtId && !!selectedPlayerId;

  return (
    <div
      ref={setNodeRef}
      onClick={handleClick}
      className={`
        flex items-center gap-1.5 px-2 py-2 rounded-lg border min-h-[44px] text-sm transition-colors
        ${isOver ? 'border-blue-400 bg-blue-50' : ''}
        ${isTargetSlot && !isOver ? 'border-2 border-blue-400 bg-blue-50 cursor-pointer' : ''}
        ${!isOver && !isTargetSlot && !player ? 'border-dashed border-gray-300 bg-gray-50' : ''}
        ${player ? 'border border-gray-200 bg-white' : ''}
      `}
    >
      {player ? (
        <>
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${getLevelColor(player.level, playerRange)} shrink-0`}>
            {displayLevel(player.level)}
          </span>
          <span className="truncate flex-1 font-medium">{player.name}</span>
          <button
            onClick={handleRemove}
            className="text-gray-300 hover:text-red-400 shrink-0 w-5 h-5 flex items-center justify-center"
          >
            ✕
          </button>
        </>
      ) : (
        <span className={`text-sm ${isTargetSlot ? 'text-blue-400' : 'text-gray-300'}`}>
          {isTargetSlot ? '點此指派' : '空位'}
        </span>
      )}
    </div>
  );
}

// Assigning-mode slot — shows temp selection, click × to remove
function AssigningSlot({ slotIndex, playerId }) {
  const { state, toggleAssigningPlayer } = useGame();
  const player = state.players.find(p => p.id === playerId);
  const playerRange = getPlayerRange(state.players);

  return (
    <div
      className={`
        flex items-center gap-2 px-3 py-2.5 rounded-lg border min-h-[52px] text-base
        ${player ? 'border border-gray-200 bg-white' : 'border-2 border-dashed border-blue-300 bg-blue-50'}
      `}
    >
      {player ? (
        <>
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${getLevelColor(player.level, playerRange)} shrink-0`}>
            {displayLevel(player.level)}
          </span>
          <span className="truncate flex-1 font-medium">{player.name}</span>
          <button
            onClick={e => { e.stopPropagation(); toggleAssigningPlayer(player.id); }}
            className="text-gray-300 hover:text-red-400 shrink-0 w-5 h-5 flex items-center justify-center"
          >
            ✕
          </button>
        </>
      ) : (
        <span className="text-blue-300 text-sm">點下方選手指派</span>
      )}
    </div>
  );
}

export function CourtCard({ court }) {
  const { state, dispatch, assigningCourtId, assigningSlots, startAssigning, clearAssigning } = useGame();
  const { display } = useTimer(court.currentGame?.startTime ?? null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(court.name);

  const isAssigning = assigningCourtId === court.id;
  const hasGame = !!court.currentGame;
  const team1 = court.currentGame?.team1 ?? [null, null];
  const team2 = court.currentGame?.team2 ?? [null, null];
  const allFilled = hasGame && team1.every(Boolean) && team2.every(Boolean);
  const assignAllFilled = assigningSlots.every(s => s !== null);

  function handleEndGame(e) {
    e.stopPropagation();
    dispatch({ type: 'END_GAME', payload: { courtId: court.id } });
  }

  function handleRenameSave(e) {
    e?.stopPropagation?.();
    if (nameInput.trim()) {
      dispatch({ type: 'RENAME_COURT', payload: { courtId: court.id, name: nameInput.trim() } });
    }
    setEditingName(false);
  }

  function handleCardClick(e) {
    e.stopPropagation();
    if (editingName) return;
    if (isAssigning) return;
    if (allFilled) return; // active full game — don't enter assigning
    startAssigning(court.id);
  }

  function handleConfirmAssigning(e) {
    e.stopPropagation();
    if (!assignAllFilled) return;
    dispatch({
      type: 'START_GAME',
      payload: {
        courtId: court.id,
        team1: [assigningSlots[0], assigningSlots[1]],
        team2: [assigningSlots[2], assigningSlots[3]],
      },
    });
    clearAssigning();
  }

  function handleCancelAssigning(e) {
    e.stopPropagation();
    clearAssigning();
  }

  const headerBg = isAssigning
    ? 'bg-blue-500'
    : hasGame && allFilled ? 'bg-green-500' : 'bg-gray-700';

  const cardBorder = isAssigning
    ? 'border-blue-400 shadow-md shadow-blue-100'
    : hasGame && allFilled ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white';

  return (
    <div
      onClick={handleCardClick}
      className={`
        rounded-xl border-2 shadow-sm overflow-hidden transition-all
        ${cardBorder}
        ${!allFilled && !isAssigning ? 'cursor-pointer hover:border-blue-300' : ''}
        ${isAssigning ? 'bg-white' : ''}
      `}
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 ${headerBg}`}>
        <div className="flex items-center gap-2">
          {editingName ? (
            <input
              autoFocus
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onBlur={handleRenameSave}
              onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') handleRenameSave(); }}
              onClick={e => e.stopPropagation()}
              className="text-sm font-bold bg-transparent text-white border-b border-white outline-none w-20"
            />
          ) : (
            <button
              onClick={e => { e.stopPropagation(); setEditingName(true); }}
              className="text-base font-bold text-white hover:text-gray-200"
            >
              {court.name}
            </button>
          )}
          {!isAssigning && hasGame && allFilled && (
            <span className="text-white text-sm font-mono">{display}</span>
          )}
          {isAssigning && (
            <span className="text-white text-xs opacity-80">指派模式</span>
          )}
        </div>

        <div className="flex gap-1.5 items-center">
          {isAssigning && (
            <>
              {assignAllFilled && (
                <button
                  onClick={handleConfirmAssigning}
                  className="text-xs px-2 py-1 bg-white text-blue-700 rounded font-medium hover:bg-blue-50 min-h-[28px]"
                >
                  確認上場
                </button>
              )}
              <button
                onClick={handleCancelAssigning}
                className="text-xs px-2 py-1 bg-blue-400 text-white rounded hover:bg-blue-300 min-h-[28px]"
              >
                取消
              </button>
            </>
          )}
          {!isAssigning && hasGame && allFilled && (
            <button
              onClick={handleEndGame}
              className="text-xs px-2 py-1 bg-white text-green-700 rounded font-medium hover:bg-green-100 min-h-[28px]"
            >
              結束本局
            </button>
          )}
          {!isAssigning && !hasGame && (
            <span className="text-xs text-gray-300">空場</span>
          )}
        </div>
      </div>

      {/* Teams — vertical on mobile (<576), horizontal on sm+ */}
      <div className="flex flex-col p-2 gap-1.5 sm:flex-row sm:items-stretch sm:p-3 sm:gap-2">
        {/* Team A */}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-gray-400 mb-1 text-center sm:mb-1.5">隊 A</div>
          <div className="space-y-1 sm:space-y-1.5">
            {[0, 1].map(i =>
              isAssigning ? (
                <AssigningSlot key={i} slotIndex={i} playerId={assigningSlots[i]} />
              ) : (
                <PlayerSlot key={i} courtId={court.id} teamIndex={0} slotIndex={i} playerId={team1[i]} />
              )
            )}
          </div>
        </div>

        {/* VS divider — horizontal line on mobile (<576), vertical on sm+ */}
        <div className="flex items-center gap-1.5 sm:flex-col sm:shrink-0 sm:px-1 sm:gap-0">
          <div className="flex-1 h-px bg-gray-200 sm:h-auto sm:w-px" />
          <span className="text-xs font-bold text-gray-400 sm:py-1.5">VS</span>
          <div className="flex-1 h-px bg-gray-200 sm:h-auto sm:w-px" />
        </div>

        {/* Team B */}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-gray-400 mb-1 text-center sm:mb-1.5">隊 B</div>
          <div className="space-y-1 sm:space-y-1.5">
            {[0, 1].map(i =>
              isAssigning ? (
                <AssigningSlot key={i} slotIndex={2 + i} playerId={assigningSlots[2 + i]} />
              ) : (
                <PlayerSlot key={i} courtId={court.id} teamIndex={1} slotIndex={i} playerId={team2[i]} />
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
