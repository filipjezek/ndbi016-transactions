import { randint } from "./randint";

/**
 * Shuffles an array in place
 * https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle
 * @param array Array to shuffle
 * @returns the array
 */
export function shuffle(array: any[]) {
  let currentIndex = array.length,
    randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex > 0) {
    // Pick a remaining element.
    randomIndex = randint(currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }

  return array;
}
