import { isObject } from "@vue/shared";
import { mutableHandlers, readonlyHandlers } from "./baseHandler";
import { ReactiveFlags } from "./constants";

/**
 * 标识位
 */
export interface Target {
	[ReactiveFlags.IS_READONLY]?: boolean;
	[ReactiveFlags.IS_REACTIVE]?: boolean;
	[ReactiveFlags.RAW]?: boolean;
}

/**
 * 存储所有代理过的响应式对象对象
 * @description 使用 WeakMap 存储代理过的对象，避免内存泄漏
 */
export const reactiveMap: WeakMap<Target, any> = new WeakMap<Target, any>();

/**
 * readonly 存储Map
 */
export const readonlyMap: WeakMap<Target, any> = new WeakMap<Target, any>()

declare const ReactiveMarkerSymbol: unique symbol;

export type ReactiveMarker = {
	[ReactiveMarkerSymbol]: void;
};
export type Reactive<T extends object> = T extends any[] ? ReactiveMarker : T;

// 递归将各种类型转为只读 就是无限套三元
type Primitive = string | number | boolean | symbol | null | undefined
export type Builtin = Primitive | Function | Date | Error | RegExp
export type DeepReadonly<T> = T extends Builtin ?
	T : T extends Map<infer K, infer V>
	? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>> : T extends WeakMap<infer K, infer V>
	? WeakMap<DeepReadonly<K>, DeepReadonly<V>> : T extends Set<infer U>
	? Set<DeepReadonly<U>> : T extends WeakSet<infer U>
	? WeakSet<DeepReadonly<U>> : T extends ReadonlySet<infer U>
	? ReadonlySet<DeepReadonly<U>> : T extends Promise<infer U>
	? Promise<DeepReadonly<U>> : T extends {}
	? { readonly [P in keyof T]: DeepReadonly<T[P]> }
	: Readonly<T>


export function isReadonly(value: unknown): boolean {
	return !!(value && (value as Target)[ReactiveFlags.IS_READONLY]);
}

/**
 * 判断是否是代理对象
 * @description 判断是否是代理对象 本质上是 递归访问 __v_raw 属性 走到 get 拦截器
 */
export function isProxy(value: any): boolean {
	return value ? !!value[ReactiveFlags.RAW] : false;
}

/**
 * 抽离创建代理对象方法
 */
export function createReactiveObject(target: Target, isReadonly: boolean, baseHandler: ProxyHandler<any>, proxyMap: WeakMap<Target, any>) {
	// 1.如果不是对象,直接返回
	if (!isObject(target)) {
		console.warn("value not is object");
		return target;
	}


	//2. 如果已经代理过了,直接返回
	// 检查代理对象的缓存Map中是否存在目标对象的代理对象，如果存在则直接返回代理对象
	const exitingProxy = proxyMap.get(target)
	if (exitingProxy) {
		return exitingProxy
	}

	// 3. 如果是proxy代理，无需再次代理：实现方式：去读标识 __isReactive,计算没有这个属性也会走到get方法
	// 读取 __v_raw（这里是需要处理数组需要访问切换到原始对象的问题）
	// !(isReadonly && target[ReactiveFlags.IS_REACTIVE]) 允许将响应式对象转换为只读对象。这是唯一允许的情况
	if (target[ReactiveFlags.RAW] && !(isReadonly && target[ReactiveFlags.IS_REACTIVE])) {
		return target;
	}

	const proxy = new Proxy(target, baseHandler);

	// 4. 缓存代理对象
	proxyMap.set(target, proxy);
	return proxy
}


export function reactive<T extends object>(target: T): T;
export function reactive(target: object) {
	return createReactiveObject(target, false, mutableHandlers, reactiveMap)
}

/**
 * 将值转换为响应式对象
 * @description 如果值是对象，则将其转换为响应式对象，否则返回值本身
 */
export function toReactive<T>(value: T) {
	return isObject(value) ? reactive(value) : value;
}

/**
 * 获取原始对象
 * @description 获取原始对象 本质上是 递归访问 __v_raw 属性 走到 get 拦截器
 */
export function toRaw<T>(observed: T): T {
	const raw = observed && (observed as Target)[ReactiveFlags.RAW];
	return (raw ? toRaw(raw) : observed) as T;
}


/**
 * 将对象转换为只读对象
 * @description 将对象转换为只读对象
 * @description 分开不同的map存储是因为,想通的对象可能有不同的代理因此应该是不同的对象需要分开存储
 */
export function readonly<T extends object>(target: T): DeepReadonly<T> {
	return createReactiveObject(target, true, readonlyHandlers, readonlyMap)
}
