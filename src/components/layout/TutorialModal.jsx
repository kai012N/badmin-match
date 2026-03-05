import { useState, useEffect } from 'react';

const TIP_W = 272;
const TIP_H = 190;
const MARGIN = 12;
const GAP = 12;

const STEPS = [
  {
    desktopTarget: '[data-tutorial="players-btn"]',
    mobileTarget:  '[data-tutorial="players-tab"]',
    icon: '👥',
    title: '選手名單',
    desc: '新增球友或批次貼上名單，可設定零打時段自動進出等待區。',
    hint: '點擊按鈕試試看',
  },
  {
    desktopTarget: '[data-tutorial="court-area"]',
    mobileTarget:  '[data-tutorial="court-area"]',
    icon: '🎯',
    title: '手動上場',
    desc: '點空白場地進入指派模式，從等待區選 4 人後確認上場。',
    hint: '點空白場地試試看',
  },
  {
    desktopTarget: '[data-tutorial="suggestions"]',
    mobileTarget:  null,
    icon: '⚡',
    title: '自動配對',
    desc: '等待區 4 人以上時系統推薦配對。點「上場」一鍵開始，點名字可換人。',
    hint: '需 4 人在等待區才會顯示',
  },
  {
    desktopTarget: '[data-tutorial="settings-btn"]',
    mobileTarget:  '[data-tutorial="settings-tab"]',
    icon: '⚙️',
    title: '系統設定',
    desc: '設定場地數量與等差限制，色帶依選手等級範圍自動分色。',
    hint: '點按鈕開啟設定',
  },
  {
    installStep: true,
    desktopTarget: null,
    mobileTarget:  null,
    icon: '📲',
    title: '安裝到主畫面',
    desc: '加入主畫面後可像 App 一樣啟動，支援離線使用。',
    hint: null,
  },
];

function isMobile() { return window.innerWidth < 1024; }

function findVisible(selector) {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? el : null;
}

function getTargetRect(stepIndex) {
  const step = STEPS[stepIndex];
  const mobile = isMobile();
  const el = mobile
    ? (findVisible(step.mobileTarget) ?? findVisible(step.desktopTarget))
    : (findVisible(step.desktopTarget) ?? findVisible(step.mobileTarget));
  return el ? el.getBoundingClientRect() : null;
}

// Desktop: spotlight cutout positioning
function computeDesktopStyle(rect) {
  if (!rect) {
    return { width: TIP_W, top: '50%', left: '50%', transform: 'translate(-50%,-50%)' };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const isTall = rect.height > vh * 0.4;

  if (isTall) {
    const spaceRight = vw - rect.right - GAP;
    const spaceLeft  = rect.left - GAP;
    let left;
    if (spaceRight >= TIP_W + MARGIN)      left = rect.right + GAP;
    else if (spaceLeft >= TIP_W + MARGIN)  left = rect.left - GAP - TIP_W;
    else                                    left = Math.max(MARGIN, (vw - TIP_W) / 2);
    const top = Math.max(MARGIN, Math.min(rect.top + rect.height / 2 - TIP_H / 2, vh - TIP_H - MARGIN));
    return { width: TIP_W, top, left };
  }

  const left = Math.max(MARGIN, Math.min(rect.left, vw - TIP_W - MARGIN));
  const spaceBelow = vh - rect.bottom - GAP;
  const spaceAbove = rect.top - GAP;
  let top = (spaceBelow >= TIP_H || spaceBelow >= spaceAbove)
    ? rect.bottom + GAP
    : rect.top - GAP - TIP_H;
  top = Math.max(MARGIN, Math.min(top, vh - TIP_H - MARGIN));
  return { width: TIP_W, top, left };
}

function InstallHint({ deferredPrompt }) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (deferredPrompt) {
    return (
      <button
        onClick={() => deferredPrompt.prompt()}
        className="w-full mt-1 mb-3 px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-full hover:bg-blue-700 transition-colors"
      >
        立即安裝
      </button>
    );
  }
  if (isIOS) {
    return (
      <div className="text-xs text-blue-400 bg-blue-50 rounded-lg px-2.5 py-2 mb-3 leading-relaxed">
        點底部 📤 分享 → 選「加入主畫面」
      </div>
    );
  }
  return (
    <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-2.5 py-2 mb-3 leading-relaxed">
      可在瀏覽器網址列右側點安裝圖示
    </div>
  );
}

