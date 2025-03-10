/**
 * 创建一个map
 * @param str 
 * @returns 
 */
export function makeMap(str: string): (key: string) => boolean {
  const set = new Set(str.split(','))
  return val => set.has(val)
}