
export type Suit = 'HEARTS' | 'DIAMONDS' | 'CLUBS' | 'SPADES';

export type Rank = number; // 2-14, where 11=J, 12=Q, 13=K, 14=A

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string;
}

export type GamePhase = 'LOBBY' | 'DEALING' | 'PLAYING' | 'GAME_OVER';

export interface Player {
  id: string;
  name: string;
  hand: Card[];
  faceUp: Card[];
  faceDown: Card[];
  isReady?: boolean;
}

export interface GameState {
  deck: Card[];
  discardPile: Card[];
  players: Player[];
  currentPlayerIndex: number;
  phase: GamePhase;
  lastMoveEffect?: 'LOWER_THAN_SEVEN' | 'RESET' | 'BURN';
  winner?: string;
}

export const SUITS: Suit[] = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'];
export const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        suit,
        rank,
        id: `${suit}-${rank}`,
      });
    }
  }
  return deck;
}

export function shuffle<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export function initializeGame(playerNames: string[]): GameState {
  let deck = createDeck();
  // For 3-5 players, use 2 decks (as per PRD)
  if (playerNames.length >= 3) {
    deck = [...deck, ...createDeck()];
    // Re-assign IDs to be unique across both decks
    deck = deck.map((card, index) => ({ ...card, id: `${card.id}-${index}` }));
  }
  deck = shuffle(deck);

  const players: Player[] = playerNames.map((name, index) => ({
    id: `player-${index}`,
    name,
    hand: [],
    faceUp: [],
    faceDown: [],
  }));

  // Initial deal: 3 face-down, 3 face-up, 3 in hand
  // Actually, standard Castle might vary, but PRD says:
  // "following a guided 'Dealing' sequence (placing face-down and face-up cards)"
  // "hand to be automatically refilled to 3 cards after every turn"
  // Usually it's 3 face down, 3 face up, and 3 in hand.

  for (let i = 0; i < 3; i++) {
    for (const player of players) {
      player.faceDown.push(deck.pop()!);
    }
  }

  for (let i = 0; i < 3; i++) {
    for (const player of players) {
      player.faceUp.push(deck.pop()!);
    }
  }

  for (let i = 0; i < 3; i++) {
    for (const player of players) {
      player.hand.push(deck.pop()!);
    }
  }

  return {
    deck,
    discardPile: [],
    players,
    currentPlayerIndex: 0,
    phase: 'DEALING',
  };
}

export function swapCards(state: GameState, handCardId: string, faceUpCardId: string): GameState {
  if (state.phase !== 'DEALING') throw new Error('Can only swap cards during DEALING phase');

  const newState = JSON.parse(JSON.stringify(state)) as GameState;
  const player = newState.players[newState.currentPlayerIndex];

  const handCardIndex = player.hand.findIndex(c => c.id === handCardId);
  const faceUpCardIndex = player.faceUp.findIndex(c => c.id === faceUpCardId);

  if (handCardIndex === -1 || faceUpCardIndex === -1) throw new Error('Card not found');

  const handCard = player.hand[handCardIndex];
  const faceUpCard = player.faceUp[faceUpCardIndex];

  player.hand[handCardIndex] = faceUpCard;
  player.faceUp[faceUpCardIndex] = handCard;

  return newState;
}

export function setReady(state: GameState, playerId: string): GameState {
  const newState = JSON.parse(JSON.stringify(state)) as GameState;
  const player = newState.players.find(p => p.id === playerId);
  if (player) {
    player.isReady = true;
  }

  if (newState.players.every(p => p.isReady)) {
    newState.phase = 'PLAYING';
    // Reset ready flags for future use if needed
    newState.players.forEach(p => p.isReady = false);
  }

  return newState;
}

