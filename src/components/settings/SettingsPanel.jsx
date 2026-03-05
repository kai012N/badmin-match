import { useState } from 'react';
import { useGame } from '../../store/GameContext';

const PRESET_COURTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function SettingsPanel() {
  const { state, dispatch } = useGame();
  const { settings } = state;
  const [customCourt, setCustomCourt] = useState('');
  const isCustom = !PRESET_COURTS.includes(settings.courtCount);

  function update(key, value) {
    dispatch({ type: 'UPDATE_SETTINGS', payload: { [key]: value } });
  }

  function handleCustomCourt(e) {
    const raw = e.target.value.replace(/\D/g, '');
    setCustomCourt(raw);
    const n = parseInt(raw, 10);
    if (n >= 1 && n <= 99) update('courtCount', n);
  }

  return (
    <div className="space-y-4">
      {/* Court count + Level gap + Consecutive limit */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            場地數量：{settings.courtCount} 個
          </label>
          <div className="grid grid-cols-6 gap-1.5">
            {PRESET_COURTS.map(n => (
              <button
                key={n}
                onClick={() => { update('courtCount', n); setCustomCourt(''); }}
                className={`py-2 rounded-lg text-sm font-medium border min-h-[40px] transition-colors
                  ${settings.courtCount === n && !isCustom
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-gray-500 shrink-0">自定義：</span>
            <input
              type="text"
              inputMode="numeric"
              value={isCustom ? String(settings.courtCount) : customCourt}
              onChange={handleCustomCourt}
              placeholder="13–99"
              className={`w-20 px-2 py-1.5 border rounded-lg text-sm text-center outline-none transition-colors min-h-[36px]
                ${isCustom ? 'border-blue-500 ring-1 ring-blue-300' : 'border-gray-300 focus:border-blue-400'}`}
            />
            <span className="text-xs text-gray-400">（最多 99 面）</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            等級差限制
          </label>
          <p className="text-xs text-gray-400 mb-2">色帶依本場選手的等級上下限自動分色（綠＝低、黃＝中、紅＝高）</p>
          <div className="flex gap-2">
            {[
              { value: 8, label: '不限制' },
              { value: 2, label: '差 2 級' },
              { value: 1, label: '差 1 級' },
              { value: 0, label: '同級' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => update('levelGapLimit', opt.value)}
                className={`flex-1 py-2 px-1 rounded-lg text-sm border min-h-[40px] transition-colors
                  ${settings.levelGapLimit === opt.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Stats */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">活動統計</h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600">{state.players.length}</div>
            <div className="text-xs text-gray-500">選手總數</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{state.history.length}</div>
            <div className="text-xs text-gray-500">完成場次</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-600">
              {state.courts.filter(c => c.currentGame).length}
            </div>
            <div className="text-xs text-gray-500">進行中</div>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-white rounded-xl border border-red-100 p-4">
        <h3 className="text-sm font-medium text-red-600 mb-2">危險操作</h3>
        <button
          onClick={() => {
            if (confirm('確定要清除所有資料？此操作無法復原。')) {
              localStorage.removeItem('badminton-scheduler-v1');
              window.location.reload();
            }
          }}
          className="text-sm px-4 py-2 border border-red-300 text-red-500 rounded-lg hover:bg-red-50 min-h-[40px]"
        >
          清除所有資料
        </button>
      </div>
    </div>
  );
}
