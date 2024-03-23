import chalk from "chalk";

export function printArray(
  arr: readonly number[],
  compareTo?: readonly number[]
) {
  process.stdout.write("[ ");
  for (let i = 0; i < arr.length; i++) {
    const padded = arr[i].toString().padEnd(5) + " ";
    if (compareTo && arr[i] !== compareTo[i]) {
      process.stdout.write(chalk.red(padded));
    } else {
      process.stdout.write(padded);
    }
    if (i > 0 && i % 10 === 0) {
      console.log();
    }
  }
  console.log(" ]");
}
