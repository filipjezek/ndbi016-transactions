import { Message, MessageType } from "./message";
import { globalRNG } from "./utils/rng";

/**
 * collects messages from multiple sources and outputs one continous stream of messages
 */
export class TrafficSimulator {
  private msgBuffer: Message[] = [];
  private connections: Connection[] = [];

  public hasTraffic() {
    return this.connections.some((c) => c.active);
  }

  public connect() {
    const conn = new Connection((m) => {
      this.msgBuffer.push(m);
    });
    this.connections.push(conn);
    return conn;
  }

  public getMessage() {
    if (this.msgBuffer.length === 0) return null;
    const i = globalRNG.randint(this.msgBuffer.length);
    return this.msgBuffer.splice(i, 1)[0];
  }
}

export class Connection {
  private static transactionCount = 0;
  private tranId = 0;
  private tranRunning = false;
  private _active = true;
  public get active() {
    return this._active;
  }

  constructor(private sendCb: (m: Message) => void) {}

  public startTransaction() {
    if (this.tranRunning) throw new Error("Transaction already running");
    this.tranId = Connection.transactionCount++;
    this.tranRunning = true;
    return new Promise<void>((res) => {
      this.sendCb({
        type: MessageType.Start,
        transactionId: this.tranId,
        callback: res,
      });
    });
  }

  public read(address: number): Promise<number> {
    return new Promise((res) => {
      this.sendCb({
        type: MessageType.Read,
        address,
        callback: res,
        transactionId: this.tranId,
      });
    });
  }

  public write(address: number, data: number) {
    return new Promise<void>((res) => {
      this.sendCb({
        type: MessageType.Write,
        data,
        address,
        transactionId: this.tranId,
        callback: res,
      });
    });
  }

  public abort() {
    this.tranRunning = false;
    return new Promise<void>((res) => {
      this.sendCb({
        type: MessageType.Abort,
        transactionId: this.tranId,
        callback: res,
      });
    });
  }

  public commit() {
    this.tranRunning = false;
    return new Promise<void>((res) => {
      this.sendCb({
        type: MessageType.Commit,
        transactionId: this.tranId,
        callback: res,
      });
    });
  }

  public async disconnect() {
    if (this.tranRunning) await this.abort();
    this._active = false;
  }
}
