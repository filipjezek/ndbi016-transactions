import { AppStub } from "./app-stubs/app-stub";
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
console.log(
  `Blocked times: ${tm.blockedTimes} / ${tm.log.data.length} = ${
    (tm.blockedTimes / tm.log.data.length) * 100
  }%`
);
