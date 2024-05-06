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

enum RecoveryMessageType {
  Restart = "restart",
  Checkpoint = "checkpoint",
}
interface CheckpointMessage {
  type: RecoveryMessageType.Checkpoint;
  ongoing: UpdateRecord[];
}
interface RestartMessage {
  type: RecoveryMessageType.Restart;
}
type RecoveryMessage = CheckpointMessage | RestartMessage;

export class DBLog {
  /**
   * indexed by transaction id
   */
  private lastUpdates: Map<number, UpdateRecord> = new Map();
  private checkpointedOngoing: Set<number> = new Set();

  private log: (Message | UpdateRecord | RecoveryMessage)[] = [
    { type: RecoveryMessageType.Checkpoint, ongoing: [] },
    { type: RecoveryMessageType.Checkpoint, ongoing: [] },
  ];
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
  private *regularMessages() {
    for (const msg of this.log) {
      if (
        msg.type !== RecoveryMessageType.Checkpoint &&
        msg.type !== RecoveryMessageType.Restart
      ) {
        yield msg;
      }
    }
  }

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
      if (msg.type === MessageType.Commit || msg.type === MessageType.Abort) {
        this.lastUpdates.delete(msg.transactionId);
        this.checkpointedOngoing.delete(msg.transactionId);
        if (this.checkpointedOngoing.size === 0) {
          this.checkpoint();
        }
      }
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
      if (
        msg.type === RecoveryMessageType.Checkpoint ||
        msg.type === RecoveryMessageType.Restart
      ) {
        console.log(msg.type);
        return;
      }
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
    this.analysis = new ScheduleAnalysis([...this.regularMessages()]);
  }

  public export(historyId: number, separator = ",") {
    return [...this.regularMessages()]
      .map((msg) => {
        return [
          historyId,
          msg.transactionId,
          msg.type,
          "address" in msg ? msg.address : "",
        ].join(separator);
      })
      .join("\n");
  }

  public static importForAnalysis(data: string, separator = ",") {
    data = data.trim();
    const logs: DBLog[] = [];
    let current: DBLog;
    let currHID: string;
    data.split("\n").forEach((line) => {
      const [historyId, transactionId, type, address] = line
        .trim()
        .split(separator);
      if (historyId !== currHID) {
        current = new DBLog();
        logs.push(current);
        currHID = historyId;
      }
      const msg = {
        transactionId: +transactionId,
        type: type as MessageType,
        address: address === "" || address === undefined ? undefined : +address,
      };
      if (msg.address === undefined) delete msg.address;
      current.log.push(msg as Message);
    });

    logs.forEach((log) => {
      const tids = new Set(
        log.data
          .filter((msg) => "transactionId" in msg)
          .map((msg) => msg.transactionId)
      );
      log.tids = tids;
      log.log.splice(
        2,
        0,
        ...(Array.from(tids).map((tid) => ({
          type: MessageType.Start,
          transactionId: tid,
        })) as Message[])
      );
    });

    return logs;
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

  private checkpoint() {
    const ongoing = Array.from(this.lastUpdates.values());
    this.checkpointedOngoing = new Set(ongoing.map((u) => u.transactionId));
    this.log.push({ type: RecoveryMessageType.Checkpoint, ongoing });
  }

  public prepareForRecovery() {
    this.lastUpdates.clear();
    let lastCheckpointPassed = false;
    let restartMsgIndex: number = null;
    let i = this.log.length - 1;
    for (; i >= 0; i--) {
      const msg = this.log[i];
      if (msg.type === RecoveryMessageType.Checkpoint) {
        if (lastCheckpointPassed) {
          break;
        }
        lastCheckpointPassed = true;
        this.checkpointedOngoing = new Set(
          msg.ongoing.map((u) => u.transactionId)
        );
      } else if (msg.type === RecoveryMessageType.Restart) {
        restartMsgIndex = i;
      }
    }

    if (restartMsgIndex != null) {
      this.log.splice(restartMsgIndex);
    }
    this.log.push({ type: RecoveryMessageType.Restart });
    let relevantMessages = this.log
      .slice(i + 1)
      .filter(
        (msg) => msg.type !== RecoveryMessageType.Checkpoint
      ) as Message[];
    let startedTids = new Set<number>(
      relevantMessages
        .filter((m) => m.type === MessageType.Start)
        .map((m) => m.transactionId)
    );
    relevantMessages = relevantMessages.filter((m) =>
      startedTids.has(m.transactionId)
    );
    return relevantMessages;
  }
}
