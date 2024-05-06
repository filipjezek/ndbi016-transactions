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
import { Connection, TrafficSimulator } from "./traffic-simulator";
import { promiseTimeout } from "./utils/promise-timeout";

export class TransactionManager {
  private readonly _data: number[];
  public get data() {
    return this._data as readonly number[];
  }
  public readonly log = new DBLog();
  private _triedOutNestedRestart = false;
  public blockedTimes = 0;
  public deadlockedTimes = 0;
  private locks: CellLock[];
  private tranResources: Map<number, Set<number>> = new Map();
  private dependencies = new Graph();
  private handlingDeadlock = false;

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
    if (this.log.data.length === 32) {
      this.restart();
    }
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
    if (!completed) {
      this.blockedTimes++;
    }
    return completed;
  }

  private handleStart(msg: ControlMessage) {
    this.log.append(msg);
    this.tranResources.set(msg.transactionId, new Set());
    msg.callback();
  }
  private handleRead(msg: ReadMessage): boolean {
    this.tranResources.get(msg.transactionId).add(msg.address);
    if (!this.locks[msg.address].tryAcquireSharedLock(msg.transactionId)) {
      this.addDeps(msg.transactionId, msg.address);
      return false;
    }
    this.log.append(msg);
    msg.callback(this._data[msg.address]);
    return true;
  }
  private handleWrite(msg: WriteMessage): boolean {
    this.tranResources.get(msg.transactionId).add(msg.address);
    if (!this.locks[msg.address].tryAcquireExclusiveLock(msg.transactionId)) {
      this.addDeps(msg.transactionId, msg.address);
      return false;
    }
    this.log.append(msg, this._data[msg.address]);
    this._data[msg.address] = msg.data;
    msg.callback();
    return true;
  }
  private handleCommit(msg: ControlMessage) {
    this.log.append(msg);
    this.tranResources
      .get(msg.transactionId)
      .forEach((addr) => this.locks[addr].release(msg.transactionId));
    this.dependencies.removeNode(msg.transactionId);
    this.tranResources.delete(msg.transactionId);
    msg.callback();
  }
  private handleAbort(msg: ControlMessage) {
    const revChanges = this.log.getReverseChanges(msg.transactionId);
    this.log.append(msg);

    const rollbackTid = Connection.newTID();
    const resources = this.tranResources.get(msg.transactionId);
    this.tranResources.delete(msg.transactionId);
    resources.forEach((addr) =>
      this.locks[addr].replace(msg.transactionId, rollbackTid)
    );
    this.dependencies.replaceNode(msg.transactionId, rollbackTid);

    this.handleStart({
      transactionId: rollbackTid,
      type: MessageType.Start,
      callback: () => {},
    });
    this.tranResources.set(rollbackTid, resources);
    revChanges.forEach(({ address, data }) => {
      this.handleWrite({
        address,
        data,
        transactionId: rollbackTid,
        type: MessageType.Write,
        callback: () => {},
      });
    });
    this.handleCommit({
      transactionId: rollbackTid,
      type: MessageType.Commit,
      callback: () => {},
    });

    msg.callback();
  }

  private addDeps(tid: number, address: number) {
    for (const holder of this.locks[address].holders()) {
      if (holder === tid) continue;
      this.dependencies.addEdge(holder, tid);
    }
    if (this.handlingDeadlock) return;

    const cycle = this.dependencies.getACycle();
    if (cycle) {
      this.handleDeadlock(cycle);
    }
  }

  private handleDeadlock(cycle: number[]) {
    this.handlingDeadlock = true;
    this.deadlockedTimes++;

    // find transaction holding the least resources (should be faster to rollback)
    const victim = cycle.reduce(
      ([minKey, minVal], b) => {
        const val = this.tranResources.get(b).size;
        return val < minVal ? [b, val] : [minKey, minVal];
      },
      [-1, Infinity]
    )[0];

    this.handleAbort({
      transactionId: victim,
      type: MessageType.Abort,
      callback: () => {},
    });
    this.traffic.notifyAbort(victim);
    this.handlingDeadlock = false;
  }

  private restart() {
    this.dependencies.clear();
    this.tranResources.clear();
    this.locks = this._data.map(() => new CellLock());
    const relevantLogs = this.log.prepareForRecovery();
    for (const log of relevantLogs) {
      if (this.log.data.length === 36 && !this._triedOutNestedRestart) {
        this._triedOutNestedRestart = true;
        this.restart();
        return;
      }
      this.handleMessage(log);
    }
    this.dependencies.data.forEach((_, tid) => {
      // abort incomplete transactions
      this.traffic.notifyAbort(tid);
      this.handleAbort({
        type: MessageType.Abort,
        transactionId: tid,
        callback: () => {},
      });
    });
  }
}
