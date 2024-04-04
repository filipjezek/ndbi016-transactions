import { AppStub } from "./app-stubs/app-stub";
import { ConsistencyChecker } from "./app-stubs/consistency-checker";
import { RandomApp } from "./app-stubs/random-app";
import { TrafficSimulator } from "./traffic-simulator";
import { TransactionManager } from "./transaction-manager";
import { printArray } from "./utils/print-array";
import { globalRNG } from "./utils/rng";

async function runConcurrently() {
  apps = [];
  for (const seed of Array.from({ length: 4 }, () => globalRNG.random() + "")) {
    apps.push(new RandomApp(traffic.connect(), { addressCount: 100, seed }));
  }
  // apps.push(
  //   new ConsistencyChecker(traffic.connect(), { addressCount: 100, sum: 15 })
  // );

  apps.forEach(async (app) => {
    await app.runOnce();
    await app.exit();
  });

  await tm.run();
}

async function replaySequentially(permutation: number[]) {
  const seqTm = new TransactionManager(traffic, { sum: 15, size: 10 });

  const sequence = (async () => {
    for (const tid of permutation) {
      const app = apps[tid] as RandomApp;
      app.reset(traffic.connect());
      await app.runOnce();
      await app.exit();
    }
  })();
  await seqTm.run();
  printArray(seqTm.data, tm.data);
  seqTm.log.print();
  seqTm.log.printProperties();
}

let apps: AppStub[] = [];
const traffic = new TrafficSimulator();
const tm = new TransactionManager(traffic, { sum: 15, size: 100 });
await runConcurrently();
tm.log.print();
tm.log.printProperties();
// printArray(tm.data);
// await replaySequentially([0, 1]);
// await replaySequentially([1, 0]);

/*
RED: 16, 29, 47, 67
PURPLE: 6, 30, 83, 86, 92, 97
GREEN: 40, 44
YELLOW: 48, 56, 88, 92
*/
