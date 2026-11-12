import type { Tea } from "./storage/storage"

const stockGrams: Record<Tea["stock"], number> = {
  "无": 0,
  "一两": 50,
  "半斤以上": 250,
}

export function calculateTeaStatistics(teas: readonly Pick<Tea, "stock" | "pricePerJin" | "cupBrew" | "gongfuBrew">[]) {
  let stockedCount = 0
  let unconfiguredCount = 0
  let grams = 0
  let weightedPrice = 0
  for (const tea of teas) {
    if (tea.cupBrew.grams300ml == null && tea.gongfuBrew.grams == null) unconfiguredCount++
    const weight = stockGrams[tea.stock]
    if (weight > 0) stockedCount++
    grams += weight
    // Unpriced teas still contribute to count and weight, but not value.
    weightedPrice += weight * (tea.pricePerJin ?? 0)
  }
  return {
    stockedCount,
    registeredCount: teas.length,
    unconfiguredCount,
    weight: `${Math.floor(grams / 500)}斤${(grams % 500) / 50}两`,
    // Round the combined value once rather than rounding each tea separately.
    value: Math.round(weightedPrice / 500),
  }
}
