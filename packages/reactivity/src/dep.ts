import type { TrackOpTypes, TriggerOpTypes } from "./constants";

// 标识这个 effect 依赖对象的所有属性
export const ITERATE_KEY: unique symbol = Symbol("Object iterate");
// 标识这个 effect 依赖数组的所有元素
export const ARRAY_ITERATE_KEY: unique symbol = Symbol("Array iterate");

export function track(target: object, type: TrackOpTypes, key: unknown, newValue?: unknown,) {
	console.log(`track ${target} ${type} 依赖收集${String(key)}`);
}

export function trigger(target: object, type: TriggerOpTypes, key?: unknown, newValue?: unknown, oldValue?: unknown) {
	console.log(`trigger ${target} ${key} ${type} 触发更新`);
}
