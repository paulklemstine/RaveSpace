import Peer from "peerjs";
import type { DataConnection } from "peerjs";
import type { HelloMessage } from "./messages";

export interface PeerClientCallbacks<TIncoming> {
  onMessage: (msg: TIncoming) => void;
  onConnected: () => void;
  onDisconnected: () => void;
  onError: (err: Error & { type?: string }) => void;
}

export class PeerClient<TOutgoing, TIncoming> {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private role: "controller" | "audience";
  private callbacks: PeerClientCallbacks<TIncoming>;

  constructor(
    role: "controller" | "audience",
    callbacks: PeerClientCallbacks<TIncoming>,
  ) {
    this.role = role;
    this.callbacks = callbacks;
  }

  connect(code: string): void {
    this.peer = new Peer();

    this.peer.on("open", () => {
      const peerId = `rave-${code}`;
      this.conn = this.peer!.connect(peerId, { reliable: true });

      this.conn.on("open", () => {
        // Send hello to identify role
        const hello: HelloMessage = { type: "hello", role: this.role };
        this.conn!.send(hello);
        this.callbacks.onConnected();
      });

      this.conn.on("data", (data) => {
        this.callbacks.onMessage(data as TIncoming);
      });

      this.conn.on("close", () => {
        this.callbacks.onDisconnected();
      });

      this.conn.on("error", (err) => {
        this.callbacks.onError(err);
      });
    });

    this.peer.on("error", (err) => {
      this.callbacks.onError(err);
    });
  }

  send(msg: TOutgoing): void {
    if (this.conn?.open) {
      this.conn.send(msg);
    }
  }

  isConnected(): boolean {
    return this.conn?.open === true;
  }

  disconnect(): void {
    this.conn?.close();
    this.peer?.destroy();
    this.conn = null;
    this.peer = null;
  }
}
