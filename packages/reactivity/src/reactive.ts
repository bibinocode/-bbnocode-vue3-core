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
const reactiveMap: WeakMap<Target, any> = new WeakMap<Target, any>();

declare const ReactiveMarkerSymbol: unique symbol;

export type ReactiveMarker = {
	[ReactiveMarkerSymbol]: void;
};
export type Reactive<T extends object> = T extends any[] ? ReactiveMarker : T;

export function isReadonly(value: unknown): boolean {
	return !!(value && (value as Target)[ReactiveFlags.IS_READONLY]);
}

export function reactive<T extends object>(target: T): Reactive<T>;
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

export function toRaw<T>(observed: T): T {
	const raw = observed && (observed as Target)[ReactiveFlags.RAW];
	return (raw ? toRaw(raw) : observed) as T;
}
