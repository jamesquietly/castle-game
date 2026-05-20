import { useEffect, useState, useCallback, useRef } from "react";
import Peer, { DataConnection } from "peerjs";
import {
  GameState,
  playCards,
  pickUpPile,
  initializeGame,
  swapCards,
  setReady,
} from "@/lib/game-logic";

export type Message =
  | { type: "STATE_UPDATE"; state: GameState }
  | {
      type: "PLAY_CARDS";
      cardIds: string[];
      source: "hand" | "faceUp" | "faceDown";
    }
  | { type: "PICK_UP_PILE" }
  | { type: "JOIN_GAME"; playerName: string }
  | { type: "START_GAME" }
  | {
      type: "SWAP_CARDS";
      playerId: string;
      handCardId: string;
      faceUpCardId: string;
    }
  | { type: "SET_READY"; playerId: string }
  | { type: "LOBBY_UPDATE"; players: { id: string; name: string }[] }
  | { type: "RESET_GAME" };

export interface PeerPlayer {
  id: string;
  name: string;
  conn?: DataConnection;
}

export function useGame(isHost: boolean, roomId?: string, playerName?: string) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [peerId, setPeerId] = useState<string>("");
  const [players, setPlayers] = useState<PeerPlayer[]>([]);
  const peerRef = useRef<Peer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const connectionsRef = useRef<Map<string, DataConnection>>(new Map());
  const playersRef = useRef<PeerPlayer[]>([]);

  const isHostRef = useRef(isHost);
  const roomIdRef = useRef(roomId);
  const playerNameRef = useRef(playerName);

  useEffect(() => {
    isHostRef.current = isHost;
    roomIdRef.current = roomId;
    playerNameRef.current = playerName;
  }, [isHost, roomId, playerName]);

  const broadcastToAll = useCallback((msg: Message) => {
    connectionsRef.current.forEach((conn) => {
      if (conn.open) {
        conn.send(msg);
      }
    });
  }, []);

  const broadcastState = useCallback(
    (state: GameState) => {
      broadcastToAll({ type: "STATE_UPDATE", state });
      setGameState(state);
    },
    [broadcastToAll],
  );

  const handleAction = useCallback(
    (msg: Message) => {
      setGameState((currentState) => {
        if (!isHostRef.current || !currentState) return currentState;

        let nextState = currentState;
        try {
          if (msg.type === "PLAY_CARDS") {
            nextState = playCards(currentState, msg.cardIds, msg.source);
          } else if (msg.type === "PICK_UP_PILE") {
            nextState = pickUpPile(currentState);
          } else if (msg.type === "SWAP_CARDS") {
            nextState = swapCards(
              currentState,
              msg.playerId,
              msg.handCardId,
              msg.faceUpCardId,
            );
          } else if (msg.type === "SET_READY") {
            nextState = setReady(currentState, msg.playerId);
          } else if (msg.type === "RESET_GAME") {
            const names = playersRef.current.map((p) => p.name);
            nextState = initializeGame(names);
            nextState.players.forEach((p, i) => {
              p.id = playersRef.current[i].id;
            });
          }

          if (nextState !== currentState) {
            const updatedState = nextState;
            setTimeout(() => broadcastState(updatedState), 0);
          }
        } catch (e) {
          console.error(e);
        }
        return nextState;
      });
    },
    [broadcastState],
  );

  useEffect(() => {
    const peer = new Peer(isHost ? roomId || "" : "");
    peerRef.current = peer;

    peer.on("open", (id) => {
      setPeerId(id);
      if (isHostRef.current && playerNameRef.current) {
        const initialPlayers = [{ id, name: playerNameRef.current }];
        setPlayers(initialPlayers);
        playersRef.current = initialPlayers;
      }
    });

    peer.on("error", (err) => {
      setError(err.message);
    });

    if (isHost) {
      peer.on("connection", (conn) => {
        conn.on("open", () => {
          connectionsRef.current.set(conn.peer, conn);
        });

        conn.on("data", (data: unknown) => {
          const msg = data as Message;
          if (msg.type === "JOIN_GAME") {
            const currentPlayers = playersRef.current;
            if (!currentPlayers.find((p) => p.id === conn.peer)) {
              const newPlayers = [
                ...currentPlayers,
                { id: conn.peer, name: msg.playerName },
              ];
              playersRef.current = newPlayers;
              setPlayers(newPlayers);

              broadcastToAll({
                type: "LOBBY_UPDATE",
                players: newPlayers.map((p) => ({ id: p.id, name: p.name })),
              });
            }
          } else {
            handleAction(msg);
          }
        });

        conn.on("close", () => {
          connectionsRef.current.delete(conn.peer);
          const newPlayers = playersRef.current.filter(
            (p) => p.id !== conn.peer,
          );
          playersRef.current = newPlayers;
          setPlayers(newPlayers);
          broadcastToAll({
            type: "LOBBY_UPDATE",
            players: newPlayers.map((p) => ({ id: p.id, name: p.name })),
          });
        });
      });
    } else if (roomId) {
      const connectToHost = () => {
        if (!peerRef.current || peerRef.current.destroyed) return;
        const conn = peerRef.current.connect(roomId);
        conn.on("open", () => {
          connectionsRef.current.set(roomId, conn);
          conn.send({
            type: "JOIN_GAME",
            playerName: playerNameRef.current || "Player",
          });
        });
        conn.on("data", (data: unknown) => {
          const msg = data as Message;
          if (msg.type === "STATE_UPDATE") {
            setGameState(msg.state);
          } else if (msg.type === "LOBBY_UPDATE") {
            setPlayers(msg.players);
          }
        });
        conn.on("close", () => {
          setTimeout(connectToHost, 1000);
        });
      };

      setTimeout(connectToHost, 1000);
    }

    return () => {
      peer.destroy();
    };
  }, [isHost, roomId, handleAction, broadcastToAll]);

  const performMove = (action: Message) => {
    if (isHost) {
      handleAction(action);
    } else {
      const hostConn = connectionsRef.current.get(roomId || "");
      hostConn?.send(action);
    }
  };

  const startGame = () => {
    if (isHost && players.length >= 2) {
      const initialState = initializeGame(players.map((p) => p.name));
      initialState.players.forEach((p, i) => {
        p.id = players[i].id;
      });
      broadcastState(initialState);
    }
  };

  return {
    gameState,
    peerId,
    players,
    performMove,
    startGame,
    error,
  };
}
