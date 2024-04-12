import { Connection } from "../traffic-simulator";
import { SeededRNG, globalRNG } from "../utils/rng";
import { AppStub } from "./app-stub";

export interface MovedAmount {
  from: number;
  to: number;
  amount: number;
}

export class RandomApp implements AppStub {
  private rng: SeededRNG;

  constructor(
    private conn: Connection,
    private options: {
      addressFrom?: number;
      addressCount: number;
      seed?: string;
    }
  ) {
    this.options = { addressFrom: 0, ...options };
    this.rng = "seed" in this.options ? new SeededRNG(options.seed) : globalRNG;
  }

  public async runOnce() {
    try {
      await this.conn.startTransaction();

      while (this.rng.random() > 0.2) {
        await this.moveRandomAmount();
      }

      if (this.rng.random() > 0) {
        await this.conn.commit();
      } else {
        if (this.rng.random() > 0.5) {
          await this.inconsistentAbort();
        } else {
          await this.conn.abort();
        }
      }
    } catch (e) {}
  }

  public async runIndefinitely() {
    while (true) {
      await this.runOnce();
    }
  }

  public reset(conn: Connection) {
    this.conn = conn;
    if ("seed" in this.options) {
      this.rng.reset();
    }
  }

  private async inconsistentAbort() {
    while (this.rng.random() > 0.25) {
      await this.conn.write(
        this.rng.randint(
          this.options.addressFrom,
          this.options.addressFrom + this.options.addressCount
        ),
        this.rng.randint(0, 1000)
      );
    }
    await this.conn.abort();
  }

  private async moveRandomAmount() {
    const from = this.rng.randint(
      this.options.addressFrom,
      this.options.addressFrom + this.options.addressCount
    );
    const to = this.rng.randint(
      this.options.addressFrom,
      this.options.addressFrom + this.options.addressCount
    );
    const amount = this.rng.randint(1000);

    const fromValue = await this.conn.read(from);
    const toValue = await this.conn.read(to);
    await this.conn.write(from, fromValue - amount);
    await this.conn.write(to, toValue + amount);
  }

  public async exit() {
    await this.conn.disconnect();
  }
}
