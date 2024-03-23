export type Message = ControlMessage | ReadMessage | WriteMessage;

interface MsgCommon {
  transactionId: number;
  callback: () => void;
}
export interface ReadMessage extends Omit<MsgCommon, "callback"> {
  type: MessageType.Read;
  address: number;
  callback: (data: number) => void;
}
export interface WriteMessage extends MsgCommon {
  type: MessageType.Write;
  address: number;
  data: number;
}
export interface ControlMessage extends MsgCommon {
  type: MessageType.Commit | MessageType.Abort | MessageType.Start;
}

export enum MessageType {
  Start = "S",
  Read = "R",
  Write = "W",
  Abort = "A",
  Commit = "C",
}
