/**
 * @description Checks uniqueness of a value in an array
 */
function unique<T>(v: T, i: number, arr: T[]): boolean {
  return arr.indexOf(v) === i;
}

export { unique };
