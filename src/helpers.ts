/**
 * Helper functions used throughout the module.
 * Includes functions for computing CRC32, generating Cartesian products,
 * grouping array items, and filtering unique array items.
 */

// Generates a table of CRC32 remainders for all possible byte values.
// Based on https://stackoverflow.com/a/18639999
const makeCRCTable = () => {
  let c;
  const crcTable: number[] = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c;
  }
  return crcTable;
};

// Precomputed CRC32 table for fast computations.
const crcTable = makeCRCTable();

/**
 * Computes the CRC32 hash of a given string.
 * @param str - The input string to hash.
 * @returns The CRC32 hash as an 8-character hexadecimal string.
 */
export const crc32 = (str: string): string => {
  let crc = 0 ^ -1;
  for (let i = 0; i < str.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ str.charCodeAt(i)) & 0xff];
  }
  const value = (crc ^ -1) >>> 0;
  return value.toString(16).padStart(8, "0");
};

/**
 * Generates all possible pairs (Cartesian product) from two arrays.
 * @param ar - The first array.
 * @param br - The second array.
 * @returns An array of pairs [A, B] where A is from ar and B is from br.
 */
export function arrayDiallel<A, B>(ar: A[], br: B[]): [A, B][] {
  const res: [A, B][] = [];
  for (const a of ar) {
    for (const b of br) {
      res.push([a, b]);
    }
  }
  return res;
}

/**
 * Groups items in an array based on a key function.
 * @param items - The array of items to group.
 * @param keyFn - A function that returns a string key for each item.
 * @returns An object where each key corresponds to an array of items with that key.
 */
export function groupArrayItems<T>(
  items: T[],
  keyFn: (value: T) => string,
): Record<string, T[]> {
  const res: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!res[key]) {
      res[key] = [];
    }
    res[key].push(item);
  }
  return res;
}

/**
 * Filters an array to contain only unique items.
 * @param items - The array to filter.
 * @returns A new array containing only unique items.
 */
export function uniqueArrayItems<T>(items: T[]): T[] {
  return items.filter((it, index) => items.indexOf(it) == index);
}
