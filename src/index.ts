import { RandomApp } from "./app-stubs/random-app";
import { TrafficSimulator } from "./traffic-simulator";
import { TransactionManager } from "./transaction-manager";
import { SeededRNG, globalRNG } from "./utils/rng";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import fs from "node:fs/promises";
import { avg } from "./utils/avg";
import { DBLog } from "./db-log";
import { samples } from "./schedule-samples";

async function runConcurrently(
  appCount: number,
  dbSize: number,
  seed?: string,
  iterations = 1
): Promise<TransactionManager> {
  const apps = [];
  const traffic = new TrafficSimulator(seed);
  const rng = seed === undefined ? globalRNG : new SeededRNG(seed);
  const tm = new TransactionManager(traffic, { sum: 15, size: dbSize });
  for (const seed of Array.from(
    { length: appCount },
    () => rng.random() + ""
  )) {
    apps.push(new RandomApp(traffic.connect(), { addressCount: dbSize, seed }));
  }

  apps.forEach(async (app) => {
    for (let i = 0; i < iterations; i++) {
      await app.runOnce();
    }
    await app.exit();
  });

  await tm.run();
  return tm;
}

function printInfo(tm: TransactionManager) {
  tm.log.print();
  tm.log.printProperties();
  console.log(`Data sum: ${tm.data.reduce((a, b) => a + b, 0)}`);
  const blockableCount = tm.log.getBlockableMessageCount();
  console.log(
    `Blocked times: ${tm.blockedTimes} / ${blockableCount} = ${
      (tm.blockedTimes / blockableCount) * 100
    }%`
  );
  console.log(
    `Deadlocked times: ${tm.deadlockedTimes} / ${blockableCount} = ${
      (tm.deadlockedTimes / blockableCount) * 100
    }%`
  );
}

function computeScheduleProperties(schedule: string) {
  const logs = DBLog.importForAnalysis(schedule, " ");
  logs.forEach((log, i) => {
    console.log(`=============Log ${i + 1}=============`);
    log.printProperties();
  });
}

async function drawGraph(
  sizes: number[],
  blocks: number[],
  deadlocks: number[]
) {
  const canv = new ChartJSNodeCanvas({
    width: 400,
    height: 400,
    backgroundColour: "white",
  });
  const buffer = await canv.renderToBuffer({
    type: "line",
    data: {
      labels: sizes.map((s) => s + ""),
      datasets: [
        {
          label: "Blocked %",
          data: blocks,
          fill: false,
          tension: 0.1,
          borderColor: "rgb(75, 192, 192)",
        },
        {
          label: "Deadlocked %",
          data: deadlocks,
          fill: false,
          borderColor: "rgb(255, 99, 132)",
          tension: 0.1,
        },
      ],
    },
  });
  await fs.writeFile("graph.png", buffer);
}

async function prepareGraphData() {
  const sizes = [10, 20, 50, 100, 200, 500];
  const seeds = Array.from({ length: 20 }, () => globalRNG.random() + "");
  const avgs = await Promise.all(
    sizes.map(async (size) => {
      const tms = await Promise.all(
        seeds.map((s) => runConcurrently(10, size, s))
      );
      return [
        avg(
          tms.map(
            (tm) => (tm.blockedTimes / tm.log.getBlockableMessageCount()) * 100
          )
        ),
        avg(
          tms.map(
            (tm) =>
              (tm.deadlockedTimes / tm.log.getBlockableMessageCount()) * 100
          )
        ),
      ];
    })
  );
  return {
    sizes,
    blocks: avgs.map((a) => a[0]),
    deadlocks: avgs.map((a) => a[1]),
  };
}

// const tm = await runConcurrently(2, 20, undefined, 5);
// printInfo(tm);
computeScheduleProperties(samples);
