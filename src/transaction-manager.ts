import { CellLock } from "./cell-lock";
import { DBLog } from "./db-log";
import { Graph } from "./graph";
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
  public readonly log = new DBLog();
  public blockedTimes = 0;
  private locks: CellLock[];
  private dependencies = new Graph();

  constructor(
    private traffic: TrafficSimulator,
    private options: {
      sum: number;
      size: number;
    }
  ) {
    this._data = new Array(this.options.size).fill(0);
    this._data[0] = this.options.sum;
    this.locks = this._data.map(() => new CellLock());
  }

  public async run() {
    while (this.traffic.hasTraffic()) {
      this.traffic.getMessage((msg) => this.handleMessage(msg));
      await promiseTimeout(); // wait cycle
    }
  }

  /**
   *
   * @param msg message to handle
   * @returns true if the message was handled successfully
   */
  private handleMessage(msg: Message): boolean {
    if (!msg) return;
    let completed = true;
    switch (msg.type) {
      case MessageType.Start:
        this.handleStart(msg);
        break;
      case MessageType.Read:
        completed = this.handleRead(msg);
        break;
      case MessageType.Write:
        completed = this.handleWrite(msg);
        break;
      case MessageType.Commit:
        this.handleCommit(msg);
        break;
      case MessageType.Abort:
        this.handleAbort(msg);
        break;
    }
    if (completed) {
      this.log.append(msg);
    } else {
      this.blockedTimes++;
    }
    return completed;
  }

  private handleStart(msg: ControlMessage) {
    msg.callback();
  }
  private handleRead(msg: ReadMessage): boolean {
    if (!this.locks[msg.address].tryAcquireSharedLock(msg.transactionId)) {
      this.addDeps(msg.transactionId, msg.address);
      return false;
    }
    msg.callback(this._data[msg.address]);
    return true;
  }
  private handleWrite(msg: WriteMessage): boolean {
    if (!this.locks[msg.address].tryAcquireExclusiveLock(msg.transactionId)) {
      this.addDeps(msg.transactionId, msg.address);
      return false;
    }
    this._data[msg.address] = msg.data;
    msg.callback();
    return true;
  }
  private handleCommit(msg: ControlMessage) {
    this.locks.forEach((lock) => lock.release(msg.transactionId));
    this.dependencies.removeNode(msg.transactionId);
    msg.callback();
  }
  private handleAbort(msg: ControlMessage) {
    this.locks.forEach((lock) => lock.release(msg.transactionId));
    this.dependencies.removeNode(msg.transactionId);
    msg.callback();
  }

  private addDeps(tid: number, address: number) {
    for (const holder of this.locks[address].holders()) {
      if (holder === tid) continue;
      this.dependencies.addEdge(holder, tid);
    }
    const cycle = this.dependencies.getACycle();
    if (cycle) {
      console.log(tid);
      console.log(...this.locks[address].holders());
      console.log(this.dependencies.data);
      throw new Error(`Deadlock detected: ${cycle.join(" -> ")}`);
    }
  }
}
