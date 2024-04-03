import { Message, MessageType } from "./message";

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
    this.computeConflictSerializability();
    this.computeRecoveryProps();
  }

  private buildConflictGraph() {
    const conflicts: Set<number>[] = [];
    const groups: Message[][] = [];
    const aborted = new Set(
      this.log
        .filter((m) => m.type === MessageType.Abort)
        .map((m) => m.transactionId)
    );
    for (const m of this.log) {
      if (!("address" in m) || aborted.has(m.transactionId)) continue;
      if (groups[m.address] === undefined) {
        groups[m.address] = [];
      }
      groups[m.address].push(m);
    }

    for (const g of groups) {
      if (!g) continue;
      for (let src = 0; src < g.length; src++) {
        for (let tgt = src + 1; tgt < g.length; tgt++) {
          if (
            g[src].transactionId === g[tgt].transactionId ||
            (g[src].type === MessageType.Read &&
              g[tgt].type === MessageType.Read)
          )
            continue;

          if (conflicts[g[src].transactionId] === undefined)
            conflicts[g[src].transactionId] = new Set();
          conflicts[g[src].transactionId].add(g[tgt].transactionId);
        }
      }
    }
    return conflicts;
  }

  private isAcylic(graph: Set<number>[]) {
    const visited: boolean[] = [];
    const stack: number[] = [];
    for (let i = 0; i < graph.length; i++) {
      if (!graph[i] || visited[i]) continue;
      stack.push(i);
      while (stack.length) {
        const node = stack.pop();
        if (visited[node]) return false;
        visited[node] = true;
        if (graph[node]) {
          for (const neighbor of graph[node]) {
            stack.push(neighbor);
          }
        }
      }
    }
    return true;
  }

  private computeConflictSerializability() {
    const conflicts = this.buildConflictGraph();
    this.properties.confSerializable = this.isAcylic(conflicts);
  }

  private computeRecoveryProps() {
    this.properties.recoverable = true;
    this.properties.cascadeless = true;
    this.properties.strict = true;
    /**
     * tids indexed by addresses
     */
    const uncommittedWrites: number[] = [];
    /**
     * addresses indexed by tids
     */
    const readAddresses: Set<number>[] = [];

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
        } else {
          if (readAddresses[m.transactionId] === undefined) {
            readAddresses[m.transactionId] = new Set();
          }
          readAddresses[m.transactionId].add(m.address);
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
        if (readAddresses[m.transactionId] && m.type === MessageType.Commit) {
          for (const addr of readAddresses[m.transactionId]) {
            if (
              uncommittedWrites[addr] !== undefined &&
              uncommittedWrites[addr] !== m.transactionId
            ) {
              // transaction has read an uncommitted write
              this.properties.recoverable = false;
            }
          }
        }
      }
    }
  }
}
