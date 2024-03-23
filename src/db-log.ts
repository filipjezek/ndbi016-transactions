import { Message, MessageType } from "./message";
import chalk from "chalk";

export class DBLog {
  private log: Message[] = [];
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

  public append(msg: Message) {
    this.log.push(msg);
  }

  public print() {
    console.log("DB Log:");
    this.log.forEach((msg, i) => {
      if (i % 8 === 0) {
        process.stdout.write("\n");
      }
      this.printMessage(msg);
    });
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
}
