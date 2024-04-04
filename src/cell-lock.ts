export class CellLock {
  private _sharedLocks = new Set<number>();
  private _exclusiveLock: number = null;

  public tryAcquireSharedLock(tid: number): boolean {
    if (this._exclusiveLock !== tid && this._exclusiveLock !== null)
      return false;
    this._sharedLocks.add(tid);
    return true;
  }

  public tryAcquireExclusiveLock(tid: number): boolean {
    if (this._exclusiveLock !== tid && this._exclusiveLock !== null)
      return false;
    if (this._sharedLocks.size > 1 || !this._sharedLocks.has(tid)) return false;
    this._exclusiveLock = tid;
    return true;
  }

  public release(tid: number): void {
    this._sharedLocks.delete(tid);
    if (this._exclusiveLock === tid) this._exclusiveLock = null;
  }

  public *holders(): Iterable<number> {
    if (this._exclusiveLock !== null) yield this._exclusiveLock;
    yield* this._sharedLocks;
  }
}
