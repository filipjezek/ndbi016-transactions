import { rng } from "./rng";

export function randint(max: number): number;
export function randint(min: number, max: number): number;
export function randint(min: number, max?: number): number {
  if (max === undefined) {
    max = min;
    min = 0;
  }
  return Math.floor(rng() * (max - min) + min);
}
