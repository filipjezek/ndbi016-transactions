import { Message, MessageType } from "./message";
import { SeededRNG, globalRNG } from "./utils/rng";

/**
 * collects messages from multiple sources and outputs one continous stream of messages
 */
export class TrafficSimulator {
  private msgBuffer: Message[] = [];
  private connections: Connection[] = [];
  private rng: SeededRNG;

  constructor(private seed?: string) {
    this.rng = seed === undefined ? new SeededRNG(seed) : globalRNG;
  }

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

  /**
   * @param cb this callback will be called with the next message.
   * If the callback returns true, the message will be removed from the buffer, otherwise it will be blocked
   */
  public getMessage(cb: (m: Message) => boolean) {
    if (this.msgBuffer.length === 0) {
      cb(null);
      return;
    }
    const i = this.rng.randint(this.msgBuffer.length);
    if (cb(this.msgBuffer[i])) {
      this.msgBuffer.splice(i, 1)[0];
    }
  }

  public notifyAbort(tid: number) {
    this.msgBuffer.forEach((m) => {
      if (m.transactionId === tid) {
        m.callback(new Error("Transaction aborted"));
      }
    });
    this.msgBuffer = this.msgBuffer.filter((m) => m.transactionId !== tid);
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

  public static newTID() {
    return Connection.transactionCount++;
  }

  constructor(private sendCb: (m: Message) => void) {}

  public startTransaction() {
    if (this.tranRunning) throw new Error("Transaction already running");
    this.tranId = Connection.newTID();
    this.tranRunning = true;
    return new Promise<void>((res, rej) => {
      this.sendCb({
        type: MessageType.Start,
        transactionId: this.tranId,
        callback: (e) =>
          e instanceof Error ? ((this.tranRunning = false), rej(e)) : res(),
      });
    });
  }

  public read(address: number): Promise<number> {
    return new Promise((res, rej) => {
      this.sendCb({
        type: MessageType.Read,
        address,
        callback: (e) =>
          e instanceof Error ? ((this.tranRunning = false), rej(e)) : res(e),
        transactionId: this.tranId,
      });
    });
  }

  public write(address: number, data: number) {
    return new Promise<void>((res, rej) => {
      this.sendCb({
        type: MessageType.Write,
        data,
        address,
        transactionId: this.tranId,
        callback: (e) =>
          e instanceof Error ? ((this.tranRunning = false), rej(e)) : res(),
      });
    });
  }

  public abort() {
    this.tranRunning = false;
    return new Promise<void>((res, rej) => {
      this.sendCb({
        type: MessageType.Abort,
        transactionId: this.tranId,
        callback: (e) => (e instanceof Error ? rej(e) : res()),
      });
    });
  }

  public commit() {
    this.tranRunning = false;
    return new Promise<void>((res, rej) => {
      this.sendCb({
        type: MessageType.Commit,
        transactionId: this.tranId,
        callback: (e) => (e instanceof Error ? rej(e) : res()),
      });
    });
  }

  public async disconnect() {
    if (this.tranRunning) await this.abort();
    this._active = false;
  }
}
