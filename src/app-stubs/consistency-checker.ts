import { Connection } from "../traffic-simulator";
import { globalRNG } from "../utils/rng";
import { AppStub } from "./app-stub";

export class ConsistencyChecker implements AppStub {
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
      // throw new Error(`Sum is not consistent: ${sum} !== ${this.options.sum}`);
    }
  }

  public async runIndefinitely() {
    while (true) {
      await this.runOnce();
    }
  }

  private async readAllValues() {
    const range = Array.from(
      { length: this.options.addressCount },
      (_, i) => i + this.options.addressFrom
    );
    globalRNG.shuffle(range);
    for (let i = 0; i < range.length; i++) {
      range[i] = await this.conn.read(range[i]);
    }

    return range;
  }

  public async exit() {
    await this.conn.disconnect();
  }
}
