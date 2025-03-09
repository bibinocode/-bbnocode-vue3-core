import { isArray } from "@vue/shared";
import { TrackOpTypes } from "./constants";
import { ARRAY_ITERATE_KEY, track } from "./dep";
import { isProxy, toRaw, toReactive } from "./reactive";

type ArrayMethods = keyof Array<any> | "findLast" | "findLastIndex";
type ArrayMethodFn<T = unknown> = (
	item: unknown,
	index: number,
	array: unknown[],
) => T;

const arrayProto = Array.prototype;

/**
 * 这里全部重写的原因是：Vue 只跟踪了一次数组的迭代操作（ARRAY_ITERATE_KEY），如果我们用 forEach 的方法会对数组中的每个元素都进行追踪，会导致性能问题
 * 不同的数组方法有不同的行为特征：
 *  - 有些方法会修改原数组（如push、pop）
 *  - 有些方法只读取数据（如map、filter）
 *  - 有些方法涉及迭代器（如values、entries）
 * 根据这些差异，使用不同的辅助函数
 *  - apply - 处理迭代方法 （forEach、map、filter、find、findIndex、findLast、findLastIndex） 需要对返回值进行包装
 *  - noTracking - 处理修改长度的方法 （push、pop） 需要暂停追踪
 *  - iterator - 处理迭代器方法 （values、entries） 需要对迭代器进行包装
 *  - searchProxy - 处理搜索方法 （includes、indexOf、lastIndexOf） 需要对搜索结果进行包装
 *
 * 对返回值的处理更加细致，确保响应式的一致性 return needsWrap && wrappedRetFn ? wrappedRetFn(result) : result
 * ```ts
 *  // 需要是元组类型，这样Array.prototype就可以通过key来访问到对应的方法
 *   ;(['includes', 'indexOf', 'lastIndexOf'] as const).forEach(key => {
 *    const method = Array.prototype[key] as any
 *    arrayInstrumentations[key] = function (this: unknown[], ...args: unknown[]) {
 *        const arr = toRaw(this)
 *        for (let i = 0, l = this.length; i < l; i++) {
 *          track(arr, TrackOpTypes.GET, i + '')
 *        }
 *        // 直接在原始对象中查找
 *        const res = method.apply(arr, args)
 *        if (res === -1 || res === false) {
 *          // 如果找不到，将参数转换为原始类型再找一次
 *          return method.apply(arr, args.map(toRaw))
 *        } else {
 *          return res
 *        }
 *        if (res === -1 || res === false) {
 *          // 如果找不到，将参数转换为原始类型再找一次
 *          return method.apply(arr, args.map(toRaw))
 *        } else {
 *          return res
 *        }
 *    }
 *  })
 * ```
 */
