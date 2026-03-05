import { createContext, useContext, useReducer, useEffect, useState, useRef } from 'react';
import { reducer, initialState } from './reducer';
import { loadState, saveState } from '../utils/storage';
import { generateSuggestions, substitutePlayerInSuggestion, getSubstituteCandidates as getCandidatesList } from '../utils/matchingAlgorithm';

function migrateState(saved) {
  return {
    ...saved,
    players: saved.players.map(p => {
      // Migrate old timeSlot format (hours) → new format (minutes from midnight)
      let timeSlot = p.timeSlot ?? null;
      if (timeSlot && timeSlot.start < 100) {
        timeSlot = { start: timeSlot.start * 60, end: timeSlot.end * 60 };
      }
      return { ...p, timeSlot };
    }),
    settings: {
      ...saved.settings,
      // Remove obsolete settings
      consecutiveLimit: undefined,
      sessionRange: undefined,
      // Default levelGapLimit to 8 (不限制) if it was the old default of 1
      levelGapLimit: saved.settings?.levelGapLimit ?? 8,
    },
  };
}

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, () => {
    const saved = loadState();
    return saved ? migrateState(saved) : initialState;
  });

  // Tap-to-assign: select a player chip then click an empty court slot
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);

  // Court assigning mode: click a court card to enter, then click waiting players
  const [assigningCourtId, setAssigningCourtId] = useState(null);
  const [assigningSlots, setAssigningSlots] = useState([null, null, null, null]);

  // Mutable suggestions override (for substitution without changing game state)
  const [suggestionsOverride, setSuggestionsOverride] = useState(null);

  // Clear overrides when underlying state changes
  useEffect(() => {
    setSuggestionsOverride(null);
  }, [state]);

  useEffect(() => {
    saveState(state);
  }, [state]);

  // Auto-manage players based on time slots (check every 30s)
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => {
    function checkTimeSlots() {
      const now = new Date();
      const cur = now.getHours() * 60 + now.getMinutes();
      const { waitingQueue, players, courts } = stateRef.current;

      const onCourtIds = new Set(
        courts.flatMap(c => c.currentGame
          ? [...c.currentGame.team1, ...c.currentGame.team2].filter(Boolean)
          : []
        )
      );

      players.forEach(player => {
        if (!player.timeSlot) return;
        const { start, end } = player.timeSlot;
        const inQueue = waitingQueue.includes(player.id);
        const onCourt = onCourtIds.has(player.id);

        // Auto-remove: in queue but past end time
        if (inQueue && cur >= end) {
          dispatch({ type: 'TOGGLE_PLAYER_ACTIVE', payload: { playerId: player.id } });
        }
        // Auto-join: not in queue, not on court, and currently within their time slot
        if (!inQueue && !onCourt && cur >= start && cur < end) {
          dispatch({ type: 'TOGGLE_PLAYER_ACTIVE', payload: { playerId: player.id } });
        }
      });
    }
    checkTimeSlots();
    const interval = setInterval(checkTimeSlots, 30000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function startAssigning(courtId) {
    setSelectedPlayerId(null);
    setAssigningCourtId(courtId);
    // Pre-populate with any players already partially assigned to this court
    const court = state.courts.find(c => c.id === courtId);
    const t1 = court?.currentGame?.team1 ?? [null, null];
    const t2 = court?.currentGame?.team2 ?? [null, null];
    setAssigningSlots([t1[0] ?? null, t1[1] ?? null, t2[0] ?? null, t2[1] ?? null]);
  }

  function clearAssigning() {
    setAssigningCourtId(null);
    setAssigningSlots([null, null, null, null]);
    setSelectedPlayerId(null);
  }

  function toggleAssigningPlayer(playerId) {
    setAssigningSlots(prev => {
      const idx = prev.indexOf(playerId);
      if (idx !== -1) {
        const next = [...prev]; next[idx] = null; return next;
      }
      const next = [...prev];
      const emptyIdx = next.indexOf(null);
      if (emptyIdx !== -1) next[emptyIdx] = playerId;
      return next;
    });
  }

  function substituteInSuggestion(courtId, playerId, substituteId = null) {
    const current = suggestionsOverride ?? generateSuggestions(state);
    const updated = substitutePlayerInSuggestion(current, courtId, playerId, state, substituteId);
    setSuggestionsOverride(updated);
  }

  function getSubstituteCandidates(playerId) {
    const current = suggestionsOverride ?? generateSuggestions(state);
    return getCandidatesList(current, playerId, state, 3);
  }

  const suggestions = suggestionsOverride ?? generateSuggestions(state);

  const value = {
    state,
    dispatch,
    suggestions,
    selectedPlayerId,
    setSelectedPlayerId,
    assigningCourtId,
    assigningSlots,
    startAssigning,
    clearAssigning,
    toggleAssigningPlayer,
    substituteInSuggestion,
    getSubstituteCandidates,
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
