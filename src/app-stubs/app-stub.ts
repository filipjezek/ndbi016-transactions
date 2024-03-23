export interface AppStub {
  runOnce(): Promise<void>;
  runIndefinitely(): Promise<void>;
  exit(): Promise<void>;
}
