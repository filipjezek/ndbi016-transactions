import { Message, MessageType } from "./message";

/**
 * TrafficManager class collects messages from multiple sources and outputs one continous stream of messages
 */
export class TrafficManager {
  public connect() {
    return new Connection(() => {});
  }
}

export class Connection {
  private static transactionCount = 0;
  private tranId = 0;
  private tranRunning = false;

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
}
