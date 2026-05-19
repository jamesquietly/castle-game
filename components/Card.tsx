
import { Card as CardType } from '@/lib/game-logic';

interface CardProps {
  card?: CardType;
  faceDown?: boolean;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

export default function Card({ card, faceDown, selected, onClick, className = '' }: CardProps) {
  if (faceDown || !card) {
    return (
      <div
        onClick={onClick}
        className={`w-16 h-24 bg-blue-800 rounded-lg border-2 border-white flex items-center justify-center cursor-pointer ${selected ? 'ring-4 ring-yellow-400' : ''} ${className}`}
      >
        <div className="w-12 h-20 border border-blue-400 rounded-md opacity-20" />
      </div>
    );
  }

  const getSuitColor = (suit: string) => {
    return (suit === 'HEARTS' || suit === 'DIAMONDS') ? 'text-red-600' : 'text-black';
  };

  const getRankChar = (rank: number) => {
    if (rank <= 10) return rank.toString();
    if (rank === 11) return 'J';
    if (rank === 12) return 'Q';
    if (rank === 13) return 'K';
    if (rank === 14) return 'A';
    return rank.toString();
  };

  const getSuitSymbol = (suit: string) => {
    switch (suit) {
      case 'HEARTS': return '♥';
      case 'DIAMONDS': return '♦';
      case 'CLUBS': return '♣';
      case 'SPADES': return '♠';
      default: return '';
    }
  };

  return (
    <div
      onClick={onClick}
      className={`w-16 h-24 bg-white rounded-lg border-2 border-gray-300 flex flex-col p-1 cursor-pointer select-none ${selected ? 'ring-4 ring-yellow-400 -translate-y-2' : ''} ${className}`}
    >
      <div className={`text-sm font-bold ${getSuitColor(card.suit)}`}>
        {getRankChar(card.rank)}
      </div>
      <div className={`text-2xl self-center my-auto ${getSuitColor(card.suit)}`}>
        {getSuitSymbol(card.suit)}
      </div>
      <div className={`text-sm font-bold self-end rotate-180 ${getSuitColor(card.suit)}`}>
        {getRankChar(card.rank)}
      </div>
    </div>
  );
}
