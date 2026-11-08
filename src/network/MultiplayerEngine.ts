// src/network/MultiplayerEngine.ts
// Apex Grand Prix: High-Performance Multiplayer Networking Engine
// WebSocket / State Synchronization / Client-Side Prediction / Server Reconciliation

export type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ERROR';

export interface NetworkVehicleState {
  x: number;
  y: number;
  z: number;
  rotY: number;
  speedKph: number;
  steer: number;
  throttle: number;
  brake: number;
  nitro: boolean;
  lap: number;
  sector: number;
  timestamp: number;
}

export interface NetworkRacer {
  id: string;
  name: string;
  carId: string;
  liveryIndex: number;
  ready: boolean;
  pingMs: number;
  state: NetworkVehicleState;
  // Interpolation buffer for remote smoothing
  targetState?: NetworkVehicleState;
  prevState?: NetworkVehicleState;
  interpAlpha?: number;
}

export interface RoomSnapshot {
  roomId: string;
  name: string;
  trackId: string;
  status: 'LOBBY' | 'STARTING' | 'RACING' | 'FINISHED';
  playerCount: number;
  maxPlayers: number;
  countdown: number;
  players: NetworkRacer[];
}

export class MultiplayerEngine {
  private ws: WebSocket | null = null;
  private url: string;
  private status: ConnectionStatus = 'DISCONNECTED';
  private playerId: string | null = null;
  private currentRoom: RoomSnapshot | null = null;
  private remoteRacers: Map<string, NetworkRacer> = new Map();
  private pingMs: number = 0;
  private pingInterval: number | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private onStatusChangeCallbacks: ((status: ConnectionStatus) => void)[] = [];
  private onRoomUpdateCallbacks: ((room: RoomSnapshot) => void)[] = [];
  private onRaceStartCallbacks: ((startTime: number) => void)[] = [];

  constructor(serverUrl?: string) {
    if (serverUrl) {
      this.url = serverUrl;
    } else if (typeof window !== 'undefined') {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      this.url = `${proto}//${window.location.host}`;
    } else {
      this.url = 'ws://localhost:8080';
    }
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public getPlayerId(): string | null {
    return this.playerId;
  }

  public getCurrentRoom(): RoomSnapshot | null {
    return this.currentRoom;
  }

  public getRemoteRacers(): NetworkRacer[] {
    return Array.from(this.remoteRacers.values());
  }

  public getPing(): number {
    return this.pingMs;
  }

  public connect(): void {
    if (typeof WebSocket === 'undefined') return;
    if (this.status === 'CONNECTED' || this.status === 'CONNECTING') return;

    this.setStatus('CONNECTING');
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.setStatus('CONNECTED');
        this.reconnectAttempts = 0;
        this.startPingLoop();
        this.send({ type: 'LIST_ROOMS' });
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onclose = () => {
        this.setStatus('DISCONNECTED');
        this.stopPingLoop();
        this.attemptReconnect();
      };

      this.ws.onerror = () => {
        this.setStatus('ERROR');
      };
    } catch {
      this.setStatus('ERROR');
      this.attemptReconnect();
    }
  }

  public disconnect(): void {
    this.stopPingLoop();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('DISCONNECTED');
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    this.reconnectAttempts++;
    this.setStatus('RECONNECTING');
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    for (const cb of this.onStatusChangeCallbacks) {
      cb(status);
    }
  }

  private startPingLoop(): void {
    this.stopPingLoop();
    this.pingInterval = (setInterval(() => {
      if (this.status === 'CONNECTED') {
        this.send({ type: 'PING', clientTime: Date.now() });
      }
    }, 2000) as unknown) as number;
  }

