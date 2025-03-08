import { describe, expect, it } from 'vitest'
import { hasChanged, hasOwn, isArray, isFunction, isObject, isPromise, isString, isSymbol } from '../src'


describe("test is utils", () => {

  it("is object ", () => {
    expect(isObject({})).toBe(true)
    expect(isObject([])).toBe(true)
  })

  it("is promise", () => {

    const promise = new Promise((resolve, reject) => {
      resolve("11")
    })
    expect(isPromise(promise)).toBe(true)
  })

  it("is array", () => {
    expect(isArray([])).toBe(true)
  })

  it("is string", () => {
    expect(isString("111")).toBe(true)
  })

  it("is function", () => {
    expect(isFunction(() => { })).toBe(true)
  })


  it("is symbol", () => {
    expect(isSymbol(Symbol())).toBe(true)
  })


  it("hasChanged", () => {
    expect(hasChanged(1, 1)).toBe(false)
    expect(hasChanged(1, 2)).toBe(true)
    expect(hasChanged(Number.NaN, Number.NaN)).toBe(false)
    expect(hasChanged(0, -0)).toBe(true)
  })

  it("hasOwn", () => {
    const obj = {
      a: 1,
      b: 2
    }
    expect(hasOwn(obj, "a")).toBe(true)
    expect(hasOwn(obj, "c")).toBe(false)
  })

})