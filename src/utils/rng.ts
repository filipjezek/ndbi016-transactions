import seedrandom from "seedrandom";

export class SeededRNG {
  private _rng: () => number;
  constructor(private seed: string) {
    this._rng = seedrandom(seed);
  }

  random() {
    return this._rng();
  }
  reset() {
    this._rng = seedrandom(this.seed);
  }
  randint(max: number): number;
  randint(min: number, max: number): number;
  randint(min: number, max?: number): number {
    if (max === undefined) {
      max = min;
      min = 0;
    }
    return Math.floor(this.random() * (max - min) + min);
  }

  /**
   * Shuffles an array in place
   * https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle
   * @param array Array to shuffle
   * @returns the array
   */
  shuffle(array: any[]) {
    let currentIndex = array.length,
      randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex > 0) {
      // Pick a remaining element.
      randomIndex = this.randint(currentIndex);
      currentIndex--;

      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex],
        array[currentIndex],
      ];
    }

    return array;
  }
}

export const globalRNG = new SeededRNG("abcdef");