export const arrayInstrumentations: Record<string | symbol, Function> = <any>{
	// 设置 __proto__ 为 null 避免原型链污染
	__proto__: null,

	// 迭代器
	[Symbol.iterator]() {
		return iterator(this, Symbol.iterator, toReactive);
	},

	/**
	 * 重写合并数组方法
	 */
	concat(...args: unknown[]) {
		return reactiveReadArray(this).concat(
			...args.map((x) => (isArray(x) ? reactiveReadArray(x) : x)),
		);
	},

	/**
	 * 重写数组 entries 获取对象迭代器方法
	 */
	entries() {
		return iterator(this, "entries", (value: [number, unknown]) => {
			value[1] = toReactive(value[1]);
			return value;
		});
	},

	/**
	 * 重写 every 匹配数组元素全部符合条件方法
	 */
	every(fn: ArrayMethodFn, thisArg?: unknown) {
		return apply(this, "every", fn, thisArg, undefined, arguments);
	},

	/**
	 * 重写 filter 过滤方法
	 */
	filter(fn: ArrayMethodFn, thisArg?: unknown) {
		return apply(
			this,
			"filter",
			fn,
			thisArg,
			(v) => v.map(toReactive),
			arguments,
		);
	},

	/**
	 * 重写 find 返回数组中满足提供的测试函数的第一个元素的值
	 */
	find(fn: ArrayMethodFn<unknown | undefined>, thisArg?: unknown) {
		return apply(this, "find", fn, thisArg, toReactive, arguments);
	},

	/**
	 * 重写 findIndex 方法 返回数组中满足提供的测试函数的第一个元素的索引
	 */
	findIndex(fn: ArrayMethodFn<number>, thisArg?: unknown) {
		return apply(this, "findIndex", fn, thisArg, undefined, arguments);
	},
	/**
	 * 重写 findLast 方法反向迭代数组，并返回满足提供的测试函数的第一个元素的值
	 */
	findLast(fn: ArrayMethodFn<unknown | undefined>, thisArg?: unknown) {
		return apply(this, "findLast", fn, thisArg, toReactive, arguments);
	},

	/**
	 * 重写 findLastIndex 方法 返回数组中满足提供的测试函数的最后一个元素的索引
	 */
	findLastIndex(fn: ArrayMethodFn<number>, thisArg?: unknown) {
		return apply(this, "findLastIndex", fn, thisArg, undefined, arguments);
	},

	forEach(fn: ArrayMethodFn<unknown>, thisArg?: unknown) {
		return apply(this, "forEach", fn, thisArg, undefined, arguments);
	},

	includes(...args: unknown[]) {
		return searchProxy(this, "includes", args);
	},

	indexOf(...args: unknown[]) {
		return searchProxy(this, "indexOf", args);
	},

	join(separator?: string) {
		return reactiveReadArray(this).join(separator);
	},

	lastIndexOf(...args: unknown[]) {
		return searchProxy(this, "lastIndexOf", args);
	},

	map(fn: ArrayMethodFn, thisArg?: unknown) {
		return apply(this, "map", fn, thisArg, undefined, arguments);
	},

	pop() {
		return noTracking(this, "pop");
	},

	push(...args: unknown[]) {
		return noTracking(this, "push", args);
	},
	reduce(
		fn: (
			acc: unknown,
			item: unknown,
			index: number,
			array: unknown[],
		) => unknown,
		...args: unknown[]
	) {
		return reduce(this, "reduce", fn, args);
	},

	reduceRight(
		fn: (
			acc: unknown,
			item: unknown,
			index: number,
			array: unknown[],
		) => unknown,
		...args: unknown[]
	) {
		return reduce(this, "reduceRight", fn, args);
	},

	shift() {
		return noTracking(this, "shift");
	},
	some(
		fn: (item: unknown, index: number, array: unknown[]) => unknown,
		thisArg?: unknown,
	) {
		return apply(this, "some", fn, thisArg, undefined, arguments);
	},

	splice(...args: unknown[]) {
		return noTracking(this, "splice", args);
	},

	toReversed() {
		return reactiveReadArray(this).toReversed();
	},

	toSorted(comparer?: (a: unknown, b: unknown) => number) {
		return reactiveReadArray(this).toSorted(comparer);
	},

	toSpliced(...args: unknown[]) {
		return (reactiveReadArray(this).toSpliced as any)(...args);
	},

	unshift(...args: unknown[]) {
		return noTracking(this, "unshift", args);
	},

	values() {
		return iterator(this, "values", toReactive);
	},
};

// 对 reduce 和 reduceRight 进行工具化处理，使其依赖 ARRAY_ITERATE。
// ARRAY_ITERATE。
function reduce(
	self: unknown[],
	method: keyof Array<any>,
	fn: (acc: unknown, item: unknown, index: number, array: unknown[]) => unknown,
	args: unknown[],
) {
	// 使用 shallowReadArray 处理数组，确保只跟踪浅层读取操作 TODO: 这里需要做浅层处理 暂时不做
	const arr = self;
	let wrappedFn = fn;
	if (arr !== self) {
		if (fn.length > 3) {
			// 如果函数参数长度大于3，则需要对函数进行包装
			wrappedFn = function (this: unknown, acc, item, index) {
				return fn.call(this, acc, item, index, self);
			};
		} else {
			// TODO: 这里需要做浅层处理 暂时不做
			wrappedFn = function (this: unknown, acc, item, index) {
				return fn.call(this, acc, toReactive(item), index, self);
			};
		}
	}
	// 使用原始方法调用，传入包装后的函数和参数
	return (arr[method] as any)(wrappedFn, ...args);
}

