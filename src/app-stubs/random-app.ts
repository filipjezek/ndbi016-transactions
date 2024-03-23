import { Connection } from "../traffic-simulator";
import { randint } from "../utils/randint";

export class RandomApp {
  constructor(
    private conn: Connection,
    private options: {
      addressFrom?: number;
      addressCount: number;
    }
  ) {
    this.options = { addressFrom: 0, ...options };
  }

  public async runOnce() {
    await this.conn.startTransaction();

    while (Math.random() > 0.2) {
      await this.moveRandomAmount();
    }

    if (Math.random() > 0.5) {
      await this.conn.commit();
    } else {
      if (Math.random() > 0.5) {
        await this.inconsistentAbort();
      } else {
        await this.conn.abort();
      }
    }
  }

  public async runIndefinitely() {
    while (true) {
      await this.runOnce();
    }
  }

  private async inconsistentAbort() {
    while (Math.random() > 0.25) {
      await this.conn.write(
        randint(
          this.options.addressFrom,
          this.options.addressFrom + this.options.addressCount
        ),
        randint(0, 1000)
      );
    }
    await this.conn.abort();
  }

  private async moveRandomAmount() {
    const from = randint(
      this.options.addressFrom,
      this.options.addressFrom + this.options.addressCount
    );
    const to = randint(
      this.options.addressFrom,
      this.options.addressFrom + this.options.addressCount
    );
    const amount = randint(0, 1000);

    const fromValue = await this.conn.read(from);
    const toValue = await this.conn.read(to);
    await this.conn.write(from, fromValue - amount);
    await this.conn.write(to, toValue + amount);
  }
}
