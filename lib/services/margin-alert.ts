export interface MarginAlert {
  currentMarginPercent: number
  targetProfitPercent: number
  shortfallPercent: number
}

// Pure — recomputed on every page load and after every batch insert, rather
// than stored, since it's cheap to derive from data already on hand.
export function computeMarginAlert(
  latestCost: number | null,
  sellingPrice: number | null,
  targetProfitPercent: number | null
): MarginAlert | null {
  if (!latestCost || latestCost <= 0) return null
  if (!sellingPrice || sellingPrice <= 0) return null
  if (targetProfitPercent === null) return null

  const currentMarginPercent = ((sellingPrice - latestCost) / latestCost) * 100
  if (currentMarginPercent >= targetProfitPercent) return null

  return {
    currentMarginPercent,
    targetProfitPercent,
    shortfallPercent: targetProfitPercent - currentMarginPercent,
  }
}
