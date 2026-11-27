import { expect, test } from '@playwright/test'

// One smoke test for the whole app: it loads, Home shows the demo lifter's
// week, and a workout opens. It catches a blank screen or a crash on start,
// the failures unit tests can't see. Everything else is checked by hand on a
// phone (docs/DEVELOPING.md → Workflow).

test('the app loads, shows Home and opens a workout, with no errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`Uncaught: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`Console: ${m.text()}`)
  })

  // A Monday morning, so the demo week's first workout (Upper Body) is today's
  // whatever day the test runs.
  await page.clock.setFixedTime(new Date('2026-11-23T08:00:00'))

  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: /Demo/ })).toBeVisible()

  await page.getByRole('link', { name: /Upper Body/ }).first().click()
  await expect(page).toHaveURL(/\/session\//)
  await expect(page.getByText('Barbell Bench Press').first()).toBeVisible()

  expect(errors).toEqual([])
})
