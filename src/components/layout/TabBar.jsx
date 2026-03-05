const ALL_TABS = [
  { id: 'courts', label: '排場', icon: '🏸' },
  { id: 'players', label: '選手', icon: '👥' },
  { id: 'settings', label: '設定', icon: '⚙️' },
];

export function TabBar({ activeTab, onTabChange }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-50 lg:hidden">
      {ALL_TABS.map(tab => (
        <button
          key={tab.id}
          data-tutorial={tab.id === 'players' ? 'players-tab' : tab.id === 'settings' ? 'settings-tab' : undefined}
          onClick={() => onTabChange(tab.id)}
          className={`
            flex-1 flex flex-col items-center justify-center py-2 min-h-[56px] transition-colors
            ${activeTab === tab.id
              ? 'text-blue-600 bg-blue-50'
              : 'text-gray-500 hover:bg-gray-50'
            }
          `}
        >
          <span className="text-lg leading-none">{tab.icon}</span>
          <span className="text-xs mt-0.5 font-medium">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
