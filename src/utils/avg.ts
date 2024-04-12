export function avg(data: number[]) {
  return data.reduce((a, b) => a + b, 0) / data.length;
}
