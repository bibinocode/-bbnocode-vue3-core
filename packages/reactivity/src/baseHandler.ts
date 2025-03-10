import { hasChanged, hasOwn, isArray, isIntegerKey, isObject, isSymbol, makeMap } from "@vue/shared";
import { arrayInstrumentations } from "./arrayInstrumentations";
import { ReactiveFlags, TrackOpTypes, TriggerOpTypes } from "./constants";
import { ITERATE_KEY, track, trigger } from "./dep";
import { type Target, isReadonly, isShallow, reactive, reactiveMap, readonly, readonlyMap, shallowReactiveMap, toRaw } from "./reactive";

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

const isNonTrackableKeys = makeMap('__proto__')



/**
 * 重写对象的 hasOwnProperty 方法 让其可以触发依赖收集
 * hasOwnProperty 方法 在 对象中 是 自身属性 而不是原型上的属性
 * hasOwnProperty 的作用是 检查对象是否具有该属性 而不是检查原型上的属性
 */
function _hasOwnProperty(this: object, key: unknown) {
	// 如果key不是Symbol类型 则转换为字符串
	if (!isSymbol(key)) {
		key = String(key);
	}
	const obj = toRaw(this);
	track(obj, TrackOpTypes.HAS, key);
	// 使用 Object.hasOwn 检查对象是否具有该属性
	return Object.hasOwn(obj, key as PropertyKey);
}

/**
 * proxy 处理 基础类实现 基础的get方法
 */
export class BaseReactiveHandler implements ProxyHandler<Target> {
	constructor(
		protected readonly _isReadonly: boolean = false, // 是否只读
		protected readonly _isShallow: boolean = false, // 是否浅层代理
	) { }
	get(target: Target, key: string, receiver: ProxyHandler<Target>) {

		const isReadonly = this._isReadonly
		const isShallow = this._isShallow

		// 1. 处理标识符 如果访问的是 __isReactive 返回 true
		if (key === ReactiveFlags.IS_REACTIVE) {
			return true;
		}

		// v3: 处理访问 __v_isShallow 的情况 isShallow 方法
		if (key === ReactiveFlags.IS_SHALLOW) {
			return isShallow
		}

		// v2: 处理读取readonly, 访问 __isReadonly 的情况
		if (key === ReactiveFlags.IS_READONLY) {
			return isReadonly
		}

		// 2. 处理访问的 toRaw方法 的问题
		if (key === ReactiveFlags.RAW) {
			// 如果 receiver 是代理对象 或者 检查 receiver 是否与 target 有相同的原型 为了避免用户创建自己的代理Proxy
			// v2: readonly 处理逻辑 取值的weakmap不同 需要做处理
			// v3: 浅层代理 取值的weakmap不同 需要做处理
			const newMap = isReadonly ? readonlyMap : isShallow ? shallowReactiveMap : reactiveMap
			if (
				receiver === newMap.get(target) ||
				Object.getPrototypeOf(target) === Object.getPrototypeOf(receiver)
			) {
				return target;
			}
			return undefined;
		}

		// 3. 如果传入的target 是数组 处理数组的方法重写 和 hasOwnProperty 的特殊情况
		const targetIsArray = isArray(target);

		// v2: 加入readonly 方法后 只有不是只读的情况下,才去重写数组方法收集依赖
		if (!isReadonly) {
			let fn: Function | undefined;
			if (targetIsArray && (fn = arrayInstrumentations[key])) {
				return fn;
			}
			if (key === "hasOwnProperty") {
				return _hasOwnProperty;
			}
		}

		const res = Reflect.get(target, key, receiver);

		// 处理一些特殊的内置不需要依赖收集的属性 例如 symbol __proto__ 隐式属性 不需要递归处理
		// 或者一些内置的 Symbol 例如 Symbol.toStringTag 可以改变对象的toString行为 Symbol.iterator 可以改变对象的迭代行为
		if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
			return res
		}

		// 4. 收集依赖
		// track(target, TrackOpTypes.GET, key);
		// 不是只读的情况下才去收集依赖,节省消耗
		if (!isReadonly) {
			track(target, TrackOpTypes.GET, key);
		}

		// 如果是浅层代理,直接返回避免递归
		if (isShallow) {
			return res
		}

		// 如果访问的.属性也是对象,则递归代理
		// v2: 处理 readonly 
		if (isObject(res)) {
			return isReadonly ? readonly(res) : reactive(res);
		}

		return res;
	}
}

/**
 * 可读可写
 */
class MutableReactiveHandler extends BaseReactiveHandler {
	constructor(isShallow = false) {
		super(false, isShallow)
	}
	set(
		target: Record<string | symbol, unknown>,
		key: string,
		value: unknown,
		receiver: object,
	): boolean {
		// 获取旧值
		let oldValue = target[key]
		// 对非浅层代理的情况进行处理 防止: 无法正确处理嵌套的响应式对象
		// 1. 浅层代理 导致 旧值 是 只读的 但是 新值 是 响应式的 导致 旧值 和 新值 都是 只读的 导致 无法触发更新
		// 2. 浅层代理 导致 旧值 是 响应式的 但是 新值 是 只读的 导致 旧值 和 新值 都是 响应式的 导致 无法触发更新
		// 3. 浅层代理 导致 旧值 是 响应式的 但是 新值 是 响应式的 导致 旧值 和 新值 都是 响应式的 导致 无法触发更新
		if (!this._isShallow) {
			// 如果新值不是浅层响应式 并且不是只读的话，就需要去处理拿到原始对象
			if (!isShallow(value) && !isReadonly(value)) {
				oldValue = toRaw(oldValue)
				value = toRaw(value)
			}
		}

		// 检查数组索引是不是已经存在 或者 检查对象属性是不是已经存在
		const hadKey = isArray(target) && isIntegerKey(key) ? Number(key) < target.length : hasOwn(target, key);
		// 先设置值，再触发更新
		const result = Reflect.set(target, key, value, receiver)

		// 首先检查目标是否是原始对象（防止原型链上的操作触发更新）
		if (target === toRaw(receiver)) {
			if (!hadKey) {
				trigger(target, TriggerOpTypes.ADD, key, value)
			} else if (hasChanged(oldValue, value)) {
				// 如果新旧值不一样才出发更新,避免不必要的更新
				trigger(target, TriggerOpTypes.SET, key, value, oldValue)
			}
		}
		// 更新值
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
 * 只读响应式对象
 * 读 和 删 都给他返回true 但是不执行操作
 */
class ReadonlyReactiveHandler extends BaseReactiveHandler {
	constructor() {
		super(true)
	}
	set(target: object, key: string | symbol): boolean {
		console.log(`Set operation failed:${String(key)} is readonly failed: target is.`, target)
		return true
	}
	deleteProperty(target: object, key: string | symbol): boolean {
		console.log(`Delete operation failed:${String(key)} is readonly failed: target is.`, target)
		return true
	}
}





/**
 * 可变代理对象处理
 */
export const mutableHandlers: ProxyHandler<object> =
	new MutableReactiveHandler();


/**
 * 只读代理对象处理
 */
export const readonlyHandlers: ProxyHandler<object> = new ReadonlyReactiveHandler()


/**
 * 浅层代理对象处理
 */
export const shallowReactiveHandlers: ProxyHandler<object> = new MutableReactiveHandler(true)