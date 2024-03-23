export type Message = (
  | {
      type: MessageType.Abort | MessageType.Commit | MessageType.Start;
      callback: () => void;
    }
  | {
      type: MessageType.Read;
      address: number;
      callback: (data: number) => void;
    }
  | {
      type: MessageType.Write;
      address: number;
      data: number;
      callback: () => void;
    }
) & { transactionId: number };

export enum MessageType {
  Start,
  Read,
  Write,
  Abort,
  Commit,
}
