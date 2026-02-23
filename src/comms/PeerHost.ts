import Peer, { type DataConnection } from "peerjs";
import type {
  ControlMessage,
  DisplayMessage,
  AudienceMessage,
  AudienceResponse,
  HelloMessage,
  FullState,
} from "./messages";

export interface PeerHostCallbacks {
  onControlMessage: (msg: ControlMessage) => void;
  onAudienceMessage: (conn: DataConnection, msg: AudienceMessage) => void;
  onControllerConnected: () => FullState;
  onControllerDisconnected: () => void;
  onCodeReady: (code: string) => void;
}

function generateCode(): string {
  return String(1000 + Math.floor(Math.random() * 9000));
}

export class PeerHost {
  private peer: Peer | null = null;
  private controllerConn: DataConnection | null = null;
  private audienceConns = new Map<string, DataConnection>();
  private callbacks: PeerHostCallbacks;
  private code = "";

  constructor(callbacks: PeerHostCallbacks) {
    this.callbacks = callbacks;
  }

  start(): void {
    this.code = generateCode();
    this.tryConnect();
  }

  private tryConnect(): void {
    const peerId = `rave-${this.code}`;
    this.peer = new Peer(peerId);

    this.peer.on("open", () => {
      this.callbacks.onCodeReady(this.code);
    });

    this.peer.on("connection", (conn) => {
      this.handleConnection(conn);
    });

    this.peer.on("error", (err) => {
      if (err.type === "unavailable-id") {
        // Code collision — try a new code
        this.peer?.destroy();
        this.code = generateCode();
        this.tryConnect();
      } else {
        console.error("[PeerHost] Error:", err);
      }
    });
  }

  private handleConnection(conn: DataConnection): void {
    let identified = false;

    conn.on("data", (raw) => {
      const data = raw as HelloMessage | ControlMessage | AudienceMessage;

      if (!identified && (data as HelloMessage).type === "hello") {
        identified = true;
        const hello = data as HelloMessage;

        if (hello.role === "controller") {
          // Replace existing controller
          if (this.controllerConn) {
            this.controllerConn.close();
          }
          this.controllerConn = conn;

          conn.on("close", () => {
            if (this.controllerConn === conn) {
              this.controllerConn = null;
              this.callbacks.onControllerDisconnected();
            }
          });

          // Send full state sync
          const state = this.callbacks.onControllerConnected();
          this.sendToController({ type: "stateSync", state });
        } else if (hello.role === "audience") {
          const deviceId = hello.deviceId ?? conn.peer;
          this.audienceConns.set(deviceId, conn);

          conn.on("close", () => {
            this.audienceConns.delete(deviceId);
          });
        }
        return;
      }

      if (this.controllerConn === conn) {
        this.callbacks.onControlMessage(data as ControlMessage);
      } else {
        // Find the audience device ID
        this.callbacks.onAudienceMessage(conn, data as AudienceMessage);
      }
    });
  }

  sendToController(msg: DisplayMessage): void {
    if (this.controllerConn?.open) {
      this.controllerConn.send(msg);
    }
  }

  sendToAudience(conn: DataConnection, msg: AudienceResponse): void {
    if (conn.open) {
      conn.send(msg);
    }
  }

  broadcastToAudience(msg: AudienceResponse): void {
    for (const conn of this.audienceConns.values()) {
      if (conn.open) {
        conn.send(msg);
      }
    }
  }

  getAudienceCount(): number {
    return this.audienceConns.size;
  }

  getCode(): string {
    return this.code;
  }

  isControllerConnected(): boolean {
    return this.controllerConn?.open === true;
  }

  destroy(): void {
    this.controllerConn?.close();
    for (const conn of this.audienceConns.values()) {
      conn.close();
    }
    this.audienceConns.clear();
    this.peer?.destroy();
    this.peer = null;
  }
}
