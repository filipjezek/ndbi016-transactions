import { Connection } from "../traffic-simulator";
import { randint } from "../utils/randint";
import { rng } from "../utils/rng";
import { AppStub } from "./app-stub";

export interface MovedAmount {
  from: number;
  to: number;
  amount: number;
}

export class RandomApp implements AppStub {
  private _amountsMoved: MovedAmount[] = [];
  public get amountsMoved() {
    return this._amountsMoved as readonly MovedAmount[];
  }

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

    while (rng() > 0.2) {
      await this.moveRandomAmount();
    }

    if (rng() > 0.5) {
      await this.conn.commit();
    } else {
      if (rng() > 0.5) {
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
    while (rng() > 0.25) {
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
    const amount = randint(1000);

    const fromValue = await this.conn.read(from);
    const toValue = await this.conn.read(to);
    await this.conn.write(from, fromValue - amount);
    await this.conn.write(to, toValue + amount);
    this._amountsMoved.push({ from, to, amount });
  }

  public async exit() {
    await this.conn.disconnect();
  }
}
