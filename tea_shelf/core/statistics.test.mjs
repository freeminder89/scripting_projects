import { test } from "node:test"
import assert from "node:assert/strict"
import { calculateTeaStatistics } from "./statistics.ts"

function tea(stock, pricePerJin, cupGrams = null, gongfuGrams = null) {
  return {
    stock, pricePerJin,
    cupBrew: { grams300ml: cupGrams, firstSteepMinutes: null },
    gongfuBrew: { grams: gongfuGrams, firstSteepSeconds: null, extendEveryCups: null, extendSeconds: null, maxSteeps: null },
  }
}

test("empty inventory has zero count, weight and value", () => {
  assert.deepEqual(calculateTeaStatistics([]), {
    stockedCount: 0, registeredCount: 0, unconfiguredCount: 0, weight: "0斤0两", value: 0,
  })
})

test("inventory count excludes empty stock, converts weight to jin/liang and weights prices", () => {
  assert.deepEqual(calculateTeaStatistics([
    tea("半斤以上", 200),
    tea("半斤以上", 100),
    tea("半斤以上", 80),
    tea("一两", 300),
    tea("无", 999),
  ]), { stockedCount: 4, registeredCount: 5, unconfiguredCount: 5, weight: "1斤6两", value: 220 })
})

test("missing and zero prices keep stock count and weight without adding value", () => {
  assert.deepEqual(calculateTeaStatistics([
    tea("半斤以上", null),
    tea("半斤以上", 0),
  ]), { stockedCount: 2, registeredCount: 2, unconfiguredCount: 2, weight: "1斤0两", value: 0 })
})

test("rounds the combined value rather than each tea's fractional contribution", () => {
  const result = calculateTeaStatistics([
    tea("一两", 3),
    tea("一两", 3),
  ])
  assert.equal(result.value, 1)
  assert.equal(result.weight, "0斤2两")
  assert.equal(calculateTeaStatistics([tea("一两", 5)]).value, 1)
})

test("unconfigured means both tea amounts are unset, regardless of stock; zero is a value", () => {
  const result = calculateTeaStatistics([
    tea("无", null),
    tea("一两", null),
    tea("一两", null, 3),
    tea("一两", null, null, 7),
    tea("一两", null, 3, 7),
    tea("无", null, 0),
    tea("无", null, null, 0),
  ])
  assert.equal(result.unconfiguredCount, 2)
  assert.equal(result.registeredCount, 7)
})
