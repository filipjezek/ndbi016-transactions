import { Message, MessageType } from "./message";

export class SerializationGraph {
  private data: Set<number>[] = [];
  private properties = {
    serializable: false,
    recoverable: false,
    strictRecoverable: false,
  };
  public get serializable() {
    return this.properties.serializable;
  }
  public get recoverable() {
    return this.properties.recoverable;
  }
  public get strictRecoverable() {
    return this.properties.strictRecoverable;
  }

  constructor(private log: Message[]) {
    this.buildGraph();
    this.properties.serializable = this.isAcylic();
    this.computeRecoverability();
  }

  private buildGraph() {
    const groups: Message[][] = [];
    for (const m of this.log) {
      if (!("address" in m)) continue;
      if (groups[m.address] === undefined) {
        groups[m.address] = [];
      }
      groups[m.address].push(m);
    }

    for (const g of groups) {
      for (let src = 0; src < g.length; src++) {
        for (let tgt = src + 1; tgt < g.length; tgt++) {
          if (
            g[src].transactionId === g[tgt].transactionId ||
            (g[src].type === MessageType.Read &&
              g[tgt].type === MessageType.Read)
          )
            continue;

          if (this.data[g[src].transactionId] === undefined)
            this.data[g[src].transactionId] = new Set();
          this.data[g[src].transactionId].add(g[tgt].transactionId);
        }
      }
    }
  }

  private isAcylic() {
    const visited: boolean[] = [];
    const stack: number[] = [];
    for (let i = 0; i < this.data.length; i++) {
      if (!this.data[i] || visited[i]) continue;
      stack.push(i);
      while (stack.length) {
        const node = stack.pop();
        if (visited[node]) return false;
        visited[node] = true;
        if (this.data[node]) {
          for (const neighbor of this.data[node]) {
            stack.push(neighbor);
          }
        }
      }
    }
    return true;
  }

  private computeRecoverability() {
    this.properties.recoverable = true;
    this.properties.strictRecoverable = true;
    // indexed by address
    const uncommittedWrites: Set<number>[] = [];

    // indexed by transaction id
    const readAddresses = this.data.map(() => new Set<number>());

    for (const m of this.log) {
      if (m.type === MessageType.Read || m.type === MessageType.Write) {
        if (m.type === MessageType.Write) {
          if (uncommittedWrites[m.address] === undefined) {
            uncommittedWrites[m.address] = new Set();
          }
          uncommittedWrites[m.address].add(m.transactionId);
        } else {
          readAddresses[m.transactionId].add(m.address);
        }

        if (
          uncommittedWrites[m.address] &&
          (uncommittedWrites[m.address].size > 1 ||
            !uncommittedWrites[m.address].has(m.transactionId))
        ) {
          // some other transaction has written to this address
          // and has not ended yet
          this.properties.strictRecoverable = false;
        }
      } else if (
        m.type === MessageType.Abort ||
        m.type === MessageType.Commit
      ) {
        for (const addr of uncommittedWrites) {
          addr?.delete(m.transactionId);
        }

        if (m.type === MessageType.Commit) {
          for (const addr of readAddresses[m.transactionId]) {
            if (uncommittedWrites[addr]?.size) {
              // our commit depends on uncommitted changes
              this.properties.recoverable = false;
              this.properties.strictRecoverable = false;
              return;
            }
          }
        }
      }
    }
  }
}
