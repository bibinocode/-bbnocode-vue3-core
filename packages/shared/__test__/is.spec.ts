import { describe, expect, it } from 'vitest'
import { isObject } from '../src'


describe("测试 is 工具", () => {


  it("测试 isObject ", () => {
    expect(isObject({})).toBe(true)
    expect(isObject([])).toBe(true)
  })

})