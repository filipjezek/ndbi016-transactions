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

  public removeEdge(from: number, to: number) {
    this.adjacencyList.get(from)?.delete(to);
  }

  public getACycle() {
    const visited = new Set<number>();
    const stack: number[] = [];
    let path: number[];
    let cycleFound = false;

    for (const n of this.adjacencyList.keys()) {
      if (cycleFound) break;
      if (visited.has(n)) continue;
      stack.push(n);
      path = [];
      visited.clear();
      while (stack.length) {
        const node = stack.pop();
        path.push(node);
        if (visited.has(node)) {
          cycleFound = true;
          break;
        }
        visited.add(node);
        this.adjacencyList.get(node).forEach((neighbor) => {
          stack.push(neighbor);
        });
      }
    }
    if (cycleFound) {
      while (path.length > 1 && path[0] !== path[path.length - 1]) {
        path.shift();
      }
      return path;
    }
    return null;
  }

  public removeNode(node: number) {
    this.adjacencyList.delete(node);
    for (const neighbors of this.adjacencyList.values()) {
      neighbors.delete(node);
    }
  }

  public replaceNode(oldNode: number, newNode: number) {
    const neighbors = this.adjacencyList.get(oldNode);
    this.adjacencyList.delete(oldNode);
    this.adjacencyList.set(newNode, neighbors);
    for (const otherNeighbors of this.adjacencyList.values()) {
      if (otherNeighbors.delete(oldNode)) {
        otherNeighbors.add(newNode);
      }
    }
  }
}
