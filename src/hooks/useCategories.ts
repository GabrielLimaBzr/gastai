'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { merchantOf } from '@/lib/anomalies'

export interface Cat { id: string; name: string }
export interface Rule { pattern: string; category_id: string }

/** Categorias e regras "estabelecimento → categoria" do usuário. */
export function useCategories() {
  const supabase = createClient()
  const [cats, setCats] = useState<Cat[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [ready, setReady] = useState(false)

  const load = useCallback(async () => {
    const [c, r] = await Promise.all([
      supabase.from('categories').select('id,name').order('name'),
      supabase.from('merchant_rules').select('pattern,category_id'),
    ])
    setCats((c.data as Cat[]) ?? [])
    setRules((r.data as Rule[]) ?? [])
    setReady(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  /** Devolve o id da categoria, criando se não existir. */
  async function ensure(name: string): Promise<string> {
    const found = cats.find((c) => c.name === name)
    if (found) return found.id
    const { data, error } = await supabase.from('categories').insert({ name }).select('id,name').single()
    if (error) throw error
    setCats((p) => [...p, data as Cat])
    return data.id
  }

  /** Guarda (ou remove) a regra para que próximas importações já venham categorizadas. */
  async function saveRule(description: string, categoryId: string | null) {
    const pattern = merchantOf(description)
    if (!pattern) return
    await supabase.from('merchant_rules').delete().eq('pattern', pattern)
    if (categoryId) await supabase.from('merchant_rules').insert({ pattern, category_id: categoryId })
    setRules((p) => [...p.filter((r) => r.pattern !== pattern), ...(categoryId ? [{ pattern, category_id: categoryId }] : [])])
  }

  const ruleFor = (description: string): string | null => {
    const m = merchantOf(description)
    return rules.find((r) => m.includes(r.pattern))?.category_id ?? null
  }

  return { cats, rules, ready, ensure, saveRule, ruleFor }
}