export function canPlayCard(cardRank: Rank, topCard: Card | undefined, lastMoveEffect?: GameState['lastMoveEffect']): boolean {
  if (cardRank === 2 || cardRank === 7 || cardRank === 10) return true;
  if (!topCard || lastMoveEffect === 'RESET' || lastMoveEffect === 'BURN') return true;

  if (lastMoveEffect === 'LOWER_THAN_SEVEN') {
    return cardRank <= 7;
  }

  return cardRank >= topCard.rank;
}

export function playCards(state: GameState, cardIds: string[], source: 'hand' | 'faceUp' | 'faceDown' = 'hand'): GameState {
  const newState = JSON.parse(JSON.stringify(state)) as GameState;
  const player = newState.players[newState.currentPlayerIndex];

  let cardsToPlay: Card[] = [];
  if (source === 'hand') {
    cardsToPlay = player.hand.filter(c => cardIds.includes(c.id));
  } else if (source === 'faceUp') {
    if (player.hand.length > 0) throw new Error('Cannot play face-up cards while you have cards in hand');
    cardsToPlay = player.faceUp.filter(c => cardIds.includes(c.id));
  } else if (source === 'faceDown') {
    if (player.hand.length > 0 || player.faceUp.length > 0) throw new Error('Cannot play face-down cards while you have cards in hand or face-up');
    cardsToPlay = player.faceDown.filter(c => cardIds.includes(c.id));
  }

  // Validation: all cards must have the same rank
  const firstRank = cardsToPlay[0].rank;
  if (!cardsToPlay.every(c => c.rank === firstRank)) {
    throw new Error('All played cards must have the same rank');
  }

  const topCard = newState.discardPile[newState.discardPile.length - 1];
  if (!canPlayCard(firstRank, topCard, newState.lastMoveEffect)) {
    if (source === 'faceDown') {
      // Blind play failed: must pick up the pile including the failed card
      player.hand.push(...cardsToPlay);
      player.faceDown = player.faceDown.filter(c => !cardIds.includes(c.id));
      const stateAfterPickup = pickUpPile(newState); // pickUpPile will increment currentPlayerIndex
      return stateAfterPickup;
    }
    throw new Error('Invalid move: card rank too low');
  }

  // Remove cards from source
  if (source === 'hand') {
    player.hand = player.hand.filter(c => !cardIds.includes(c.id));
  } else if (source === 'faceUp') {
    player.faceUp = player.faceUp.filter(c => !cardIds.includes(c.id));
  } else if (source === 'faceDown') {
    player.faceDown = player.faceDown.filter(c => !cardIds.includes(c.id));
  }

  // Add to discard pile
  newState.discardPile.push(...cardsToPlay);

  // Handle special effects (Phase 3 will expand this)
  newState.lastMoveEffect = undefined;
  if (firstRank === 2) {
    newState.lastMoveEffect = 'RESET';
  } else if (firstRank === 7) {
    newState.lastMoveEffect = 'LOWER_THAN_SEVEN';
  } else if (firstRank === 10) {
    newState.lastMoveEffect = 'BURN';
    newState.discardPile = [];
  }

  // Refill hand
  while (player.hand.length < 3 && newState.deck.length > 0) {
    player.hand.push(newState.deck.pop()!);
  }

  // Next player (unless it was a 10)
  if (firstRank !== 10) {
    newState.currentPlayerIndex = (newState.currentPlayerIndex + 1) % newState.players.length;
  }
  // Note: if 10 is played, currentPlayerIndex stays the same, they play again.

  // Check win condition
  if (player.hand.length === 0 && player.faceUp.length === 0 && player.faceDown.length === 0) {
    newState.phase = 'GAME_OVER';
    newState.winner = player.id;
  }

  return newState;
}

export function pickUpPile(state: GameState): GameState {
  const newState = JSON.parse(JSON.stringify(state)) as GameState;
  const player = newState.players[newState.currentPlayerIndex];

  player.hand.push(...newState.discardPile);
  newState.discardPile = [];
  newState.lastMoveEffect = undefined;

  newState.currentPlayerIndex = (newState.currentPlayerIndex + 1) % newState.players.length;

  return newState;
}
