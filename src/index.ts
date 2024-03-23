import { AppStub } from "./app-stubs/app-stub";
import { ConsistencyChecker } from "./app-stubs/consistency-checker";
import { RandomApp } from "./app-stubs/random-app";
import { ReplayApp } from "./app-stubs/replay-app";
import { TrafficSimulator } from "./traffic-simulator";
import { TransactionManager } from "./transaction-manager";
import { printArray } from "./utils/print-array";

async function runConcurrently() {
  apps = [];
  for (let i = 0; i < 2; i++) {
    apps.push(new RandomApp(traffic.connect(), { addressCount: 10 }));
  }
  apps.push(
    new ConsistencyChecker(traffic.connect(), { addressCount: 10, sum: 15 })
  );

  apps.forEach(async (app) => {
    await app.runOnce();
    await app.exit();
  });

  await tm.run();
}

async function replaySequentially(permutation: number[]) {
  const log = tm.log.data;
  const seqTm = new TransactionManager(traffic, { sum: 15, size: 10 });

  const sequence = (async () => {
    for (const tid of permutation) {
      const replayApp = new ReplayApp(
        traffic.connect(),
        log.filter((msg) => msg.transactionId === tid),
        (apps[tid] as RandomApp).amountsMoved
      );
      await replayApp.runOnce();
      await replayApp.exit();
    }
  })();
  await seqTm.run();
  printArray(seqTm.data, tm.data);
}

let apps: AppStub[] = [];
const traffic = new TrafficSimulator();
const tm = new TransactionManager(traffic, { sum: 15, size: 10 });
await runConcurrently();
tm.log.print();
printArray(tm.data);
await replaySequentially([0, 1]);
await replaySequentially([1, 0]);