// 处理改变长度的变异方法，避免长度被追踪
// 这可以防止在某些情况下出现无限循环(#2137)
function noTracking(
	self: unknown[],
	method: keyof Array<any>,
	args: unknown[] = [],
) {
	// TODO：暂停追踪
	// pauseTracking();
	// TODO：开始批量追踪
	// startBatch();
	// 使用原始方法调用，传入参数
	const res = (toRaw(self) as any)[method].apply(self, args);
	// TODO：结束批量追踪
	// endBatch();
	// TODO：重置追踪
	// resetTracking();
	// 返回结果
	return res;
}

/**
 * 搜索代理对象
 * @description 搜索代理对象 本质上是 递归访问 __v_raw 属性 走到 get 拦截器
 */
function searchProxy(
	self: unknown[],
	method: keyof Array<any>,
	args: unknown[],
) {
	const arr = toRaw(self) as any;
	// 跟踪迭代数组 自定义 key  ARRAY_ITERATE_KEY 触发依赖
	track(arr, TrackOpTypes.ITERATE, ARRAY_ITERATE_KEY);
	const res = arr[method](...args);
	// 如果结果为-1或false 并且参数是代理对象 则将参数转换为原始对象 也就是 查找的对象和参数，都要切换成原始对象
	if ((res === -1 || res === false) && isProxy(args[0])) {
		args[0] = toRaw(args[0]);
		return arr[method](...args);
	}
	return res;
}

function reactiveReadArray(value: unknown[]) {
	// 获取原始数组
	const raw = toRaw(value);
	// 如果原始数组与输入数组相同，则直接返回原始数组
	if (raw === value) return raw;
	// 跟踪迭代数组 自定义 key  ARRAY_ITERATE_KEY 触发依赖
	track(raw, TrackOpTypes.ITERATE, ARRAY_ITERATE_KEY);
	// 返回原始数组 TODO: 如果输入是浅层响应式，则返回原始数组，否则返回响应式数组
	return raw;
}

function apply(
	self: unknown[],
	method: ArrayMethods,
	fn: (item: unknown, index: number, array: unknown[]) => unknown,
	thisArg?: unknown,
	wrappedRetFn?: (result: any) => unknown,
	args?: IArguments,
) {
	// TODO: 这里需要做浅层处理 暂时不做
	const arr = self;
	// 如果数组不等于原数组 并且 TODO:不是浅层代理
	const needsWrap = arr !== self;
	// 获取数组方法
	const methodFn = arr[method];

	if (methodFn !== arrayProto[method]) {
		// 处理用户自定义扩展的数组方法,也就是不是原型上的方法
		const result = (methodFn as any).apply(self, args);
		// 如果需要包装 则包装
		return needsWrap ? toReactive(result) : result;
	}

	let wrappedFn = fn;
	if (arr !== self) {
		if (needsWrap) {
			wrappedFn = function (this: unknown, item, index) {
				return fn.call(this, toReactive(item), index, self);
			};
		} else if (fn.length > 2) {
			wrappedFn = function (this: unknown, item, index) {
				return fn.call(this, item, index, self);
			};
		}
	}
	const result = (methodFn as any).call(arr, wrappedFn, thisArg);
	return needsWrap && wrappedRetFn ? wrappedRetFn(result) : result;
}

function iterator(
	self: unknown[],
	method: keyof Array<unknown>,
	wrapValue: (value: any) => unknown,
) {
	// TODO: 这里需要做浅层处理 暂时不做
	const arr = self;
	// 创建迭代器
	const iter = (arr[method] as any)() as IterableIterator<unknown> & {
		_next: IterableIterator<unknown>["next"];
	};

	// 如果数组不等于原数组 并且 TODO:不是浅层代理 需要对迭代器进行包装
	if (arr !== self) {
		// 保存原始next 方法
		iter._next = iter.next;
		// 重写 next 方法
		iter.next = () => {
			// 调用原始next 方法
			const result = iter._next();
			//  如果结果的value存在，则进行包装
			if (result.value) {
				result.value = wrapValue(result.value);
			}
			return result;
		};
	}
	return iter;
}
