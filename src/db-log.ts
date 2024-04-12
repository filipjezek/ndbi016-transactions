import {
  ControlMessage,
  Message,
  MessageType,
  ReadMessage,
  WriteMessage,
} from "./message";
import chalk from "chalk";
import { ScheduleAnalysis } from "./schedule-analysis";

export type UpdateRecord = WriteMessage & {
  previousData: number;
  previousUpdate: UpdateRecord | null;
};

export class DBLog {
  /**
   * indexed by transaction id
   */
  private lastUpdates: Map<number, UpdateRecord> = new Map();

  private log: (Message | UpdateRecord)[] = [];
  public get data() {
    return this.log as readonly Message[];
  }
  private palette = [
    "#8dd3c7",
    "#ffffb3",
    "#bebada",
    "#fb8072",
    "#80b1d3",
    "#fdb462",
    "#b3de69",
    "#fccde5",
    "#d9d9d9",
    "#bc80bd",
    "#ccebc5",
    "#ffed6f",
  ];
  public analysis: ScheduleAnalysis;
  private tids = new Set<number>();

  public append(msg: WriteMessage, previousData: number): void;
  public append(msg: ControlMessage | ReadMessage): void;
  public append(msg: Message, previousData?: number): void {
    if (msg.type === MessageType.Write) {
      const updateRec = {
        ...msg,
        previousData,
        previousUpdate: this.lastUpdates.get(msg.transactionId) || null,
      };
      this.lastUpdates.set(msg.transactionId, updateRec);
      this.log.push(updateRec);
    } else {
      this.log.push(msg);
    }
    this.tids.add(msg.transactionId);
  }

  public getReverseChanges(tid: number): { address: number; data: number }[] {
    const changes = new Map<number, number>();
    for (
      let updateRec = this.lastUpdates.get(tid);
      updateRec != null;
      updateRec = updateRec.previousUpdate
    ) {
      changes.set(updateRec.address, updateRec.previousData);
    }
    return Array.from(changes.entries()).map(([address, data]) => ({
      address,
      data,
    }));
  }

  public print() {
    console.log("DB Log:");
    const tids = Array.from(this.tids).sort((a, b) => a - b);
    const cols = new Map<number, number>(tids.map((tid, i) => [tid, i]));

    tids.forEach((tid, i) => {
      const color = this.palette[i % this.palette.length];
      const padded = `T${tid}`.padEnd(10);
      process.stdout.write(chalk.hex(color)(padded));
    });
    console.log();
    this.log.forEach((msg) => {
      process.stdout.write(" ".repeat(10 * cols.get(msg.transactionId)));
      this.printMessage(msg);
      console.log();
    });
  }

  public printProperties() {
    this.analyse();
    console.log("Properties:");
    console.log(
      "Conflict serializable:",
      this.analysis.confSerializable ? chalk.green("true") : chalk.red("false")
    );
    console.log(
      "Recoverable:",
      this.analysis.recoverable ? chalk.green("true") : chalk.red("false")
    );
    console.log(
      "Cascadeless:",
      this.analysis.cascadeless ? chalk.green("true") : chalk.red("false")
    );
    console.log(
      "Strict:",
      this.analysis.strict ? chalk.green("true") : chalk.red("false")
    );
  }

  private printMessage(msg: Message) {
    const color = this.palette[msg.transactionId % this.palette.length];
    let str = `${msg.type}`;
    if (msg.type === MessageType.Read) {
      str += `(${msg.address})`;
    } else if (msg.type === MessageType.Write) {
      str += `(${msg.address},${msg.data})`;
    }
    str = str.padEnd(10);

    process.stdout.write(chalk.hex(color)(str) + " ");
  }

  public analyse() {
    this.analysis = new ScheduleAnalysis(this.log);
  }

  public export(historyId: number, separator = ",") {
    return this.log
      .map((msg) => {
        return [
          msg.transactionId,
          msg.type.toLowerCase(),
          "address" in msg ? msg.address : "",
          historyId,
        ].join(separator);
      })
      .join("\n");
  }

  public import(data: string, separator = ",") {
    this.log = data.split("\n").map((line) => {
      const [transactionId, type, address, historyId] = line.split(separator);
      return {
        transactionId: +transactionId,
        type: type.toUpperCase() as MessageType,
        address: address === "" ? undefined : +address,
      } as Message;
    });
    this.analysis = null;
  }

  public getBlockableMessageCount() {
    let c = 0;
    for (const msg of this.log) {
      if (msg.type === MessageType.Read || msg.type === MessageType.Write) {
        c++;
      }
    }
    return c;
  }
}
