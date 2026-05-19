
import { useEffect, useState, useCallback, useRef } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { GameState, playCards, pickUpPile, initializeGame, swapCards, setReady } from '@/lib/game-logic';

export type Message =
  | { type: 'STATE_UPDATE', state: GameState }
  | { type: 'PLAY_CARDS', cardIds: string[], source: 'hand' | 'faceUp' | 'faceDown' }
  | { type: 'PICK_UP_PILE' }
  | { type: 'JOIN_GAME', playerName: string }
  | { type: 'START_GAME' }
  | { type: 'SWAP_CARDS', handCardId: string, faceUpCardId: string }
  | { type: 'SET_READY', playerId: string };

export interface PeerPlayer {
  id: string;
  name: string;
  conn?: DataConnection;
}

export function useGame(isHost: boolean, roomId?: string, playerName?: string) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [peerId, setPeerId] = useState<string>('');
  const [players, setPlayers] = useState<PeerPlayer[]>([]);
  const peerRef = useRef<Peer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const connectionsRef = useRef<Map<string, DataConnection>>(new Map());

  const broadcastState = useCallback((state: GameState) => {
    connectionsRef.current.forEach(conn => {
      if (conn.open) {
        conn.send({ type: 'STATE_UPDATE', state });
      }
    });
    setGameState(state);
  }, []);

  const handleAction = useCallback((msg: Message) => {
    setGameState((currentState) => {
      if (!isHost || !currentState) return currentState;

      let nextState = currentState;
      try {
        if (msg.type === 'PLAY_CARDS') {
          nextState = playCards(currentState, msg.cardIds, msg.source);
        } else if (msg.type === 'PICK_UP_PILE') {
          nextState = pickUpPile(currentState);
        } else if (msg.type === 'SWAP_CARDS') {
          nextState = swapCards(currentState, msg.handCardId, msg.faceUpCardId);
        } else if (msg.type === 'SET_READY') {
          nextState = setReady(currentState, msg.playerId);
        }

        if (nextState !== currentState) {
          // Delay broadcast to outside of setGameState
          const updatedState = nextState;
          setTimeout(() => broadcastState(updatedState), 0);
        }
      } catch (e) {
        console.error(e);
      }
      return nextState;
    });
  }, [isHost, broadcastState]);

  useEffect(() => {
    const peer = new Peer(isHost ? roomId : undefined);
    peerRef.current = peer;

    peer.on('open', (id) => {
      setPeerId(id);
      if (isHost && playerName) {
        setPlayers([{ id, name: playerName }]);
      }
    });

    peer.on('error', (err) => {
      setError(err.message);
    });

    if (isHost) {
      peer.on('connection', (conn) => {
        conn.on('open', () => {
          connectionsRef.current.set(conn.peer, conn);
        });

        conn.on('data', (data: unknown) => {
          const msg = data as Message;
          if (msg.type === 'JOIN_GAME') {
            setPlayers(prev => {
              if (prev.find(p => p.id === conn.peer)) return prev;
              return [...prev, { id: conn.peer, name: msg.playerName }];
            });
          } else {
            handleAction(msg);
          }
        });

        conn.on('close', () => {
          connectionsRef.current.delete(conn.peer);
          setPlayers(prev => prev.filter(p => p.id !== conn.peer));
        });
      });
    } else if (roomId) {
      const conn = peer.connect(roomId);
      conn.on('open', () => {
        connectionsRef.current.set(roomId, conn);
        conn.send({ type: 'JOIN_GAME', playerName: playerName || 'Player' });
      });
      conn.on('data', (data: unknown) => {
        const msg = data as Message;
        if (msg.type === 'STATE_UPDATE') {
          setGameState(msg.state);
        }
      });
    }

    return () => {
      peer.destroy();
    };
  }, [isHost, roomId, playerName, handleAction]);

  const performMove = (action: Message) => {
    if (isHost) {
      handleAction(action);
    } else {
      const hostConn = connectionsRef.current.get(roomId || '');
      hostConn?.send(action);
    }
  };

  const startGame = () => {
    if (isHost && players.length >= 2) {
      const initialState = initializeGame(players.map(p => p.name));
      // Re-map players to include their Peer ID
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
    error
  };
}
