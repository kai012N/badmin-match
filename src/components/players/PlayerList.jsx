import { useState, useEffect } from 'react';
import { useGame } from '../../store/GameContext';
import { PlayerForm } from './PlayerForm';
import { getLevelColor, displayLevel, getPlayerRange } from '../../utils/levelUtils';

// ── Time slot helpers (stored as minutes-from-midnight) ──────────────────────

export function fmtTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}` : `${h}:${String(m).padStart(2, '0')}`;
}

// Extract time slot from a string that may contain parentheses.
// Supports: (1930-2230)  (19:30-21:30)  (19-22)  （19-22）
function extractParensTimeSlot(s) {
  // 4-digit HHMM: (1930-2230)
  const m4 = s.match(/[（(](\d{4})-(\d{4})[)）]/);
  if (m4) {
    const sh = parseInt(m4[1].slice(0, 2)), sm = parseInt(m4[1].slice(2));
    const eh = parseInt(m4[2].slice(0, 2)), em = parseInt(m4[2].slice(2));
    const start = sh * 60 + sm, end = eh * 60 + em;
    if (sh <= 23 && sm <= 59 && eh <= 23 && em <= 59 && end > start) return { start, end };
  }
  // HH:MM colon format: (19:30-21:30)
  const mc = s.match(/[（(](\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})[)）]/);
  if (mc) {
    const start = parseInt(mc[1]) * 60 + parseInt(mc[2]);
    const end   = parseInt(mc[3]) * 60 + parseInt(mc[4]);
    if (start >= 0 && end > start && end <= 24 * 60) return { start, end };
  }
  // Simple whole-hour: (19-22)
  const ms = s.match(/[（(](\d{1,2})-(\d{1,2})[)）]/);
  if (ms) {
    const start = parseInt(ms[1]) * 60, end = parseInt(ms[2]) * 60;
    if (start >= 0 && end > start && end <= 24 * 60) return { start, end };
  }
  return null;
}

// Extract bare trailing time slot (no parens): "19-22", "18:30-21:30", "1930-2230" at line end
// Returns { slot, name } or null
function extractBareTimeSlot(s) {
  // 4-digit HHMM bare: 1930-2230
  const m4 = s.match(/\s+(\d{4})-(\d{4})\s*$/);
  if (m4) {
    const sh = parseInt(m4[1].slice(0, 2)), sm = parseInt(m4[1].slice(2));
    const eh = parseInt(m4[2].slice(0, 2)), em = parseInt(m4[2].slice(2));
    const start = sh * 60 + sm, end = eh * 60 + em;
    if (sh <= 23 && sm <= 59 && eh <= 23 && em <= 59 && end > start) {
      return { slot: { start, end }, name: s.slice(0, s.lastIndexOf(m4[0])).trim() };
    }
  }
  // HH:MM colon bare: 18:30-21:30
  const mc = s.match(/\s+(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})\s*$/);
  if (mc) {
    const start = parseInt(mc[1]) * 60 + parseInt(mc[2]);
    const end   = parseInt(mc[3]) * 60 + parseInt(mc[4]);
    if (start >= 0 && end > start && end <= 24 * 60) {
      return { slot: { start, end }, name: s.slice(0, s.lastIndexOf(mc[0])).trim() };
    }
  }
  // Simple whole-hour bare: 19-22
  const ms = s.match(/\s+(\d{1,2})-(\d{1,2})\s*$/);
  if (ms) {
    const start = parseInt(ms[1]) * 60, end = parseInt(ms[2]) * 60;
    if (start >= 0 && end > start && end <= 24 * 60) {
      return { slot: { start, end }, name: s.slice(0, s.lastIndexOf(ms[0])).trim() };
    }
  }
  return null;
}

// Time slot status relative to now: 'pending' | 'ok' | 'soon' (≤30 min) | 'expired'
export function timeSlotStatus(timeSlot) {
  if (!timeSlot) return null;
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  if (cur < timeSlot.start) return 'pending';
  if (cur >= timeSlot.end) return 'expired';
  if (timeSlot.end - cur <= 30) return 'soon';
  return 'ok';
}

/*
  支援多種報名格式（自動識別，無需切換）：
  格式一：L前綴  → "1. Lulu L4"  "2. 秀竹L7 (10-12)"  "4. sp賀L6 (19-22)"
  格式二：純數字 → "1.大豬 8"    "2.Boris 6"           "3.映羽"（無等級→L5）
  格式三：斜線   → "2.大雄/7（14-20）"  "4.2234/8（14-16）"

  共同規則：
  - 行首數字編號自動移除（1. 2、3） 等各種標點）
  - 括號內容（時段、備註）自動忽略，支援全形/半形
  - 等級解析優先順序：L前綴 > 斜線 > 尾端純數字 > 預設L5
  - 名字可含 emoji、數字開頭（2234、00）
*/
function parsePlayerList(text) {
  return text
    .split(/\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      // Step 1: Remove leading number + punctuation
      let s = line.replace(/^\d+[.)。、：:]\s*/, '');

      // Step 2: Extract time slot from parentheses (all formats)
      let timeSlot = extractParensTimeSlot(s);

      // Step 3: Strip all parenthesised content
      s = s.replace(/[（(][^)）]*[)）]/g, '').trim();

      // Step 4: Try bare trailing time slot (e.g. "19-22" or "1930-2230" at end)
      //         Do this BEFORE level parsing so trailing numbers aren't mis-parsed
      if (!timeSlot) {
        const bare = extractBareTimeSlot(s);
        if (bare) { timeSlot = bare.slot; s = bare.name; }
      }

      let level = null;
      let name = s;

      // Priority 1: L prefix — L6, Ｌ6, l6
      const lMatch = s.match(/[ＬLl]\s*(\d+)/);
      if (lMatch) {
        level = lMatch[1];
        name = s.replace(/[ＬLl]\s*\d+/, '').trim();
      }
      // Priority 2: slash separator — /7
      if (!level) {
        const slashMatch = s.match(/\/(\d+)/);
        if (slashMatch) { level = slashMatch[1]; name = s.replace(/\/\d+/, '').trim(); }
      }
      // Priority 3: trailing bare number — "大豬 8"
      if (!level) {
        const trailMatch = s.match(/\s+(\d{1,2})\s*$/);
        if (trailMatch) {
          level = trailMatch[1];
          name = s.slice(0, s.lastIndexOf(trailMatch[0])).trim();
        }
      }
      // level stays null if not found — caller decides the default

      return { name: name.trim(), level, timeSlot };
    })
    .filter(p => p.name.length > 0);
}

function BatchImportPanel({ onClose }) {
  const { state, dispatch } = useGame();
  const [text, setText] = useState('');
  const [previewed, setPreviewed] = useState(false);
  const [parsed, setParsed] = useState([]);

  function handlePreview() {
    setParsed(parsePlayerList(text));
    setPreviewed(true);
  }

  function classify(p) {
    const existing = state.players.find(ep => ep.name === p.name);
    if (!existing) return { status: 'new', existing: null };
    const effectiveLevel = p.level ?? existing.level;
    const levelChanged = String(existing.level) !== String(effectiveLevel);
    const timeSlotChanged = JSON.stringify(existing.timeSlot ?? null) !== JSON.stringify(p.timeSlot ?? null);
    if (levelChanged || timeSlotChanged) return { status: 'update', existing };
    return { status: 'skip', existing };
  }

  function handleImport() {
    parsed.forEach(p => {
      const { status, existing } = classify(p);
      if (status === 'new') {
        dispatch({ type: 'ADD_PLAYER', payload: { name: p.name, level: p.level ?? '5', timeSlot: p.timeSlot } });
      } else if (status === 'update') {
        dispatch({ type: 'UPDATE_PLAYER', payload: { id: existing.id, name: existing.name, level: p.level ?? existing.level, timeSlot: p.timeSlot } });
      }
    });
    onClose();
  }

  const classifications = parsed.map(p => classify(p));
  const newCount    = classifications.filter(c => c.status === 'new').length;
  const updateCount = classifications.filter(c => c.status === 'update').length;
  const skipCount   = classifications.filter(c => c.status === 'skip').length;
  const actionCount = newCount + updateCount;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
      <h3 className="font-medium text-gray-700">批次匯入選手</h3>

      {!previewed ? (
        <>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              支援格式：<code className="bg-gray-100 px-1 rounded">1. 姓名 L6</code>　或每行一個名字
            </label>
            <textarea
              value={text}
              onChange={e => { setText(e.target.value); setPreviewed(false); }}
              placeholder={'1. 周截輪 L8\n2. 戴資穎 L10 (18:30-21:30)\n3. 菜依林\n4. 林單 L9 (19-22)'}
              rows={6}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400 resize-none font-mono"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePreview}
              disabled={!text.trim()}
              className="flex-1 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40 min-h-[40px]"
            >
              解析預覽
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 min-h-[40px]"
            >
              取消
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="text-xs text-gray-500 space-x-2">
            <span>共 {parsed.length} 人</span>
            {newCount > 0    && <span className="text-green-600">新增 {newCount}</span>}
            {updateCount > 0 && <span className="text-blue-600">更新 {updateCount}</span>}
            {skipCount > 0   && <span className="text-gray-400">略過 {skipCount}</span>}
          </div>
          <div className="border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-3 py-1.5 text-xs text-gray-500 font-medium">姓名</th>
                  <th className="text-left px-3 py-1.5 text-xs text-gray-500 font-medium">等級</th>
                  <th className="text-left px-3 py-1.5 text-xs text-gray-500 font-medium">零打時段</th>
                  <th className="text-left px-3 py-1.5 text-xs text-gray-500 font-medium">狀態</th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((p, i) => {
                  const { status, existing } = classifications[i];
                  const rowCls = status === 'skip'
                    ? 'opacity-40'
                    : status === 'update'
                      ? 'bg-blue-50'
                      : '';
                  const effectiveLevel = p.level ?? (existing?.level ?? '5');
                  const levelChanged = status === 'update' && String(existing.level) !== String(effectiveLevel);
                  return (
                    <tr key={i} className={`border-b border-gray-100 last:border-0 ${rowCls}`}>
                      <td className="px-3 py-1.5">{p.name}</td>
                      <td className="px-3 py-1.5">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${getLevelColor(effectiveLevel)}`}>
                          L{effectiveLevel}
                        </span>
                        {levelChanged && (
                          <span className="text-xs text-gray-400 ml-1 line-through">L{existing.level}</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-gray-500">
                        {p.timeSlot ? `${fmtTime(p.timeSlot.start)}–${fmtTime(p.timeSlot.end)}` : '—'}
                        {status === 'update' && JSON.stringify(existing.timeSlot ?? null) !== JSON.stringify(p.timeSlot ?? null) && (
                          <span className="text-gray-400 ml-1 line-through">
                            {existing.timeSlot ? `${fmtTime(existing.timeSlot.start)}–${fmtTime(existing.timeSlot.end)}` : '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-xs">
                        {status === 'new'    && <span className="text-green-600">新增</span>}
                        {status === 'update' && <span className="text-blue-600">更新</span>}
                        {status === 'skip'   && <span className="text-gray-400">略過</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleImport}
              disabled={actionCount === 0}
              className="flex-1 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-40 min-h-[40px]"
            >
              確認匯入（{newCount > 0 ? `新增 ${newCount}` : ''}{newCount > 0 && updateCount > 0 ? '、' : ''}{updateCount > 0 ? `更新 ${updateCount}` : ''}）
            </button>
            <button
              onClick={() => setPreviewed(false)}
              className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 min-h-[40px]"
            >
              返回編輯
            </button>
            <button
              onClick={onClose}
              className="px-3 py-2 border border-gray-300 text-gray-500 text-sm rounded-lg hover:bg-gray-50 min-h-[40px]"
            >
              取消
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function PlayerList() {
  const { state, dispatch } = useGame();
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showBatch, setShowBatch] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [expandedPlayerId, setExpandedPlayerId] = useState(null);
  const [expandedSecondary, setExpandedSecondary] = useState(new Set());
  function toggleSecondary(id) {
    setExpandedSecondary(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  const [selectingRule, setSelectingRule] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);

  useEffect(() => {
    if (!menuOpenId) return;
    function handleDocClick(e) {
      if (e.target.closest('[data-menu-player]')?.dataset.menuPlayer === menuOpenId) return;
      setMenuOpenId(null);
    }
    document.addEventListener('click', handleDocClick, true);
    return () => document.removeEventListener('click', handleDocClick, true);
  }, [menuOpenId]);

  useEffect(() => {
    if (!expandedPlayerId) return;
    function handleDocClick(e) {
      if (e.target.closest(`[data-menu-player="${expandedPlayerId}"]`)) return;
      if (e.target.closest('[data-expanded-panel]')) return;
      setExpandedPlayerId(null);
    }
    document.addEventListener('click', handleDocClick, true);
    return () => document.removeEventListener('click', handleDocClick, true);
  }, [expandedPlayerId]);

  useEffect(() => {
    if (!selectingRule) return;
    function handleDocClick(e) {
      if (e.target.closest('[data-menu-player]')) return;
      if (e.target.closest('[data-selecting-banner]')) return;
      setSelectingRule(null);
    }
    document.addEventListener('click', handleDocClick, true);
    return () => document.removeEventListener('click', handleDocClick, true);
  }, [selectingRule]);

  useEffect(() => {
    if (!showForm) return;
    function handleDocClick(e) {
      if (e.target.closest('[data-player-form]')) return;
      setShowForm(false);
      setEditingPlayer(null);
    }
    document.addEventListener('click', handleDocClick, true);
    return () => document.removeEventListener('click', handleDocClick, true);
  }, [showForm]);

  const { players, waitingQueue } = state;
  const playerRange = getPlayerRange(players);
  const { forceTeams = [], avoidGame = [] } = state.pairRules ?? {};
  // open state kept for mobile compatibility but always true on desktop (no toggle header)
  // We render the list unconditionally in modal context

  function handleRemove(id) {
    if (confirm('確定要移除這位選手？')) {
      dispatch({ type: 'REMOVE_PLAYER', payload: { id } });
    }
  }

  function handleToggle(id) {
    dispatch({ type: 'TOGGLE_PLAYER_ACTIVE', payload: { playerId: id } });
  }

  function handlePlayerSelect(clickedId) {
    if (!selectingRule) return;
    if (selectingRule.forPlayerId === clickedId) {
      setSelectingRule(null);
      return;
    }
    const { forPlayerId, type } = selectingRule;
    if (type === 'force-team') {
      dispatch({ type: 'SET_FORCE_TEAM', payload: { playerA: forPlayerId, playerB: clickedId } });
    } else {
      dispatch({ type: 'ADD_AVOID_GAME', payload: { playerA: forPlayerId, playerB: clickedId } });
    }
    setSelectingRule(null);
  }

  function getForcePartnerRule(playerId) {
    return forceTeams.find(r => r.playerA === playerId || r.playerB === playerId) ?? null;
  }

  function getAvoidRules(playerId) {
    return avoidGame.filter(r => r.playerA === playerId || r.playerB === playerId);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-gray-800">選手名單 ({players.length})</span>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowBatch(v => !v); setShowForm(false); }}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 border border-gray-300 min-h-[36px]"
          >
            批次匯入
          </button>
          <button
            onClick={() => { setEditingPlayer(null); setShowForm(true); setShowBatch(false); }}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 min-h-[36px]"
          >
            + 新增
          </button>
        </div>
      </div>

      {showBatch && (
        <BatchImportPanel onClose={() => setShowBatch(false)} />
      )}

      {showForm && (
        <div data-player-form className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <h3 className="font-medium text-gray-700 mb-3">
            {editingPlayer ? '編輯選手' : '新增選手'}
          </h3>
          <PlayerForm
            editPlayer={editingPlayer}
            onClose={() => { setShowForm(false); setEditingPlayer(null); }}
          />
        </div>
      )}

      {selectingRule && (
        <div data-selecting-banner className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-3 py-2" onClick={e => e.stopPropagation()}>
          <span className="text-sm text-blue-700">
            {selectingRule.type === 'force-team' ? '點選強制同隊的搭檔' : '點選避免同場的對象'}
          </span>
          <button
            onClick={() => setSelectingRule(null)}
            className="text-sm text-blue-500 hover:text-blue-700 font-medium"
          >
            取消
          </button>
        </div>
      )}

      {players.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          尚無選手，請新增選手開始使用
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-2">
          {[...players].sort((a, b) => {
            const statusOrder = p => {
              const inQ = waitingQueue.includes(p.id);
              const onC = state.courts.some(c => c.currentGame && [...c.currentGame.team1, ...c.currentGame.team2].includes(p.id));
              if (inQ) return 0;
              if (onC) return 1;
              return 2;
            };
            const sa = statusOrder(a), sb = statusOrder(b);
            if (sa !== sb) return sa - sb;
            return (a.gamesPlayed ?? 0) - (b.gamesPlayed ?? 0);
          }).map(player => {
                const inQueue = waitingQueue.includes(player.id);
                const onCourt = state.courts.some(c =>
                  c.currentGame &&
                  [...c.currentGame.team1, ...c.currentGame.team2].includes(player.id)
                );
                const status = onCourt ? '上場中' : inQueue ? '等待中' : '休息';
                const statusColor = onCourt ? 'text-green-600' : inQueue ? 'text-blue-600' : 'text-gray-400';

                const forceRule = getForcePartnerRule(player.id);
                const avoidRules = getAvoidRules(player.id);
                const forcePartnerId = forceRule
                  ? (forceRule.playerA === player.id ? forceRule.playerB : forceRule.playerA)
                  : null;
                const forcePartner = forcePartnerId ? players.find(p => p.id === forcePartnerId) : null;

                const isSelectSource = selectingRule?.forPlayerId === player.id;
                const isSelectTarget = !!selectingRule && !isSelectSource;

                const rowBorderClass = isSelectSource
                  ? 'border-blue-500 ring-1 ring-blue-300'
                  : isSelectTarget
                    ? 'border-blue-300 cursor-pointer hover:bg-blue-50'
                    : 'border-gray-200';

                const hasSecondary = !!(player.timeSlot || forceRule || avoidRules.length > 0);
                const isSecondaryOpen = expandedSecondary.has(player.id);

                return (
                  <div key={player.id}>
                    <div
                      data-menu-player={player.id}
                      className={`bg-white rounded-2xl border shadow-sm transition-colors ${rowBorderClass}`}
                      onClick={selectingRule ? () => handlePlayerSelect(player.id) : undefined}
                    >
                      {/* ── 主要狀態 ── */}
                      <div className="flex items-center gap-2 px-3 py-2.5">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${getLevelColor(player.level, playerRange)} shrink-0`}>
                          {displayLevel(player.level)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{player.name}</div>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs shrink-0">
                          <span className="text-gray-400">{player.gamesPlayed}局</span>
                          <span className={statusColor}>{status}</span>
                        </div>
                      {!selectingRule && (
                        <div className="relative shrink-0">
                          <button
                            onClick={e => { e.stopPropagation(); setMenuOpenId(menuOpenId === player.id ? null : player.id); }}
                            className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 text-gray-500 hover:bg-gray-100 text-base leading-none"
                          >
                            ⋮
                          </button>
                          {menuOpenId === player.id && (
                            <div
                              onClick={e => e.stopPropagation()}
                              className="absolute right-0 top-full mt-1 bg-white rounded-xl border border-gray-200 shadow-lg z-20 overflow-hidden py-1 min-w-[80px]"
                            >
                              {!onCourt && (
                                <button
                                  onClick={() => { handleToggle(player.id); setMenuOpenId(null); }}
                                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${inQueue ? 'text-gray-600' : 'text-blue-600'}`}
                                >
                                  {inQueue ? '休息' : '待機'}
                                </button>
                              )}
                              <button
                                onClick={() => { setExpandedPlayerId(expandedPlayerId === player.id ? null : player.id); setMenuOpenId(null); }}
                                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${expandedPlayerId === player.id ? 'text-blue-600' : 'text-gray-600'}`}
                              >
                                規則
                              </button>
                              <button
                                onClick={() => { setEditingPlayer(player); setShowForm(true); setShowBatch(false); setMenuOpenId(null); }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                              >
                                編輯
                              </button>
                              <button
                                onClick={() => { handleRemove(player.id); setMenuOpenId(null); }}
                                className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50"
                              >
                                刪除
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      </div>

                      {/* ── 次要狀態 toggle / spacer ── */}
                      {!hasSecondary && !selectingRule && (
                        <div className="border-t border-gray-100 h-6" />
                      )}
                      {hasSecondary && !selectingRule && (
                        <button
                          onClick={e => { e.stopPropagation(); toggleSecondary(player.id); }}
                          className="w-full flex items-center gap-1.5 px-3 py-1 border-t border-gray-100 text-xs text-gray-400 hover:text-gray-600"
                        >
                          <span className={`transition-transform duration-150 ${isSecondaryOpen ? 'rotate-90' : ''}`}>▶</span>
                          {!isSecondaryOpen && (
                            <span className="flex gap-1">
                              {player.timeSlot && <span>⏰</span>}
                              {forceRule && <span>🤝</span>}
                              {avoidRules.length > 0 && <span>🚫</span>}
                            </span>
                          )}
                        </button>
                      )}

                      {/* ── 次要狀態內容 ── */}
                      {hasSecondary && isSecondaryOpen && !selectingRule && (
                        <div className="px-3 pb-2.5 flex flex-wrap gap-1.5" onClick={e => e.stopPropagation()}>
                          {player.timeSlot && (() => {
                            const ts = timeSlotStatus(player.timeSlot);
                            const label = `${fmtTime(player.timeSlot.start)}-${fmtTime(player.timeSlot.end)}`;
                            return (
                              <span className={`px-1.5 py-0.5 rounded border text-xs font-medium
                                ${ts === 'pending' ? 'bg-gray-50 border-gray-200 text-gray-400' :
                                  ts === 'soon'    ? 'bg-amber-50 border-amber-300 text-amber-700' :
                                  ts === 'expired' ? 'bg-red-50 border-red-300 text-red-500' :
                                                     'bg-gray-50 border-gray-200 text-gray-500'}`}>
                                {ts === 'pending' ? `⏰ ${label}` : `🕐 ${label}`}
                              </span>
                            );
                          })()}
                          {forcePartner && (
                            <span className="text-xs bg-blue-50 text-blue-600 border border-blue-100 rounded-full px-2 py-0.5">
                              🤝 {forcePartner.name}
                            </span>
                          )}
                          {avoidRules.map(r => {
                            const otherId = r.playerA === player.id ? r.playerB : r.playerA;
                            const other = players.find(p => p.id === otherId);
                            return (
                              <span key={otherId} className="text-xs bg-red-50 text-red-600 border border-red-100 rounded-full px-2 py-0.5">
                                🚫 {other?.name}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {expandedPlayerId === player.id && !selectingRule && (
                      <div data-expanded-panel className="mt-1 bg-gray-50 rounded-xl border border-gray-200 px-3 py-2.5 space-y-2" onClick={e => e.stopPropagation()}>
                        <div className="text-xs font-medium text-gray-500 mb-0.5">規則管理：{player.name}</div>

                        <div className="flex items-start gap-2">
                          <span className="text-xs text-gray-400 pt-0.5 w-14 shrink-0">強制同隊</span>
                          <div className="flex flex-wrap gap-1.5 flex-1">
                            {forcePartner ? (
                              <span className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5 text-xs text-blue-700">
                                🤝 {forcePartner.name}
                                <button
                                  onClick={() => dispatch({ type: 'REMOVE_FORCE_TEAM', payload: { playerId: player.id } })}
                                  className="text-blue-400 hover:text-red-500 leading-none ml-0.5"
                                >
                                  ✕
                                </button>
                              </span>
                            ) : (
                              <button
                                onClick={() => setSelectingRule({ forPlayerId: player.id, type: 'force-team' })}
                                className="text-xs px-2 py-0.5 border border-dashed border-blue-300 text-blue-500 rounded-full hover:bg-blue-50"
                              >
                                ＋ 設定搭檔
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <span className="text-xs text-gray-400 pt-0.5 w-14 shrink-0">避免同場</span>
                          <div className="flex flex-wrap gap-1.5 flex-1">
                            {avoidRules.map(r => {
                              const otherId = r.playerA === player.id ? r.playerB : r.playerA;
                              const other = players.find(p => p.id === otherId);
                              return (
                                <span key={otherId} className="flex items-center gap-1 bg-red-50 border border-red-200 rounded-full px-2 py-0.5 text-xs text-red-700">
                                  🚫 {other?.name}
                                  <button
                                    onClick={() => dispatch({ type: 'REMOVE_AVOID_GAME', payload: { playerA: player.id, playerB: otherId } })}
                                    className="text-red-400 hover:text-red-600 leading-none ml-0.5"
                                  >
                                    ✕
                                  </button>
                                </span>
                              );
                            })}
                            <button
                              onClick={() => setSelectingRule({ forPlayerId: player.id, type: 'avoid-game' })}
                              className="text-xs px-2 py-0.5 border border-dashed border-red-300 text-red-500 rounded-full hover:bg-red-50"
                            >
                              ＋ 新增
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
    </div>
  );
}
