import { isObject } from '@vue/shared'
import { ReactiveFlags, TrackOpTypes, TriggerOpTypes } from './constants'
import { track, trigger } from './dep'



/**
 * 标识位
 */
export interface Target {
  [ReactiveFlags.IS_READONLY]?: boolean
  [ReactiveFlags.IS_REACTIVE]?: boolean
}

/**
 * 存储所有代理过的对象
 * @description 使用 WeakMap 存储代理过的对象，避免内存泄漏
 */
const reactiveMap: WeakMap<Target, any> = new WeakMap<Target, any>()


declare const ReactiveMarkerSymbol: unique symbol

export type ReactiveMarker = {
  [ReactiveMarkerSymbol]: void
}
export type Reactive<T extends object> = (T extends any[] ? ReactiveMarker : T)


export function isReadonly(value: unknown): boolean {
  return !!(value && (value as Target)[ReactiveFlags.IS_READONLY])
}


export function reactive<T extends object>(target: T): Reactive<T>
export function reactive(target: object) {
  // 1.如果不是对象,直接返回
  if (!isObject(target)) {
    console.warn("value not is object")
    return target
  }

  //2. 如果已经代理过了,直接返回
  if (reactiveMap.has(target)) {
    return reactiveMap.get(target)
  }

  // 3. 如果是proxy代理，无需再次代理：实现方式：去读标识 __isReactive,计算没有这个属性也会走到get方法
  if (target[ReactiveFlags.IS_REACTIVE]) {
    console.log("读到了", ReactiveFlags.IS_REACTIVE)
    return target
  }

  const proxy = new Proxy(target, {
    get(target, key, receiver) {
      // 走到 get方法中后，如果访问的是 __isReactive 说明是一个已经代理的proxy
      if (key === ReactiveFlags.IS_REACTIVE) {
        return true
      }

      // 依赖收集
      track(target, TrackOpTypes.GET, key)

      const result = Reflect.get(target, key, receiver)

      // 4. 如果是对象 递归代理
      if (isObject(result)) {
        return reactive(result)
      }

      return result
    },
    set(target, key, value, receiver) {
      // 触发更新
      trigger(target, TriggerOpTypes.SET, key)
      return Reflect.set(target, key, value, receiver)
    },
    has(target, key) {
      track(target, TrackOpTypes.HAS, key)
      const result = Reflect.has(target, key)
      return result
    }
  })


  reactiveMap.set(target, proxy)

  return proxy
}
