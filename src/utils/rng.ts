import seedrandom from "seedrandom";

export function rng() {
  return _rng();
}
export function resetRNG() {
  _rng = seedrandom("foobar");
}

let _rng: () => number;
resetRNG();
