import { v4 as uuidv4 } from 'uuid';

export const initialState = {
  players: [],
  courts: [
    { id: 'court-1', name: '1號場', currentGame: null },
    { id: 'court-2', name: '2號場', currentGame: null },
  ],
  waitingQueue: [],
  settings: {
    courtCount: 2,
    levelGapLimit: 8,
    showHistory: false,
  },
  history: [],
  pairRules: {
    forceTeams: [],  // [{ playerA: id, playerB: id }]，每位選手至多出現一次
    avoidGame: [],   // [{ playerA: id, playerB: id }]，多對多
  },
};

function buildCourts(count, existingCourts) {
  const courts = [];
  for (let i = 1; i <= count; i++) {
    const id = `court-${i}`;
    const existing = existingCourts.find(c => c.id === id);
    courts.push(existing || { id, name: `${i}號場`, currentGame: null });
  }
  return courts;
}

export function reducer(state, action) {
  switch (action.type) {

    case 'ADD_PLAYER': {
      const player = {
        id: uuidv4(),
        name: action.payload.name,
        level: action.payload.level,
        timeSlot: action.payload.timeSlot ?? null,  // { start, end } minutes-from-midnight
        gamesPlayed: 0,
        waitCount: 0,
        partnerHistory: {},
        opponentHistory: {},
        lastPartners: [],
        lastOpponents: [],
      };
      // If player has a time slot, only add to waiting queue if currently active
      const now = new Date();
      const cur = now.getHours() * 60 + now.getMinutes();
      const ts = player.timeSlot;
      const shouldQueue = !ts || (cur >= ts.start && cur < ts.end);
      return {
        ...state,
        players: [...state.players, player],
        waitingQueue: shouldQueue ? [...state.waitingQueue, player.id] : state.waitingQueue,
      };
    }

    case 'UPDATE_PLAYER': {
      return {
        ...state,
        players: state.players.map(p =>
          p.id === action.payload.id
            ? { ...p, name: action.payload.name, level: action.payload.level, timeSlot: action.payload.timeSlot ?? null }
            : p
        ),
      };
    }

    case 'REMOVE_PLAYER': {
      const id = action.payload.id;
      // Remove from courts too
      const courts = state.courts.map(court => {
        if (!court.currentGame) return court;
        const { team1, team2 } = court.currentGame;
        if (team1.includes(id) || team2.includes(id)) {
          return { ...court, currentGame: null };
        }
        return court;
      });
      const pairRules = {
        forceTeams: (state.pairRules?.forceTeams ?? []).filter(r => r.playerA !== id && r.playerB !== id),
        avoidGame: (state.pairRules?.avoidGame ?? []).filter(r => r.playerA !== id && r.playerB !== id),
      };
      return {
        ...state,
        players: state.players.filter(p => p.id !== id),
        waitingQueue: state.waitingQueue.filter(pid => pid !== id),
        courts,
        pairRules,
      };
    }

    case 'SET_FORCE_TEAM': {
      const { playerA, playerB } = action.payload;
      const forceTeams = (state.pairRules?.forceTeams ?? []).filter(
        r => r.playerA !== playerA && r.playerB !== playerA &&
             r.playerA !== playerB && r.playerB !== playerB
      );
      return {
        ...state,
        pairRules: {
          ...state.pairRules,
          forceTeams: [...forceTeams, { playerA, playerB }],
        },
      };
    }

    case 'REMOVE_FORCE_TEAM': {
      const { playerId } = action.payload;
      const forceTeams = (state.pairRules?.forceTeams ?? []).filter(
        r => r.playerA !== playerId && r.playerB !== playerId
      );
      return {
        ...state,
        pairRules: { ...state.pairRules, forceTeams },
      };
    }

    case 'ADD_AVOID_GAME': {
      const { playerA, playerB } = action.payload;
      const existing = state.pairRules?.avoidGame ?? [];
      const alreadyExists = existing.some(
        r => (r.playerA === playerA && r.playerB === playerB) ||
             (r.playerA === playerB && r.playerB === playerA)
      );
      if (alreadyExists) return state;
      return {
        ...state,
        pairRules: {
          ...state.pairRules,
          avoidGame: [...existing, { playerA, playerB }],
        },
      };
    }

    case 'REMOVE_AVOID_GAME': {
      const { playerA, playerB } = action.payload;
      const avoidGame = (state.pairRules?.avoidGame ?? []).filter(
        r => !((r.playerA === playerA && r.playerB === playerB) ||
               (r.playerA === playerB && r.playerB === playerA))
      );
      return {
        ...state,
        pairRules: { ...state.pairRules, avoidGame },
      };
    }

    case 'START_GAME': {
      const { courtId, team1, team2 } = action.payload;
      const startTime = Date.now();

      // Players already partially assigned to this court (may not be in waitingQueue)
      const prevCourt = state.courts.find(c => c.id === courtId);
      const prevPlayers = prevCourt?.currentGame
        ? [...prevCourt.currentGame.team1, ...prevCourt.currentGame.team2].filter(Boolean)
        : [];

      const courts = state.courts.map(court =>
        court.id === courtId
          ? { ...court, currentGame: { team1, team2, startTime } }
          : court
      );

      // Remove new players from waitingQueue
      const allPlayers = [...team1, ...team2].filter(Boolean);
      let waitingQueue = state.waitingQueue.filter(id => !allPlayers.includes(id));

      // Return any displaced partial-game players back to queue
      const displaced = prevPlayers.filter(id => !allPlayers.includes(id));
      displaced.forEach(id => {
        if (!waitingQueue.includes(id)) waitingQueue.push(id);
      });

      // Increment waitCount for players still waiting
      const players = state.players.map(p => {
        if (waitingQueue.includes(p.id)) {
          return { ...p, waitCount: p.waitCount + 1 };
        }
        if (allPlayers.includes(p.id)) {
          return { ...p, waitCount: 0 };
        }
        return p;
      });

      return { ...state, courts, waitingQueue, players };
    }

    case 'END_GAME': {
      const { courtId } = action.payload;
      const court = state.courts.find(c => c.id === courtId);
      if (!court?.currentGame) return state;

      const { team1, team2 } = court.currentGame;
      const allPlayers = [...team1, ...team2];

      const historyEntry = {
        id: uuidv4(),
        courtId,
        team1,
        team2,
        startTime: court.currentGame.startTime ?? null,
        endTime: Date.now(),
      };

      const players = state.players.map(p => {
        if (!allPlayers.includes(p.id)) return p;

        const isTeam1 = team1.includes(p.id);
        const myTeam = isTeam1 ? team1 : team2;
        const oppTeam = isTeam1 ? team2 : team1;

        const partnerHistory = { ...p.partnerHistory };
        myTeam.filter(id => id !== p.id).forEach(id => {
          partnerHistory[id] = (partnerHistory[id] || 0) + 1;
        });

        const opponentHistory = { ...p.opponentHistory };
        oppTeam.forEach(id => {
          opponentHistory[id] = (opponentHistory[id] || 0) + 1;
        });

        return {
          ...p,
          gamesPlayed: p.gamesPlayed + 1,
          partnerHistory,
          opponentHistory,
          lastPartners: myTeam.filter(id => id !== p.id),
          lastOpponents: oppTeam,
        };
      });

      // Add players back to waiting queue (maintain order by waitCount)
      // Place them at end of current queue
      const courts = state.courts.map(c =>
        c.id === courtId ? { ...c, currentGame: null } : c
      );

      const waitingQueue = [
        ...state.waitingQueue,
        ...allPlayers,
      ];

      return {
        ...state,
        courts,
        players,
        waitingQueue,
        history: [...state.history, historyEntry],
      };
    }

    case 'MOVE_TO_COURT': {
      // Manually move a player from waiting queue to an empty court slot
      const { playerId, courtId, slot } = action.payload;
      // This is handled via drag-and-drop; update court's pending assignment
      return state;
    }

    case 'MOVE_PLAYER_IN_QUEUE': {
      // Reorder waiting queue via drag-and-drop
      const { fromIndex, toIndex } = action.payload;
      const queue = [...state.waitingQueue];
      const [moved] = queue.splice(fromIndex, 1);
      queue.splice(toIndex, 0, moved);
      return { ...state, waitingQueue: queue };
    }

    case 'ASSIGN_PLAYER_TO_COURT': {
      // Assign a specific player to a court slot (drag from queue to court)
      const { playerId, courtId, teamIndex, slotIndex } = action.payload;
      const court = state.courts.find(c => c.id === courtId);
      if (!court) return state;

      let currentGame = court.currentGame || {
        team1: [null, null],
        team2: [null, null],
        startTime: null,
      };

      // Remove player from wherever they are currently in this court
      const newTeam1 = currentGame.team1.map(id => id === playerId ? null : id);
      const newTeam2 = currentGame.team2.map(id => id === playerId ? null : id);

      if (teamIndex === 0) {
        newTeam1[slotIndex] = playerId;
      } else {
        newTeam2[slotIndex] = playerId;
      }

      // Auto-start when all 4 slots are filled
      const allFilled = newTeam1.every(Boolean) && newTeam2.every(Boolean);
      const startTime = allFilled && !currentGame.startTime ? Date.now() : currentGame.startTime;

      const updatedGame = { team1: newTeam1, team2: newTeam2, startTime };
      const courts = state.courts.map(c =>
        c.id === courtId ? { ...c, currentGame: updatedGame } : c
      );

      let waitingQueue = state.waitingQueue.filter(id => id !== playerId);

      // If auto-started, update player stats for all 4
      let players = state.players;
      if (allFilled && !currentGame.startTime) {
        const allPlayers = [...newTeam1, ...newTeam2];
        players = state.players.map(p => {
          if (waitingQueue.includes(p.id)) {
            return { ...p, waitCount: p.waitCount + 1 };
          }
          if (allPlayers.includes(p.id)) {
            return { ...p, waitCount: 0 };
          }
          return p;
        });
      }

      return { ...state, courts, waitingQueue, players };
    }

    case 'REMOVE_PLAYER_FROM_COURT': {
      const { playerId, courtId } = action.payload;
      const court = state.courts.find(c => c.id === courtId);
      if (!court?.currentGame) return state;

      const newTeam1 = court.currentGame.team1.map(id => id === playerId ? null : id);
      const newTeam2 = court.currentGame.team2.map(id => id === playerId ? null : id);

      const allNull1 = newTeam1.every(id => id === null);
      const allNull2 = newTeam2.every(id => id === null);
      const currentGame = (allNull1 && allNull2)
        ? null
        : { ...court.currentGame, team1: newTeam1, team2: newTeam2 };

      const courts = state.courts.map(c =>
        c.id === courtId ? { ...c, currentGame } : c
      );

      // Add player back to waiting queue if not already there
      const waitingQueue = state.waitingQueue.includes(playerId)
        ? state.waitingQueue
        : [...state.waitingQueue, playerId];

      return { ...state, courts, waitingQueue };
    }

    case 'PARTIAL_ASSIGN_TO_COURT': {
      // Pre-fill a court with fewer than 4 players (some slots may be null)
      const { courtId, team1, team2 } = action.payload;
      const allPlayers = [...team1, ...team2].filter(Boolean);
      const courts = state.courts.map(c =>
        c.id === courtId
          ? { ...c, currentGame: { team1, team2, startTime: null } }
          : c
      );
      const waitingQueue = state.waitingQueue.filter(id => !allPlayers.includes(id));
      return { ...state, courts, waitingQueue };
    }

    case 'CONFIRM_SUGGESTION': {
      const { courtId, team1, team2 } = action.payload;
      return reducer(state, { type: 'START_GAME', payload: { courtId, team1, team2 } });
    }

    case 'UPDATE_SETTINGS': {
      const newSettings = { ...state.settings, ...action.payload };
      const courts = buildCourts(newSettings.courtCount, state.courts);

      // Players on removed courts go back to queue
      const removedCourts = state.courts.filter(
        c => !courts.find(nc => nc.id === c.id)
      );
      let waitingQueue = [...state.waitingQueue];
      for (const court of removedCourts) {
        if (court.currentGame) {
          const { team1, team2 } = court.currentGame;
          [...team1, ...team2].filter(Boolean).forEach(id => {
            if (!waitingQueue.includes(id)) waitingQueue.push(id);
          });
        }
      }

      return { ...state, settings: newSettings, courts, waitingQueue };
    }

    case 'RENAME_COURT': {
      const { courtId, name } = action.payload;
      return {
        ...state,
        courts: state.courts.map(c =>
          c.id === courtId ? { ...c, name } : c
        ),
      };
    }

    case 'TOGGLE_PLAYER_ACTIVE': {
      // Move player between queue and bench (sitting out)
      const { playerId } = action.payload;
      const inQueue = state.waitingQueue.includes(playerId);
      const waitingQueue = inQueue
        ? state.waitingQueue.filter(id => id !== playerId)
        : [...state.waitingQueue, playerId];
      // Reset waitCount when returning from voluntary rest — resting ≠ waiting
      const players = !inQueue
        ? state.players.map(p => p.id === playerId ? { ...p, waitCount: 0 } : p)
        : state.players;
      return { ...state, waitingQueue, players };
    }

    case 'LOAD_STATE': {
      return action.payload;
    }

    default:
      return state;
  }
}
