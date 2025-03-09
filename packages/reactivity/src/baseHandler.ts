import { hasChanged, hasOwn, isObject, isSymbol } from "@vue/shared";
import { ReactiveFlags, TrackOpTypes, TriggerOpTypes } from "./constants";
import { ITERATE_KEY, track, trigger } from "./dep";
import { type Target, reactive, reactiveMap } from "./reactive";

/**
 * 不需要代理的属性集合
 * 如：Symbol.toStringTag  Symbol.toStringTag 等内置属性
 */
const builtInSymbols = new Set(
	Object.getOwnPropertyNames(Symbol)
		.filter((key) => key !== "arguments" && key !== "caller")
		.map((key) => Symbol[key as keyof SymbolConstructor])
		.filter(isSymbol),
);

/**
 * proxy 处理 基础类实现 基础的get方法
 */
export class BaseReactiveHandler implements ProxyHandler<Target> {
	get(target: Target, key: string, receiver: ProxyHandler<Target>) {
		// 1. 处理标识符 如果访问的是 __isReactive 返回 true
		if (key === ReactiveFlags.IS_REACTIVE) {
			return true;
		}

		// 2. 处理访问的 toRaw方法 的问题
		if (key === ReactiveFlags.RAW) {
			// 如果 receiver 是代理对象 或者 检查 receiver 是否与 target 有相同的原型 为了避免用户创建自己的代理Proxy
			if (
				receiver === reactiveMap.get(target) ||
				Object.getPrototypeOf(target) === Object.getPrototypeOf(receiver)
			) {
				return target;
			}
			return undefined;
		}

		// 2. 收集依赖
		track(target, TrackOpTypes.GET, key);

		const res = Reflect.get(target, key, receiver);

		// 如果访问的.属性也是对象,则递归代理
		if (isObject(res)) {
			return reactive(res);
		}
		return res;
	}
}

/**
 * 可读可写
 */
class MutableReactiveHandler extends BaseReactiveHandler {
	set(
		target: Record<string | symbol, unknown>,
		key: string,
		value: unknown,
		receiver: object,
	): boolean {
		// 判断是否自身属性
		const hadKey = hasOwn(target, key);

		const oldValue = target[key];

		// 如果不是自身属性,则就是新增情况
		if (!hadKey) {
			trigger(target, TriggerOpTypes.ADD, key);
		} else if (hasChanged(oldValue, value)) {
			// 如果新旧值不一样才出发更新,避免不必要的更新
			trigger(target, TriggerOpTypes.SET, key);
		}
		// 更新值
		const result = Reflect.set(target, key, value, receiver);
		return result;
	}

	/**
	 * 处理  'c' in obj 时依赖收集
	 */
	has(target: Record<string | symbol, unknown>, key: string | symbol): boolean {
		const result = Reflect.has(target, key);

		// 如果key不是Symbol类型 或者 不是内置symbol内置属性 就触发依赖收集
		if (!isSymbol(key) || !builtInSymbols.has(key)) {
			track(target, TrackOpTypes.HAS, key);
		}

		return result;
	}

	/**
	 * 处理遍历 for...in 的时候走到 EnumerateObjectProperties 对应内部的 OwnPropertyKeys 方法 也就是 Proxy.ownKeys 方法
	 * 遍历的时候没有指定具体的key, 因此迭代一个对象属性的时候,就需要追踪这个对象的所有属性，因为任何属性的增删都可能影响迭代的结果
	 * 因此使用一个 特殊的 键 来标识 这个effect 依赖对象的所有属性
	 */
	ownKeys(target: Record<string | symbol, unknown>): (string | symbol)[] {
		track(target, TrackOpTypes.ITERATE, ITERATE_KEY);
		return Reflect.ownKeys(track);
	}

	/**
	 * 删除属性
	 */
	deleteProperty(
		target: Record<string | symbol, unknown>,
		key: string | symbol,
	): boolean {
		// 自身有这个属性才可以删
		const hadKey = hasOwn(target, key);
		const result = Reflect.deleteProperty(target, key);
		if (hadKey && result) {
			trigger(target, TriggerOpTypes.DELETE, key);
		}
		return result;
	}
}

/**
 * 可变代理对象处理
 */
export const mutableHandlers: ProxyHandler<object> =
	new MutableReactiveHandler();
