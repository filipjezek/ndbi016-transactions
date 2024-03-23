import { DBLog } from "./db-log";
import {
  ControlMessage,
  Message,
  MessageType,
  ReadMessage,
  WriteMessage,
} from "./message";
import { TrafficSimulator } from "./traffic-simulator";
import { promiseTimeout } from "./utils/promise-timeout";

export class TransactionManager {
  private readonly _data: number[];
  public get data() {
    return this._data as readonly number[];
  }
  public log = new DBLog();

  constructor(
    private traffic: TrafficSimulator,
    private options: {
      sum: number;
      size: number;
    }
  ) {
    this._data = new Array(this.options.size).fill(0);
    this._data[0] = this.options.sum;
  }

  public async run() {
    while (this.traffic.hasTraffic()) {
      this.handleMessage(this.traffic.getMessage());
      await promiseTimeout(); // wait cycle
    }
  }

  private handleMessage(msg: Message) {
    if (!msg) return;
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

  private handleStart(msg: ControlMessage) {
    msg.callback();
  }
  private handleRead(msg: ReadMessage) {
    msg.callback(this._data[msg.address]);
  }
  private handleWrite(msg: WriteMessage) {
    this._data[msg.address] = msg.data;
    msg.callback();
  }
  private handleCommit(msg: ControlMessage) {
    msg.callback();
  }
  private handleAbort(msg: ControlMessage) {
    msg.callback();
  }
}
