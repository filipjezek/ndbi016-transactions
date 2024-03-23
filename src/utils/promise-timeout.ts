export function promiseTimeout(ms?: number) {
  return new Promise<void>((res, _) => {
    setTimeout(() => {
      res();
    }, ms);
  });
}
