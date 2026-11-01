export type GoalState = 'ok' | 'near' | 'over'

export const NEAR_AT = 0.8

/** Quanto da meta já foi usado. `near` a partir de 80%, `over` quando passa de 100%. */
export function goalStatus(used: number, goal: number): { pct: number; state: GoalState; left: number } {
  const pct = goal > 0 ? used / goal : 0
  return { pct, state: used > goal ? 'over' : pct >= NEAR_AT ? 'near' : 'ok', left: goal - used }
}

/** Sugestão de meta: média dos últimos 3 meses com gasto, 10% abaixo, arredondada para R$ 10. */
export function suggestGoal(history: number[]): number | null {
  const last = history.filter((v) => v > 0).slice(-3)
  if (!last.length) return null
  const avg = last.reduce((a, b) => a + b, 0) / last.length
  return Math.max(Math.round((avg * 0.9) / 1000) * 1000, 1000)
}
