
'use client';

import { useState } from 'react';
import { useGame } from '@/hooks/useGame';
import Card from '@/components/Card';
import { canPlayCard } from '@/lib/game-logic';

export default function Home() {
  const [playerName, setPlayerName] = useState('');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [role, setRole] = useState<'HOST' | 'CLIENT' | null>(null);
  const [roomToJoin, setRoomToJoin] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('room');
    }
    return null;
  });

  const { gameState, peerId, players, performMove, startGame, error } = useGame(
    role === 'HOST',
    (role === 'HOST' ? roomIdInput : roomToJoin) || undefined,
    playerName
  );

  const [selectedCards, setSelectedCards] = useState<string[]>([]);

  const handleStartGame = () => {
    startGame();
  };

  const toggleCardSelection = (cardId: string) => {
    setSelectedCards(prev =>
      prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]
    );
  };

  const handlePlayCards = (source: 'hand' | 'faceUp' | 'faceDown') => {
    if (selectedCards.length === 0 || !gameState) return;

    // Validation
    const cardsToPlay = selectedCards.map(id => {
      if (source === 'hand') return me.hand.find(c => c.id === id);
      if (source === 'faceUp') return me.faceUp.find(c => c.id === id);
      if (source === 'faceDown') return me.faceDown.find(c => c.id === id);
      return null;
    }).filter(c => c !== null);

    if (cardsToPlay.length === 0) return;

    const firstRank = cardsToPlay[0]!.rank;
    if (!cardsToPlay.every(c => c!.rank === firstRank)) {
      alert('All played cards must have the same rank');
      return;
    }

    if (source !== 'faceDown') {
      const topCard = gameState.discardPile[gameState.discardPile.length - 1];
      if (!canPlayCard(firstRank, topCard, gameState.lastMoveEffect)) {
        alert('Invalid move: card rank too low');
        return;
      }
    }

    performMove({ type: 'PLAY_CARDS', cardIds: selectedCards, source });
    setSelectedCards([]);
  };

  const handlePickUp = () => {
    performMove({ type: 'PICK_UP_PILE' });
  };

  const handleReady = () => {
    performMove({ type: 'SET_READY', playerId: peerId });
  };

  const handleSwap = (handCardId: string, faceUpCardId: string) => {
    performMove({ type: 'SWAP_CARDS', playerId: peerId, handCardId, faceUpCardId });
    setSelectedCards([]);
  };

  const copyInviteLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('room', peerId || roomToJoin || '');
    navigator.clipboard.writeText(url.toString());
    alert('Invite link copied to clipboard!');
  };

  if (!role) {
    const urlRoom = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('room') : null;

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-green-900 text-white p-4">
        <h1 className="text-4xl font-bold mb-8">Castle Card Game</h1>
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <input
            type="text"
            placeholder="Your Name"
            className="p-2 rounded text-black"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />

          {urlRoom ? (
             <button
                disabled={!playerName}
                className="bg-green-600 p-3 rounded font-bold disabled:opacity-50"
                onClick={() => {
                  setRoomToJoin(urlRoom);
                  setRole('CLIENT');
                }}
              >
                Join Game: {urlRoom}
              </button>
          ) : (
            <>
              <button
                className="bg-blue-600 p-3 rounded font-bold"
                onClick={() => {
                  if (!playerName) return;
                  const id = Math.random().toString(36).substring(2, 7).toUpperCase();
                  setRoomIdInput(id);
                  setRole('HOST');
                }}
              >
                Host Game
              </button>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Room Code"
                  className="p-2 rounded text-black flex-1"
                  value={roomToJoin || ''}
                  onChange={(e) => setRoomToJoin(e.target.value.toUpperCase())}
                />
                <button
                  className="bg-green-600 p-3 rounded font-bold"
                  onClick={() => {
                    if (!playerName || !roomToJoin) return;
                    setRole('CLIENT');
                  }}
                >
                  Join
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-green-900 text-white p-4">
        <h1 className="text-2xl mb-4">Room: {role === 'HOST' ? peerId : roomToJoin}</h1>
        <div className="mb-8 flex flex-col items-center">
          <h2 className="text-xl font-bold mb-2">Players Connected:</h2>
          <ul className="flex flex-wrap gap-2">
            {players.map(p => (
              <li key={p.id} className="bg-white/20 px-4 py-2 rounded-full">{p.name} {p.id === peerId ? '(You)' : ''}</li>
            ))}
          </ul>
        </div>
        <button
          className="bg-gray-700 p-2 rounded mb-8 text-sm"
          onClick={copyInviteLink}
        >
          Copy Invite Link
        </button>
        {role === 'HOST' ? (
          <button
            disabled={players.length < 2}
            className="bg-blue-600 p-4 rounded-xl text-xl font-bold disabled:opacity-50"
            onClick={handleStartGame}
          >
            {players.length < 2 ? 'Waiting for players...' : 'Start Game'}
          </button>
        ) : (
          <p>Waiting for host to start...</p>
        )}
        {error && <p className="text-red-400 mt-4">{error}</p>}
      </div>
    );
  }

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const myIndex = gameState.players.findIndex(p => p.id === peerId);
  const me = gameState.players[myIndex] || gameState.players[0];
  const isMyTurn = gameState.currentPlayerIndex === myIndex;
  const topCard = gameState.discardPile[gameState.discardPile.length - 1];

  return (
    <div className="flex flex-col min-h-screen bg-green-900 text-white p-4 select-none">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-xl font-bold">{role} - {playerName}</h2>
          <p className={`font-bold ${isMyTurn ? 'text-yellow-400 animate-pulse' : 'text-gray-300'}`}>
            {gameState.phase === 'DEALING' ? 'DEALING PHASE' : (isMyTurn ? "YOUR TURN" : `${currentPlayer.name}'s Turn`)}
          </p>
        </div>
        <div className="text-right">
          <p>Room: {role === 'HOST' ? peerId : roomToJoin}</p>
          <p>Deck: {gameState.deck.length} cards</p>
        </div>
      </div>

      {/* Discard Pile or Dealing Message */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        {gameState.phase === 'DEALING' ? (
           <div className="flex flex-col items-center gap-4">
             <h2 className="text-2xl font-bold text-yellow-400">DEALING PHASE</h2>
             <p className="text-center max-w-md">Select one card from your hand and one face-up card to swap them. Click &quot;Ready&quot; when finished.</p>
             <button
               className={`px-6 py-3 rounded-full font-bold transition-colors ${me.isReady ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-500'}`}
               onClick={handleReady}
             >
               {me.isReady ? 'READY!' : 'Set Ready'}
             </button>
           </div>
        ) : (
          <>
            <div className="flex items-center gap-8">
              <div className="flex flex-col items-center">
                <span className="text-xs mb-1">Discard Pile ({gameState.discardPile.length})</span>
                <div className="relative w-16 h-24">
                  {gameState.discardPile.length > 0 ? (
                    <Card card={topCard} />
                  ) : (
                    <div className="w-16 h-24 border-2 border-dashed border-gray-500 rounded-lg" />
                  )}
                </div>
              </div>

              {gameState.lastMoveEffect && (
                <div className="bg-yellow-600 px-4 py-2 rounded-full font-bold text-sm animate-bounce">
                  EFFECT: {gameState.lastMoveEffect}
                </div>
              )}
            </div>

            {isMyTurn && (
              <div className="flex gap-2">
                <button
                  disabled={selectedCards.length === 0}
                  className="bg-white text-black px-4 py-2 rounded-lg font-bold disabled:opacity-50"
                  onClick={() => {
                    const source = me.hand.length > 0 ? 'hand' : me.faceUp.length > 0 ? 'faceUp' : 'faceDown';
                    handlePlayCards(source);
                  }}
                >
                  Play Selected
                </button>
                <button
                  className="bg-red-600 px-4 py-2 rounded-lg font-bold"
                  onClick={handlePickUp}
                >
                  Pick Up Pile
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* My Area */}
      <div className="mt-auto">
        {/* Face-down cards */}
        <div className="flex justify-center gap-4 mb-4">
          {me.faceDown.map((c) => (
             <div key={c.id} className="relative">
               <Card
                 faceDown
                 selected={selectedCards.includes(c.id)}
                 onClick={() => {
                    if (gameState.phase === 'PLAYING' && me.hand.length === 0 && me.faceUp.length === 0) {
                      toggleCardSelection(c.id);
                    }
                 }}
               />
               <div className="absolute -top-2 -left-2 bg-gray-800 text-[8px] p-1 rounded">FD</div>
             </div>
          ))}
        </div>

        {/* Face-up cards */}
        <div className="flex justify-center gap-4 mb-8">
          {me.faceUp.map((c) => (
             <Card
                key={c.id}
                card={c}
                selected={selectedCards.includes(c.id)}
                onClick={() => {
                  if (gameState.phase === 'DEALING') {
                    const handSelected = selectedCards.find(id => me.hand.some(hc => hc.id === id));
                    if (handSelected) {
                      handleSwap(handSelected, c.id);
                    } else {
                      toggleCardSelection(c.id);
                    }
                  } else {
                    if (me.hand.length === 0) toggleCardSelection(c.id);
                  }
                }}
             />
          ))}
        </div>

        {/* Hand */}
        <div className="flex justify-center -space-x-4">
          {me.hand.map((c) => (
            <Card
              key={c.id}
              card={c}
              selected={selectedCards.includes(c.id)}
              onClick={() => {
                if (gameState.phase === 'DEALING') {
                  const faceUpSelected = selectedCards.find(id => me.faceUp.some(fc => fc.id === id));
                  if (faceUpSelected) {
                    handleSwap(c.id, faceUpSelected);
                  } else {
                    toggleCardSelection(c.id);
                  }
                } else {
                  toggleCardSelection(c.id);
                }
              }}
              className="hover:z-10 transition-transform"
            />
          ))}
        </div>
      </div>

      {gameState.phase === 'GAME_OVER' && (
        <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
          <h2 className="text-6xl font-bold text-yellow-400 mb-4">WINNER!</h2>
          <p className="text-2xl">{gameState.winner === me.id ? 'You Won!' : `${gameState.winner} Won!`}</p>
          <button
            className="mt-8 bg-blue-600 px-8 py-3 rounded-full font-bold"
            onClick={() => window.location.reload()}
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}
