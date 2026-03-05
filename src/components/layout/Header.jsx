import { useGame } from '../../store/GameContext';

export function Header({ onOpenPlayers, onOpenSettings, onOpenTutorial }) {
  const { state, dispatch } = useGame();
  const activeCourts = state.courts.filter(c => c.currentGame).length;
  const waiting = state.waitingQueue.length;
  const showHistory = state.settings.showHistory;

  function toggleHistory() {
    dispatch({ type: 'UPDATE_SETTINGS', payload: { showHistory: !showHistory } });
  }

  return (
    <header className="bg-gray-800 text-white px-4 py-3 flex items-center justify-between shadow-md gap-2">
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xl">🏸</span>
        <h1 className="font-bold text-base">羽球排場管理</h1>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span>
          <span>{activeCourts} 場進行中</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block"></span>
          <span>{waiting} 人等待</span>
        </div>

        {/* History toggle */}
        <button
          onClick={toggleHistory}
          className={`ml-1 hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors
            ${showHistory
              ? 'bg-blue-500 border-blue-400 text-white'
              : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
            }`}
        >
          <span>📊</span>
          <span className="hidden sm:inline">對戰紀錄</span>
          <span className={`w-1.5 h-1.5 rounded-full inline-block ${showHistory ? 'bg-green-300' : 'bg-gray-500'}`}></span>
        </button>

        {/* Desktop-only management buttons */}
        <button
          data-tutorial="players-btn"
          onClick={onOpenPlayers}
          className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600 text-xs font-medium transition-colors"
        >
          👥 選手名單
        </button>
        <button
          data-tutorial="settings-btn"
          onClick={onOpenSettings}
          className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600 text-xs font-medium transition-colors"
        >
          ⚙ 系統設定
        </button>

        {/* Tutorial help button */}
        <button
          onClick={onOpenTutorial}
          title="使用教學"
          className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600 text-xs font-bold transition-colors"
        >
          ?
        </button>
      </div>
    </header>
  );
}
