import type { TrackOpTypes, TriggerOpTypes } from "./constants";



// 标识这个 effect 依赖对象的所有属性
export const ITERATE_KEY: unique symbol = Symbol("Object iterate")

export function track(target: object, type: TrackOpTypes, key: unknown) {
  console.log(`track ${target} ${type} 依赖收集`);
}

export function trigger(target: object, type: TriggerOpTypes, key?: unknown) {
  console.log(`trigger ${target} ${key} ${type} 触发更新`)
}