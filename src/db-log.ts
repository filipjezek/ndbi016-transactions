import { Message, MessageType } from "./message";
import chalk from "chalk";
import { ScheduleAnalysis } from "./schedule-analysis";

export class DBLog {
  private log: Message[] = [];
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

  public append(msg: Message) {
    this.log.push(msg);
  }

  public print() {
    process.stdout.write("DB Log:");
    this.log.forEach((msg, i) => {
      if (i % 8 === 0) {
        process.stdout.write("\n");
      }
      this.printMessage(msg);
    });
    console.log();
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
}
