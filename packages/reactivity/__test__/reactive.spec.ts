import { describe, expect, it } from "vitest";
import { reactive, toRaw } from "../src";
import { ReactiveFlags } from "../src/constants";

describe("reactivity/reactive", () => {
	it("基础响应式转换", () => {
		const original = { foo: 1 };
		const observed = reactive(original);

		expect(observed).not.toBe(original); // 确保返回新的代理对象
		expect(observed.foo).toBe(1); // 确保能正确访问属性
	});

	it("重复调用reactive应返回同一个代理", () => {
		const original = { foo: 1 };
		const observed1 = reactive(original);
		const observed2 = reactive(original);

		expect(observed1).toBe(observed2); // 同一个原始对象应该返回同一个代理
	});

	it("非对象值应该原样返回", () => {
		const number = 123;
		const string = "test";

		expect(reactive(number as any)).toBe(number);
		expect(reactive(string as any)).toBe(string);
	});

	it("已是响应式对象则直接返回", () => {
		const original = { foo: 1 };
		const observed1 = reactive(original);
		const observed2 = reactive(observed1);

		expect(observed1).toBe(observed2); // 应该返回同一个代理对象
		expect(observed1[ReactiveFlags.IS_REACTIVE]).toBe(true); // 检查响应式标记
	});

	it("如果原始对象中有 get 和set访问器", () => {
		const obj = {
			a: 1,
			b: 2,
			get c() {
				console.log("get c", this);
				return this.a + this.b;
			},
		};

		const state = reactive(obj);
		expect(state.c).toBe(3);

		state.a = 2;
		expect(state.c).toBe(4);
	});

	it("嵌套对象也应该是响应式的", () => {
		const original = {
			nested: {
				foo: 1,
			},
			array: [{ bar: 2 }],
		};
		const observed = reactive(original);

		expect(observed.nested.foo).toBe(1);
		expect(observed.nested[ReactiveFlags.IS_REACTIVE]).toBe(true);
		expect(observed.array[0][ReactiveFlags.IS_REACTIVE]).toBe(true);
	});

	it("访问数组.length 时也应该触发更新", () => {});

	it("in 关键字检测对象处理", () => {
		const obj = {
			a: 1,
			b: 2,
		};
		const state = reactive(obj);

		expect("a" in state).toBe(true);
		expect("c" in state).toBe(false);

		obj.a = 3;
		expect("a" in state).toBe(true);
	});

	it("is toRaw", () => {
		const foo = {};
		const stateFoot = reactive(foo);
		expect(toRaw(stateFoot) === foo).toBe(true);
	});

	it("数组响应式", () => {
		const arr = reactive([1, 2, 3]);
		expect(arr.length).toBe(3);
		expect(arr[0]).toBe(1);
		expect(arr[1]).toBe(2);
		expect(arr[2]).toBe(3);

		arr.push(4);
		expect(arr.length).toBe(4);
		expect(arr[3]).toBe(4);
	});
});
