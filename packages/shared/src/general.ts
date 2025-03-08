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

//Object.is比较可以避免出现一些特殊情况, 比如NaN和NaN是相等的，+0和-0是不相等的
export const hasChanged = (val: unknown, old: unknown): boolean => {
  return !Object.is(val, old)
}

const hasOwnproperty = Object.prototype.hasOwnProperty
// 判断对象是否存在某个属性
export const hasOwn = (val: object, key: string | symbol): key is keyof typeof val => {
  return hasOwnproperty.call(val, key)
}