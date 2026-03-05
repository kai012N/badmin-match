import { useGame } from '../../store/GameContext';
import { CourtCard } from './CourtCard';

export function CourtList() {
  const { state } = useGame();
  const { courts } = state;

  return (
    <div>
      <h2 className="font-semibold text-gray-800 mb-3">場地狀況</h2>
      <div className="grid grid-cols-2 gap-2 lg:gap-3">
        {courts.map(court => (
          <CourtCard key={court.id} court={court} />
        ))}
      </div>
    </div>
  );
}
