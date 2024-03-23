import { Connection } from "../traffic-simulator";
import { shuffle } from "../utils/shuffle";

export class ConsistencyChecker {
  constructor(
    private conn: Connection,
    private options: {
      addressFrom?: number;
      addressCount: number;
      sum: number;
    }
  ) {
    this.options = { addressFrom: 0, ...options };
  }

  public async runOnce() {
    await this.conn.startTransaction();

    const values = await this.readAllValues();
    await this.conn.commit();
    const sum = values.reduce((acc, val) => acc + val, 0);

    if (sum !== this.options.sum) {
      throw new Error(`Sum is not consistent: ${sum} !== ${this.options.sum}`);
    }
  }

  public async runIndefinitely() {
    while (true) {
      await this.runOnce();
    }
  }

  private readAllValues() {
    const range = Array.from(
      { length: this.options.addressCount },
      (_, i) => i + this.options.addressFrom
    );
    shuffle(range);
    return Promise.all(range.map((address) => this.conn.read(address)));
  }
}
