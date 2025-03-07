import { describe, expect, it } from 'vitest'
import { isArray, isFunction, isObject, isPromise, isString } from '../src'


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

})