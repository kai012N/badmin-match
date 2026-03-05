import { useDraggable } from '@dnd-kit/core';

function getLevelColor(level) {
  if (level === 'A') return 'bg-red-100 text-red-700 border-red-200';
  if (level === 'B') return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  if (level === 'C') return 'bg-green-100 text-green-700 border-green-200';
  const n = parseInt(level) || 5;
  if (n >= 7) return 'bg-red-100 text-red-700 border-red-200';
  if (n >= 4) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  return 'bg-green-100 text-green-700 border-green-200';
}

function displayLevel(level) {
  if (level === 'A' || level === 'B' || level === 'C') return level;
  return `L${level}`;
}

export function PlayerCard({ player, compact = false, draggable = false, overlay = false }) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: player.id,
    disabled: !draggable,
    data: { type: 'player', playerId: player.id },
  });

  const style = transform ? {
    transform: `translate(${transform.x}px, ${transform.y}px)`,
  } : undefined;

  const levelColor = getLevelColor(player.level);

  if (compact) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...(draggable ? { ...listeners, ...attributes } : {})}
        className={`
          inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium
          bg-white border border-gray-200 shadow-sm select-none
          ${isDragging ? 'opacity-40' : ''}
          ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}
          ${overlay ? 'shadow-lg ring-2 ring-blue-400' : ''}
        `}
      >
        <span className={`text-xs font-bold px-1 py-0.5 rounded border ${levelColor}`}>
          {displayLevel(player.level)}
        </span>
        <span className="truncate max-w-[80px]">{player.name}</span>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(draggable ? { ...listeners, ...attributes } : {})}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200
        shadow-sm select-none min-h-[44px]
        ${isDragging ? 'opacity-40' : ''}
        ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}
        ${overlay ? 'shadow-xl ring-2 ring-blue-400 rotate-2' : ''}
      `}
    >
      <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${levelColor} shrink-0`}>
        {displayLevel(player.level)}
      </span>
      <span className="font-medium truncate flex-1">{player.name}</span>
      <div className="flex flex-col items-end text-xs text-gray-400 shrink-0">
        <span>{player.gamesPlayed}局</span>
        {player.rating !== undefined && (
          <span className="text-blue-400 font-medium">
            {player.rating}{player.rd !== undefined && player.rd > 100 ? '?' : ''}
          </span>
        )}
        {player.waitCount > 0 && (
          <span className="text-orange-500">等{player.waitCount}</span>
        )}
      </div>
    </div>
  );
}
