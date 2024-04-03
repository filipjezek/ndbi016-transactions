export class Graph {
  public get data(): ReadonlyMap<number, ReadonlySet<number>> {
    return this.adjacencyList;
  }
  private adjacencyList: Map<number, Set<number>> = new Map();

  public addNode(node: number) {
    if (!this.adjacencyList.has(node)) {
      this.adjacencyList.set(node, new Set());
    }
  }

  public addEdge(from: number, to: number) {
    this.addNode(from);
    this.addNode(to);
    this.adjacencyList.get(from).add(to);
  }

  public getACycle() {
    const visited = new Set<number>();
    const stack: number[] = [];
    const path: number[] = [];

    for (const n of this.adjacencyList.keys()) {
      if (visited.has(n)) continue;
      stack.push(n);
      while (stack.length) {
        const node = stack.pop();
        path.push(node);
        if (visited.has(node)) break;
        visited.add(node);
        this.adjacencyList.get(node).forEach((neighbor) => {
          stack.push(neighbor);
        });
      }
    }
    while (path.length > 1 && path[0] !== path[path.length - 1]) {
      path.shift();
    }
    return path.length > 1 ? path : null;
  }

  public removeNode(node: number) {
    this.adjacencyList.delete(node);
    for (const neighbors of this.adjacencyList.values()) {
      neighbors.delete(node);
    }
  }
}
