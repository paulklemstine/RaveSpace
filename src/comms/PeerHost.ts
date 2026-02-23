import Peer from "peerjs";
import type { DataConnection } from "peerjs";
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
  onAudienceCallout: (
    conn: DataConnection,
    name: string,
  ) => AudienceResponse;
  onControllerConnected: () => FullState;
  onControllerDisconnected: () => void;
  onCodeReady: (code: string) => void;
}

function generateCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export class PeerHost {
  private peer: Peer | null = null;
  private controllerConn: DataConnection | null = null;
  private audienceConns = new Set<DataConnection>();
  private callbacks: PeerHostCallbacks;
  private code = "";

  constructor(callbacks: PeerHostCallbacks) {
    this.callbacks = callbacks;
  }

  start(): void {
    this.code = generateCode();
    this.tryRegister();
  }

  private tryRegister(): void {
    const peerId = `rave-${this.code}`;
    this.peer = new Peer(peerId);

    this.peer.on("open", () => {
      this.callbacks.onCodeReady(this.code);
    });

    this.peer.on("error", (err) => {
      if (err.type === "unavailable-id") {
        // Code collision — try a new one
        this.peer?.destroy();
        this.code = generateCode();
        this.tryRegister();
      } else {
        console.error("[PeerHost] error:", err);
      }
    });

    this.peer.on("connection", (conn) => {
      conn.on("open", () => {
        // Wait for hello message to classify
        const onFirstMessage = (data: unknown) => {
          conn.off("data", onFirstMessage);
          const hello = data as HelloMessage;
          if (hello?.type === "hello") {
            if (hello.role === "controller") {
              this.acceptController(conn);
            } else {
              this.acceptAudience(conn);
            }
          }
        };
        conn.on("data", onFirstMessage);
      });
    });
  }

  private acceptController(conn: DataConnection): void {
    // Replace existing controller
    if (this.controllerConn) {
      this.controllerConn.close();
    }
    this.controllerConn = conn;

    // Send full state sync
    const state = this.callbacks.onControllerConnected();
    this.sendToController({ type: "stateSync", state });

    conn.on("data", (data) => {
      this.callbacks.onControlMessage(data as ControlMessage);
    });

    conn.on("close", () => {
      if (this.controllerConn === conn) {
        this.controllerConn = null;
        this.callbacks.onControllerDisconnected();
      }
    });
  }

  private acceptAudience(conn: DataConnection): void {
    this.audienceConns.add(conn);

    conn.on("data", (data) => {
      const msg = data as AudienceMessage;
      if (msg?.type === "calloutRequest") {
        const response = this.callbacks.onAudienceCallout(conn, msg.name);
        conn.send(response);
      }
    });

    conn.on("close", () => {
      this.audienceConns.delete(conn);
    });
  }

  sendToController(msg: DisplayMessage): void {
    if (this.controllerConn?.open) {
      this.controllerConn.send(msg);
    }
  }

  get hasController(): boolean {
    return this.controllerConn?.open === true;
  }

  stop(): void {
    this.controllerConn?.close();
    for (const conn of this.audienceConns) {
      conn.close();
    }
    this.audienceConns.clear();
    this.peer?.destroy();
    this.peer = null;
  }
}
