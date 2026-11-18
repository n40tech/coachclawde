import { describe, expect, it } from 'vitest'
import { PLAN_TEMPLATES, planFromTemplate, templateDays } from './planTemplates'
import { importPlanFromJson } from './export'
import { WEEK_DAYS, parseLocalISODate } from './weekUtils'

describe.each(PLAN_TEMPLATES.map((t) => [t.name, t] as const))('prewritten plan: %s', (_, template) => {
  const plan = planFromTemplate(template, '2026-11-23', new Date('2026-11-18T09:00:00Z'))

  it('is a plan the importer accepts', () => {
    expect(() => importPlanFromJson(JSON.stringify(plan))).not.toThrow()
  })

  it('puts each session on its weekday of the chosen week', () => {
    for (const s of plan.sessions) {
      expect(s.date >= '2026-11-23' && s.date <= '2026-11-29').toBe(true)
      expect(WEEK_DAYS[parseLocalISODate(s.date).getDay()]).toBe(s.dayOfWeek)
    }
    expect(plan.availableDays).toEqual(templateDays(template))
  })

  it('has unique, dated ids', () => {
    const ids = plan.sessions.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const s of plan.sessions) {
      expect(s.id.startsWith(`session-${s.date}-`)).toBe(true)
      const exIds = s.exercises?.map((e) => e.id) ?? []
      expect(new Set(exIds).size).toBe(exIds.length)
      exIds.forEach((id) => expect(id.startsWith(`ex-${s.date}-`)).toBe(true))
    }
  })

  it('carries no working weights (they belong to each athlete)', () => {
    const sets = plan.sessions.flatMap((s) => s.exercises ?? []).flatMap((e) => e.sets)
    expect(sets.length).toBeGreaterThan(0)
    sets.forEach((set) => expect(set.suggestedWeightKg).toBeUndefined())
    plan.sessions.flatMap((s) => s.warmupExercises ?? []).forEach((r) => expect(r.prescription).not.toMatch(/\d\s*kg/))
  })

  it('gives every session a warm-up', () => {
    for (const s of plan.sessions) {
      expect(s.warmup).toBeTruthy()
      expect(s.warmupExercises?.length).toBeGreaterThan(0)
    }
  })
})

describe('Bond Split', () => {
  const bond = PLAN_TEMPLATES.find((t) => t.id === 'bond-split')!

  it('is the three weights days only, without the cardio', () => {
    expect(bond.sessions.map((s) => [s.dayOfWeek, s.title])).toEqual([['Mon', 'Upper A'], ['Wed', 'Lower'], ['Fri', 'Upper B']])
    expect(bond.sessions.every((s) => s.type === 'weights')).toBe(true)
  })

  it('builds a fresh copy each time', () => {
    const a = planFromTemplate(bond, '2026-11-23')
    a.sessions[0].exercises![0].sets[0].reps = 'changed'
    expect(planFromTemplate(bond, '2026-11-23').sessions[0].exercises![0].sets[0].reps).toBe('6-8')
  })
})
