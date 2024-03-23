import { Message, MessageType } from "../message";
import { Connection } from "../traffic-simulator";
import { AppStub } from "./app-stub";
import { MovedAmount } from "./random-app";

/**
 * This class replays a transaction made by RandomApp.
 */
export class ReplayApp implements AppStub {
  constructor(
    private conn: Connection,
    private log: readonly Message[],
    private amountsMoved: readonly MovedAmount[]
  ) {}

  public async runOnce() {
    let amountIndex = 0;
    for (
      let i = 0;
      i < this.log.length && amountIndex < this.amountsMoved.length;
      i++
    ) {
      let msg = this.log[i];

      switch (msg.type) {
        case MessageType.Read:
          break;
        case MessageType.Write:
          await this.moveAmount(amountIndex++);
          i += 1;
          break;
        case MessageType.Commit:
          await this.conn.commit();
          break;
        case MessageType.Abort:
          await this.conn.abort();
          break;
      }
    }
  }

  private async moveAmount(index: number) {
    const { from, to, amount } = this.amountsMoved[index];
    const fromValue = await this.conn.read(from);
    const toValue = await this.conn.read(to);
    this.conn.write(from, fromValue - amount);
    this.conn.write(to, toValue + amount);
  }

  public async runIndefinitely() {
    throw new Error("Method not implemented.");
  }
  public async exit() {
    await this.conn.disconnect();
  }
}
