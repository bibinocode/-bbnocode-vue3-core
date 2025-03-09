import { isObject } from "@vue/shared";
import { mutableHandlers } from "./baseHandler";
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
 * 存储所有代理过的对象
 * @description 使用 WeakMap 存储代理过的对象，避免内存泄漏
 */
export const reactiveMap: WeakMap<Target, any> = new WeakMap<Target, any>();

declare const ReactiveMarkerSymbol: unique symbol;

export type ReactiveMarker = {
	[ReactiveMarkerSymbol]: void;
};
export type Reactive<T extends object> = T extends any[] ? ReactiveMarker : T;

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

export function reactive<T extends object>(target: T): T;
export function reactive(target: object) {
	// 1.如果不是对象,直接返回
	if (!isObject(target)) {
		console.warn("value not is object");
		return target;
	}

	//2. 如果已经代理过了,直接返回
	if (reactiveMap.has(target)) {
		return reactiveMap.get(target);
	}

	// 3. 如果是proxy代理，无需再次代理：实现方式：去读标识 __isReactive,计算没有这个属性也会走到get方法
	// 读取 __v_raw（这里是需要处理数组需要访问切换到原始对象的问题）
	if (target[ReactiveFlags.RAW] && target[ReactiveFlags.IS_REACTIVE]) {
		console.log("读到了", ReactiveFlags.IS_REACTIVE);
		return target;
	}

	const proxy = new Proxy(target, mutableHandlers);

	// 4. 缓存代理对象
	reactiveMap.set(target, proxy);
	return proxy;
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
