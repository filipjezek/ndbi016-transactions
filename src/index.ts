import { AppStub } from "./app-stubs/app-stub";
import { ConsistencyChecker } from "./app-stubs/consistency-checker";
import { RandomApp } from "./app-stubs/random-app";
import { TrafficSimulator } from "./traffic-simulator";
import { TransactionManager } from "./transaction-manager";

const traffic = new TrafficSimulator();
const tm = new TransactionManager(traffic, { sum: 15, size: 10 });

const apps: AppStub[] = Array.from(
  { length: 2 },
  () => new RandomApp(traffic.connect(), { addressCount: 10 })
);
apps.push(
  new ConsistencyChecker(traffic.connect(), { addressCount: 10, sum: 15 })
);

apps.forEach(async (app) => {
  await app.runOnce();
  await app.exit();
});

await tm.run();
tm.log.print();
