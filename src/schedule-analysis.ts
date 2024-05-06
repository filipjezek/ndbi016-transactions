import { Graph } from "./graph";
import { Message, MessageType, ReadMessage, WriteMessage } from "./message";

export class ScheduleAnalysis {
  private properties = {
    confSerializable: false,
    recoverable: false,
    cascadeless: false,
    strict: false,
  };
  public get confSerializable() {
    return this.properties.confSerializable;
  }
  public get recoverable() {
    return this.properties.recoverable;
  }
  public get strict() {
    return this.properties.strict;
  }
  public get cascadeless() {
    return this.properties.cascadeless;
  }

  constructor(private log: Message[]) {
    this.computeConflictSerializable();
    this.computeRecoverable();
    this.computeCascadelessStrict();
  }

  private buildConflictGraph() {
    const graph = new Graph();
    const groups: Message[][] = [];
    const aborted = new Set(
      this.log
        .filter((m) => m.type === MessageType.Abort)
        .map((m) => m.transactionId)
    );
    for (const m of this.log) {
      if (
        (!("address" in m) && m.type !== MessageType.Commit) ||
        aborted.has(m.transactionId)
      )
        continue;
      if (m.type === MessageType.Commit) {
        groups.forEach((g) => g.push(m));
        continue;
      }
      const addr = (m as ReadMessage | WriteMessage).address;
      if (groups[addr] === undefined) {
        groups[addr] = [];
      }
      groups[addr].push(m);
    }

    for (const g of groups) {
      if (!g) continue;
      for (let src = 0; src < g.length; src++) {
        for (let tgt = src + 1; tgt < g.length; tgt++) {
          if (
            (g[src].transactionId === g[tgt].transactionId &&
              g[tgt].type === MessageType.Commit) ||
            g[src].type === MessageType.Commit
          ) {
            break;
          }
          if (
            g[tgt].type === MessageType.Commit ||
            g[src].transactionId === g[tgt].transactionId ||
            (g[src].type === MessageType.Read &&
              g[tgt].type === MessageType.Read)
          )
            continue;

          graph.addEdge(g[src].transactionId, g[tgt].transactionId);
        }
      }
    }
    return graph;
  }

  private computeConflictSerializable() {
    const conflicts = this.buildConflictGraph();
    this.properties.confSerializable = conflicts.getACycle() === null;
  }

  private computeCascadelessStrict() {
    this.properties.cascadeless = true;
    this.properties.strict = true;
    /**
     * tids indexed by addresses
     */
    const uncommittedWrites: number[] = [];

    for (const m of this.log) {
      if (m.type === MessageType.Read || m.type === MessageType.Write) {
        if (
          uncommittedWrites[m.address] !== undefined &&
          uncommittedWrites[m.address] !== m.transactionId
        ) {
          // some other transaction has written to this address
          // and has not ended yet
          this.properties.strict = false;
          if (m.type === MessageType.Read) {
            // dirty read
            this.properties.cascadeless = false;
          }
        }

        if (m.type === MessageType.Write) {
          uncommittedWrites[m.address] = m.transactionId;
        }
      } else if (
        m.type === MessageType.Abort ||
        m.type === MessageType.Commit
      ) {
        uncommittedWrites.forEach((tid, addr) => {
          if (tid === m.transactionId) {
            uncommittedWrites[addr] = undefined;
          }
        });
      }
    }
  }

  private computeRecoverable() {
    this.properties.recoverable = true;
    const wrDeps = new Graph();
    const uncommittedWrites: number[] = [];

    for (const m of this.log) {
      if (m.type === MessageType.Read) {
        if (
          uncommittedWrites[m.address] !== undefined &&
          uncommittedWrites[m.address] !== m.transactionId
        ) {
          wrDeps.addEdge(m.transactionId, uncommittedWrites[m.address]);
        }
      } else if (m.type === MessageType.Write) {
        uncommittedWrites[m.address] = m.transactionId;
      } else if (
        m.type === MessageType.Abort ||
        m.type === MessageType.Commit
      ) {
        if (
          m.type === MessageType.Commit &&
          wrDeps.data.get(m.transactionId)?.size
        ) {
          this.properties.recoverable = false;
          break;
        }
        wrDeps.removeNode(m.transactionId);
        uncommittedWrites.forEach((tid, addr) => {
          if (tid === m.transactionId) {
            uncommittedWrites[addr] = undefined;
          }
        });
      }
    }
  }
}
