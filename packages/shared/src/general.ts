export const isObject = (val: unknown): val is Record<any, any> => {
  return val !== null && typeof val === 'object'
}

export const isArray: typeof Array.isArray = Array.isArray

export const isString = (val: unknown): val is string => {
  return typeof val === 'string'
}

export const isFunction = (val: unknown): val is Function => {
  return typeof val === 'function'
}

export const isPromise = <T = any>(val: unknown): val is Promise<T> => {
  return isObject(val) && isFunction(val.then) && isFunction(val.catch)
}


export const isSymbol = (val: unknown): val is symbol => {
  return typeof val === 'symbol'
}