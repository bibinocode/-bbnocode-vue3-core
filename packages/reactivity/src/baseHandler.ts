import { isObject, isSymbol } from '@vue/shared';
import { ReactiveFlags, TrackOpTypes, TriggerOpTypes } from './constants';
import { track, trigger } from './dep';
import { type Target, reactive } from './reactive';




/**
 * 不需要代理的属性集合
 * 如：Symbol.toStringTag  Symbol.toStringTag 等内置属性
 */
const builtInSymbols = new Set(
  Object.getOwnPropertyNames(Symbol)
    .filter(key => key !== 'arguments' && key !== 'caller')
    .map(key => Symbol[key as keyof SymbolConstructor])
    .filter(isSymbol)
)


/**
 * proxy 处理 基础类实现 基础的get方法
 */
export class BaseReactiveHandler implements ProxyHandler<Target> {

  get(target: Target, key: string, receiver: ProxyHandler<Target>) {
    // 1. 处理标识符 如果访问的是 __isReactive 返回true
    if (key === ReactiveFlags.IS_REACTIVE) {
      return true
    }
    // 2. 收集依赖
    track(target, TrackOpTypes.GET, key)

    const res = Reflect.get(target, key, receiver)

    // 如果访问的.属性也是对象,则递归代理
    if (isObject(res)) {
      return reactive(res)
    }
    return res
  }
}


/**
 * 可读可写
 */
class MutableReactiveHandler extends BaseReactiveHandler {
  set(target: Record<string | symbol, unknown>, key: string, value: unknown, receiver: object): boolean {
    // 1. 触发更新
    trigger(target, TriggerOpTypes.SET, key)

    // 更新值
    const result = Reflect.set(target, key, value, receiver)

    return result
  }


  /**
   * 处理  'c' in obj 时依赖收集
   */
  has(target: Record<string | symbol, unknown>, key: string | symbol): boolean {
    const result = Reflect.has(target, key)

    // 如果key不是Symbol类型 或者 不是内置symbol内置属性 就触发依赖收集
    if (!isSymbol(key) || !builtInSymbols.has(key)) {
      track(target, TrackOpTypes.HAS, key)
    }

    return result
  }
}

/**
 * 可变代理对象处理
 */
export const mutableHandlers: ProxyHandler<object> = new MutableReactiveHandler()