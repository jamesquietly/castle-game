import { describe, it, expect } from "vitest";
import {
  createDeck,
  initializeGame,
  playCards,
  pickUpPile,
  swapCards,
  setReady,
} from "./game-logic";

describe("game-logic", () => {
  it("should create a deck of 52 cards", () => {
    const deck = createDeck();
    expect(deck.length).toBe(52);
  });

  it("should initialize a 2-player game correctly", () => {
    const players = ["Alice", "Bob"];
    const state = initializeGame(players);

    expect(state.players.length).toBe(2);
    expect(state.players[0].hand.length).toBe(3);
    expect(state.players[0].faceUp.length).toBe(3);
    expect(state.players[0].faceDown.length).toBe(3);

    // 52 - (2 players * 9 cards each) = 52 - 18 = 34
    expect(state.deck.length).toBe(34);
    expect(state.discardPile.length).toBe(0);
    expect(state.phase).toBe("DEALING");
  });

  it("should initialize a 3-player game with 2 decks", () => {
    const players = ["Alice", "Bob", "Charlie"];
    const state = initializeGame(players);

    expect(state.players.length).toBe(3);
    // 104 - (3 players * 9 cards each) = 104 - 27 = 77
    expect(state.deck.length).toBe(77);
  });

  it("should allow swapping cards and getting ready", () => {
    const state = initializeGame(["Alice", "Bob"]);
    const aliceHandCard = state.players[0].hand[0];
    const aliceFaceUpCard = state.players[0].faceUp[0];

    // Alice swaps
    const state1 = swapCards(
      state,
      state.players[0].id,
      aliceHandCard.id,
      aliceFaceUpCard.id,
    );
    expect(state1.players[0].hand[0].id).toBe(aliceFaceUpCard.id);
    expect(state1.players[0].faceUp[0].id).toBe(aliceHandCard.id);

    // Bob swaps
    const bobHandCard = state.players[1].hand[0];
    const bobFaceUpCard = state.players[1].faceUp[0];
    const state2 = swapCards(
      state1,
      state.players[1].id,
      bobHandCard.id,
      bobFaceUpCard.id,
    );
    expect(state2.players[1].hand[0].id).toBe(bobFaceUpCard.id);
    expect(state2.players[1].faceUp[0].id).toBe(bobHandCard.id);

    const state3 = setReady(state2, state.players[0].id);
    expect(state3.phase).toBe("DEALING");

    const state4 = setReady(state3, state.players[1].id);
    expect(state4.phase).toBe("PLAYING");
  });

  it("should allow playing a valid card and refill hand", () => {
    const state = initializeGame(["Alice", "Bob"]);
    state.phase = "PLAYING";
    const player = state.players[0];
    // Force a non-2, non-10 card to ensure turn advances
    player.hand[0] = { suit: "HEARTS", rank: 5, id: "H5" };
    const cardToPlay = player.hand[0];

    const newState = playCards(state, [cardToPlay.id]);

    expect(newState.discardPile.length).toBe(1);
    expect(newState.discardPile[0].id).toBe(cardToPlay.id);
    expect(newState.players[0].hand.length).toBe(3); // Refilled from deck
    expect(newState.currentPlayerIndex).toBe(1);
  });

  it("should allow playing multiple cards of same rank", () => {
    const state = initializeGame(["Alice", "Bob"]);
    state.phase = "PLAYING";
    const player = state.players[0];
    // Force two cards of same rank for testing
    player.hand[0] = { suit: "HEARTS", rank: 5, id: "H5" };
    player.hand[1] = { suit: "CLUBS", rank: 5, id: "C5" };

    const newState = playCards(state, ["H5", "C5"]);

    expect(newState.discardPile.length).toBe(2);
    expect(newState.players[0].hand.length).toBe(3);
  });

  it("should throw error when playing lower rank card", () => {
    const state = initializeGame(["Alice", "Bob"]);
    state.phase = "PLAYING";
    state.discardPile = [{ suit: "HEARTS", rank: 8, id: "H8" }];
    const player = state.players[0];
    player.hand[0] = { suit: "CLUBS", rank: 5, id: "C5" };

    expect(() => playCards(state, ["C5"])).toThrow(
      "Invalid move: card rank too low",
    );
  });

  it("should allow picking up the pile", () => {
    const state = initializeGame(["Alice", "Bob"]);
    state.phase = "PLAYING";
    state.discardPile = [
      { suit: "HEARTS", rank: 8, id: "H8" },
      { suit: "CLUBS", rank: 9, id: "C9" },
    ];

    const newState = pickUpPile(state);

    expect(newState.discardPile.length).toBe(0);
    expect(newState.players[0].hand.some((c) => c.id === "H8")).toBe(true);
    expect(newState.players[0].hand.some((c) => c.id === "C9")).toBe(true);
    expect(newState.currentPlayerIndex).toBe(1);
  });

  it("should handle 2 (Reset) correctly", () => {
    const state = initializeGame(["Alice", "Bob"]);
    state.phase = "PLAYING";
    state.discardPile = [{ suit: "HEARTS", rank: 14, id: "HA" }];
    const player = state.players[0];
    player.hand[0] = { suit: "CLUBS", rank: 2, id: "C2" };

    const newState = playCards(state, ["C2"]);

    expect(newState.lastMoveEffect).toBe("RESET");
    expect(newState.currentPlayerIndex).toBe(0); // Alice plays again

    // Alice should be able to play any card now
    newState.players[0].hand[0] = { suit: "SPADES", rank: 5, id: "S5" };
    const aliceCard = newState.players[0].hand[0];
    const finalState = playCards(newState, [aliceCard.id]);
    expect(finalState.currentPlayerIndex).toBe(1); // Now it's Bob's turn
  });

  it("should handle 7 (Lower Than Seven) correctly", () => {
    const state = initializeGame(["Alice", "Bob"]);
    state.phase = "PLAYING";
    state.discardPile = [{ suit: "HEARTS", rank: 8, id: "H8" }];
    const player = state.players[0];
    player.hand[0] = { suit: "CLUBS", rank: 7, id: "C7" };

    const newState = playCards(state, ["C7"]);

    expect(newState.lastMoveEffect).toBe("LOWER_THAN_SEVEN");

    const bob = newState.players[1];
    bob.hand[0] = { suit: "SPADES", rank: 8, id: "S8" };
    bob.hand[1] = { suit: "SPADES", rank: 6, id: "S6" };
    // Make sure bob doesn't have other cards that might interfere (initializeGame gives 3 cards)
    bob.hand = [
      { suit: "SPADES", rank: 8, id: "S8" },
      { suit: "SPADES", rank: 6, id: "S6" },
    ];

    expect(() => playCards(newState, ["S8"])).toThrow(
      "Invalid move: card rank too low",
    );
    const finalState = playCards(newState, ["S6"]);
    expect(finalState.currentPlayerIndex).toBe(0);
  });

  it("should handle 10 (Burn) correctly", () => {
    const state = initializeGame(["Alice", "Bob"]);
    state.phase = "PLAYING";
    state.discardPile = [{ suit: "HEARTS", rank: 14, id: "HA" }];
    const player = state.players[0];
    player.hand[0] = { suit: "CLUBS", rank: 10, id: "C10" };

    const newState = playCards(state, ["C10"]);

    expect(newState.discardPile.length).toBe(0); // Burned
    expect(newState.currentPlayerIndex).toBe(1); // Turn moves to Bob
  });

  it("should transition to face-up cards when hand and deck are empty", () => {
    const state = initializeGame(["Alice", "Bob"]);
    state.phase = "PLAYING";
    state.deck = [];
    state.players[0].hand = [];
    state.players[0].faceUp = [{ suit: "HEARTS", rank: 14, id: "HA" }];

    const newState = playCards(state, ["HA"], "faceUp");

    expect(newState.discardPile[newState.discardPile.length - 1].id).toBe("HA");
    expect(newState.players[0].faceUp.length).toBe(0);
  });

  it("should handle blind face-down play success", () => {
    const state = initializeGame(["Alice", "Bob"]);
    state.phase = "PLAYING";
    state.deck = [];
    state.players[0].hand = [];
    state.players[0].faceUp = [];
    state.players[0].faceDown = [{ suit: "HEARTS", rank: 14, id: "HA" }];
    state.discardPile = [{ suit: "CLUBS", rank: 5, id: "C5" }];

    const newState = playCards(state, ["HA"], "faceDown");

    expect(newState.discardPile[newState.discardPile.length - 1].id).toBe("HA");
    expect(newState.players[0].faceDown.length).toBe(0);
  });

  it("should handle blind face-down play failure", () => {
    const state = initializeGame(["Alice", "Bob"]);
    state.phase = "PLAYING";
    state.deck = [];
    state.players[0].hand = [];
    state.players[0].faceUp = [];
    state.players[0].faceDown = [{ suit: "HEARTS", rank: 3, id: "H3" }];
    state.discardPile = [{ suit: "CLUBS", rank: 5, id: "C5" }];

    const newState = playCards(state, ["H3"], "faceDown");

    expect(newState.discardPile.length).toBe(0); // Alice picked up the pile
    expect(newState.players[0].hand.length).toBe(2); // C5 and H3
    expect(newState.players[0].faceDown.length).toBe(0);
    expect(newState.currentPlayerIndex).toBe(1);
  });

  it("should detect win condition", () => {
    const state = initializeGame(["Alice", "Bob"]);
    state.phase = "PLAYING";
    state.deck = [];
    state.players[0].hand = [];
    state.players[0].faceUp = [];
    state.players[0].faceDown = [{ suit: "HEARTS", rank: 14, id: "HA" }];

    const newState = playCards(state, ["HA"], "faceDown");

    expect(newState.phase).toBe("GAME_OVER");
    expect(newState.winner).toBe(state.players[0].id);
  });

  it("should reset the game correctly", () => {
    const players = ["Alice", "Bob"];
    const state = initializeGame(players);
    state.phase = "GAME_OVER";
    state.winner = "Alice";

    // To reset, we just call initializeGame again
    const newState = initializeGame(players);
    expect(newState.phase).toBe("DEALING");
    expect(newState.discardPile.length).toBe(0);
    expect(newState.players[0].hand.length).toBe(3);
  });
});
