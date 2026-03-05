import { useState, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';

import { GameProvider, useGame } from './store/GameContext';
import { Header } from './components/layout/Header';
import { TabBar } from './components/layout/TabBar';
import { TutorialModal } from './components/layout/TutorialModal';
import { CourtList } from './components/courts/CourtList';
import { CourtPageView } from './components/courts/CourtPageView';
import { WaitingArea } from './components/matching/WaitingArea';
import { SuggestionPanel } from './components/matching/SuggestionPanel';
import { PlayerList } from './components/players/PlayerList';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { HistoryPanel } from './components/history/HistoryPanel';
import { PlayerCard } from './components/players/PlayerCard';

function SimpleModal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 shrink-0">
          <span className="font-semibold text-gray-800">{title}</span>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 text-lg leading-none"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {children}
        </div>
      </div>
    </div>
  );
}

function AppInner() {
  const { state, dispatch, clearAssigning } = useGame();
  const [activeTab, setActiveTab] = useState('courts');
  const [draggedPlayer, setDraggedPlayer] = useState(null);
  const [playersOpen, setPlayersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(() => {
    return !localStorage.getItem('tutorial-seen');
  });
  const [installPrompt, setInstallPrompt] = useState(null);

  useEffect(() => {
    function handler(e) {
      e.preventDefault();
      setInstallPrompt(e);
    }
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function closeTutorial() {
    localStorage.setItem('tutorial-seen', '1');
    setTutorialOpen(false);
  }


  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    })
  );

  function handleDragStart(event) {
    const { active } = event;
    if (active.data.current?.type === 'player') {
      const player = state.players.find(p => p.id === active.data.current.playerId);
      setDraggedPlayer(player);
    }
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    setDraggedPlayer(null);
    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    if (activeData?.type === 'player' && overData?.type === 'court-slot') {
      const { courtId, teamIndex, slotIndex } = overData;
      dispatch({
        type: 'ASSIGN_PLAYER_TO_COURT',
        payload: { playerId: activeData.playerId, courtId, teamIndex, slotIndex },
      });
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="h-screen bg-gray-100 flex flex-col overflow-hidden">
        <Header
          onOpenPlayers={() => setPlayersOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenTutorial={() => setTutorialOpen(true)}
        />

        {/* Desktop layout: fills remaining height, no page scroll */}
        <div
          className="hidden lg:flex flex-1 min-h-0 gap-3 p-4"
          onClick={clearAssigning}
        >
          {/* Left column: courts scroll, waiting pinned at bottom */}
          <div
            className="flex flex-col flex-1 min-w-0 min-h-0 gap-3"
            onClick={clearAssigning}
          >
            {/* Courts — scrolls independently */}
            <div data-tutorial="court-area" className="flex-1 overflow-y-auto min-h-0 pr-1">
              <CourtList />
            </div>

            {/* Waiting area — pinned at bottom of court column */}
            <div className="shrink-0 bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
              <WaitingArea />
            </div>
          </div>

          {/* Right panel — suggestion + history */}
          <div
            className="shrink-0 w-80 flex flex-col min-h-0 gap-3"
            onClick={clearAssigning}
          >
            <div data-tutorial="suggestions" className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1">
              <SuggestionPanel />
              {state.settings.showHistory && (
                <div className="border-t border-gray-100 pt-4">
                  <HistoryPanel />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile/Tablet layout — pb-14 reserves space for fixed TabBar (56px) */}
        <div className="lg:hidden flex-1 flex flex-col min-h-0 pb-14">
          {/* Scrollable page content */}
          <div className="flex-1 overflow-y-auto p-3 overscroll-none">
            {activeTab === 'courts' && <CourtPageView />}
            {activeTab === 'players' && <PlayerList />}
            {activeTab === 'settings' && (
              <>
                <SettingsPanel />
                <div className="mt-3 border-t border-gray-200 pt-3">
                  <HistoryPanel />
                </div>
              </>
            )}
          </div>

          {/* Waiting area sits just above the TabBar gap */}
          {activeTab === 'courts' && (
            <div className="shrink-0 bg-white border-t border-gray-200 px-3 py-2" onClick={clearAssigning}>
              <WaitingArea compact />
            </div>
          )}
        </div>

        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      <TutorialModal open={tutorialOpen} onClose={closeTutorial} installPrompt={installPrompt} />
      <SimpleModal open={playersOpen} onClose={() => setPlayersOpen(false)} title="選手名單">
        <PlayerList />
      </SimpleModal>
      <SimpleModal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="系統設定">
        <SettingsPanel />
      </SimpleModal>

      <DragOverlay dropAnimation={null}>
        {draggedPlayer && <PlayerCard player={draggedPlayer} overlay />}
      </DragOverlay>
    </DndContext>
  );
}

export default function App() {
  return (
    <GameProvider>
      <AppInner />
    </GameProvider>
  );
}
