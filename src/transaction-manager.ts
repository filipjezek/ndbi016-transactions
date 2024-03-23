import { DBLog } from "./db-log";
import { Message, MessageType } from "./message";
import { TrafficSimulator } from "./traffic-simulator";
import { promiseTimeout } from "./utils/promise-timeout";

export class TransactionManager {
  private readonly data: number[];
  public log = new DBLog();

  constructor(
    private traffic: TrafficSimulator,
    private options: {
      sum: number;
      size: number;
    }
  ) {
    this.data = new Array(this.options.size).fill(0);
    this.data[0] = this.options.sum;
  }

  public async run() {
    while (this.traffic.hasTraffic()) {
      const batch = this.traffic.getBatch();
      this.consumeBatch(batch);
      await promiseTimeout(); // wait cycle
    }
  }

  public consumeBatch(batch: Message[]) {
    for (const msg of batch) {
      this.handleMessage(msg);
    }
  }

  public handleMessage(msg: Message) {
    this.log.append(msg);
    switch (msg.type) {
      case MessageType.Start:
        this.handleStart(msg);
        break;
      case MessageType.Read:
        this.handleRead(msg);
        break;
      case MessageType.Write:
        this.handleWrite(msg);
        break;
      case MessageType.Commit:
        this.handleCommit(msg);
        break;
      case MessageType.Abort:
        this.handleAbort(msg);
        break;
    }
  }

  private handleStart(msg: Message) {
    if (msg.type !== MessageType.Start) return;
    msg.callback();
  }
  private handleRead(msg: Message) {
    if (msg.type !== MessageType.Read) return;
    msg.callback(this.data[msg.address]);
  }
  private handleWrite(msg: Message) {
    if (msg.type !== MessageType.Write) return;
    this.data[msg.address] = msg.data;
    msg.callback();
  }
  private handleCommit(msg: Message) {
    if (msg.type !== MessageType.Commit) return;
    msg.callback();
  }
  private handleAbort(msg: Message) {
    if (msg.type !== MessageType.Abort) return;
    msg.callback();
  }
}