  private stopPingLoop(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  public send(payload: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private handleMessage(raw: string): void {
    try {
      const msg = JSON.parse(raw);
      switch (msg.type) {
        case 'CONNECTED':
          this.playerId = msg.playerId;
          break;

        case 'PONG':
          this.pingMs = Math.max(1, Date.now() - msg.clientTime);
          break;

        case 'ROOM_JOINED':
        case 'ROOM_UPDATE':
          this.currentRoom = msg.room;
          this.syncRacersList(msg.room.players);
          for (const cb of this.onRoomUpdateCallbacks) cb(msg.room);
          break;

        case 'COUNTDOWN':
          if (this.currentRoom) {
            this.currentRoom.countdown = msg.countdown;
            for (const cb of this.onRoomUpdateCallbacks) cb(this.currentRoom);
          }
          break;

        case 'RACE_START':
          for (const cb of this.onRaceStartCallbacks) cb(msg.startTime);
          break;

        case 'SYNC':
          this.applyServerSync(msg.racers);
          break;
      }
    } catch {}
  }

  private syncRacersList(players: NetworkRacer[]): void {
    const activeIds = new Set<string>();
    for (const p of players) {
      if (p.id === this.playerId) continue;
      activeIds.add(p.id);
      const existing = this.remoteRacers.get(p.id);
      if (existing) {
        existing.ready = p.ready;
        existing.carId = p.carId;
        existing.liveryIndex = p.liveryIndex;
      } else {
        this.remoteRacers.set(p.id, {
          ...p,
          targetState: { ...p.state },
          prevState: { ...p.state },
          interpAlpha: 0,
        });
      }
    }
    // Remove disconnected
    for (const id of this.remoteRacers.keys()) {
      if (!activeIds.has(id)) {
        this.remoteRacers.delete(id);
      }
    }
  }

  /**
   * Applies authoritative 60Hz server tick state to remote racers with interpolation buffering.
   */
  private applyServerSync(racers: { id: string; state: NetworkVehicleState }[]): void {
    for (const r of racers) {
      if (r.id === this.playerId) continue;
      const racer = this.remoteRacers.get(r.id);
      if (racer) {
        racer.prevState = { ...racer.state };
        racer.targetState = { ...r.state };
        racer.interpAlpha = 0;
      }
    }
  }

  /**
   * Client-side predictive interpolation step for remote racers (called every render frame).
   */
  public updateRemoteRacers(deltaSec: number): void {
    for (const racer of this.remoteRacers.values()) {
      if (!racer.targetState || !racer.prevState) continue;
      // Hermite / Lerp smoothing towards authoritative server state
      racer.interpAlpha = Math.min(1.0, (racer.interpAlpha || 0) + deltaSec * 15.0);
      const alpha = racer.interpAlpha;

      racer.state.x = racer.prevState.x + (racer.targetState.x - racer.prevState.x) * alpha;
      racer.state.y = racer.prevState.y + (racer.targetState.y - racer.prevState.y) * alpha;
      racer.state.z = racer.prevState.z + (racer.targetState.z - racer.prevState.z) * alpha;
      racer.state.rotY = racer.prevState.rotY + (racer.targetState.rotY - racer.prevState.rotY) * alpha;
      racer.state.speedKph = racer.prevState.speedKph + (racer.targetState.speedKph - racer.prevState.speedKph) * alpha;
      racer.state.steer = racer.targetState.steer;
      racer.state.nitro = racer.targetState.nitro;
    }
  }

  /**
   * Transmits local vehicle telemetry state to dedicated server.
   */
  public sendLocalState(state: NetworkVehicleState): void {
    if (this.status === 'CONNECTED' && this.currentRoom?.status === 'RACING') {
      this.send({
        type: 'UPDATE_STATE',
        state,
      });
    }
  }

  public joinRoom(roomId: string, carId: string, liveryIndex: number): void {
    this.send({ type: 'JOIN_ROOM', roomId, carId, liveryIndex });
  }

  public setReady(ready: boolean, carId: string, liveryIndex: number): void {
    this.send({ type: 'SET_READY', ready, carId, liveryIndex });
  }

  public onStatusChange(cb: (status: ConnectionStatus) => void): () => void {
    this.onStatusChangeCallbacks.push(cb);
    return () => {
      this.onStatusChangeCallbacks = this.onStatusChangeCallbacks.filter((c) => c !== cb);
    };
  }

  public onRoomUpdate(cb: (room: RoomSnapshot) => void): () => void {
    this.onRoomUpdateCallbacks.push(cb);
    return () => {
      this.onRoomUpdateCallbacks = this.onRoomUpdateCallbacks.filter((c) => c !== cb);
    };
  }

  public onRaceStart(cb: (startTime: number) => void): () => void {
    this.onRaceStartCallbacks.push(cb);
    return () => {
      this.onRaceStartCallbacks = this.onRaceStartCallbacks.filter((c) => c !== cb);
    };
  }
}

export const multiplayer = new MultiplayerEngine();