function CardContent({ current, step, total, isFirst, isLast, onPrev, onNext, onSkip, deferredPrompt }) {
  return (
    <div className="bg-white rounded-2xl shadow-2xl p-4" style={{ width: TIP_W }}>
      {/* Step dots */}
      <div className="flex gap-1.5 mb-3">
        {STEPS.map((_, i) => (
          <div key={i} className={`rounded-full h-2 transition-all duration-200 ${i === step ? 'w-5 bg-blue-600' : 'w-2 bg-gray-200'}`} />
        ))}
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{current.icon}</span>
        <div>
          <div className="text-xs text-blue-500 font-medium">{step + 1} / {total}</div>
          <h3 className="font-bold text-gray-800 text-sm leading-tight">{current.title}</h3>
        </div>
      </div>

      <p className="text-xs text-gray-600 mb-2 leading-relaxed">{current.desc}</p>

      {current.installStep && <InstallHint deferredPrompt={deferredPrompt} />}

      {current.hint && (
        <div className="text-xs text-blue-400 bg-blue-50 rounded-lg px-2.5 py-1 mb-3">
          👆 {current.hint}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button onClick={onSkip} className="text-xs text-gray-400 hover:text-gray-600 mr-auto">跳過</button>
        {!isFirst && (
          <button onClick={onPrev} className="px-3 py-1.5 text-xs text-gray-500 border border-gray-300 rounded-full hover:bg-gray-50 transition-colors">
            ← 上一步
          </button>
        )}
        <button onClick={onNext} className="px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-full hover:bg-blue-700 transition-colors">
          {isLast ? '開始 🎉' : '下一步 →'}
        </button>
      </div>
    </div>
  );
}

export function TutorialModal({ open, onClose, installPrompt }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);

  useEffect(() => { if (!open) return; setStep(0); }, [open]);

  useEffect(() => {
    if (!open) return;
    const measure = () => setRect(getTargetRect(step));
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, step]);

  function handleNext() { step === STEPS.length - 1 ? onClose() : setStep(s => s + 1); }
  function handlePrev() { if (step > 0) setStep(s => s - 1); }
  function handleClose() { setStep(0); onClose(); }

  if (!open) return null;

  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast  = step === STEPS.length - 1;
  const mobile = isMobile();

  const cardProps = { current, step, total: STEPS.length, isFirst, isLast, onPrev: handlePrev, onNext: handleNext, onSkip: handleClose, deferredPrompt: installPrompt };

  // Shared spotlight constants — z-indices above TabBar (z-50) and other fixed UI
  const SPOT_PAD = 8;
  const Z_BG       = 55;   // click-to-close layer (above TabBar z-50)
  const Z_SPOT     = 56;   // spotlight div
  const Z_CARD     = 70;   // tooltip / card

  const spotlight = rect ? (
    <div style={{
      position: 'fixed',
      zIndex: Z_SPOT,
      top:    rect.top    - SPOT_PAD,
      left:   rect.left   - SPOT_PAD,
      width:  rect.width  + SPOT_PAD * 2,
      height: rect.height + SPOT_PAD * 2,
      borderRadius: 10,
      boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
      border: '2px solid rgba(255,255,255,0.2)',
      pointerEvents: 'none',
    }} />
  ) : (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: Z_SPOT, pointerEvents: 'none' }} />
  );

  /* ── Mobile: spotlight + centered card + directional arrow ── */
  if (mobile) {
    return (
      <>
        <div onClick={handleClose} style={{ position: 'fixed', inset: 0, zIndex: Z_BG }} />
        {spotlight}
        <div
          style={{ position: 'fixed', zIndex: Z_CARD, top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}
          onClick={e => e.stopPropagation()}
        >
          <CardContent {...cardProps} />
        </div>
      </>
    );
  }

  /* ── Desktop: spotlight + tooltip near target ── */
  const tipStyle = computeDesktopStyle(rect);

  return (
    <>
      <div onClick={handleClose} style={{ position: 'fixed', inset: 0, zIndex: Z_BG }} />
      {spotlight}
      <div style={{ position: 'fixed', zIndex: Z_CARD, ...tipStyle }} onClick={e => e.stopPropagation()}>
        <CardContent {...cardProps} />
      </div>
    </>
  );
}
