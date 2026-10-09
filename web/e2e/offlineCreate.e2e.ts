import { expect, test } from '@playwright/test'

interface ServerWine {
  millesime: number
  color: string
  quantity: number
  garde_debut: number
  garde_fin: number
}

test('a wine created offline reaches the server after reconnecting', async ({ page, context, request }) => {
  // Server state is read with the runner's own HTTP client, never the browser,
  // so a service-worker cache cannot hide it.
  const serverWines = async () => (await (await request.get('/wines')).json()) as ServerWine[]

  // Online first visit: service worker installs, reference data loads.
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await expect(page.getByTestId('offline-banner')).toBeHidden()

  await context.setOffline(true)
  await expect(page.getByTestId('offline-banner')).toBeVisible()

  await page.getByTestId('add-wine-link').click()
  await expect(page.getByTestId('wine-form')).toBeVisible()
  await page.getByTestId('wine-millesime-input').fill('2018')
  await page.getByTestId('wine-color-input').selectOption('rouge')
  await page.getByTestId('wine-appellation-input').click()
  await page.getByTestId('wine-appellation-option').filter({ hasText: 'Savennières' }).click()
  await page.getByTestId('wine-producer-input').click()
  await page.getByTestId('wine-producer-option').filter({ hasText: 'Domaine du Closel' }).click()
  await page.getByTestId('wine-garde-debut-input').fill('2020')
  await page.getByTestId('wine-garde-debut-input').blur() // auto-fills Garde end
  await page.getByTestId('wine-garde-fin-input').fill('2028')
  await page.getByTestId('wine-quantity-input').fill('6')
  await page.getByTestId('wine-form-submit').click()

  // The cellar list is fed by the server (/search), so offline the new wine
  // is visible on the detail page the form navigates to, not in the list.
  await expect(page.getByTestId('sync-pending-badge')).toBeVisible()
  expect(await serverWines()).toHaveLength(0)

  await context.setOffline(false)
  await expect(page.getByTestId('offline-banner')).toBeHidden()
  await expect(page.getByTestId('sync-pending-badge')).toBeHidden()

  await expect.poll(async () => (await serverWines()).length).toBe(1)
  const [wine] = await serverWines()
  expect(wine).toMatchObject({ millesime: 2018, color: 'rouge', quantity: 6, garde_debut: 2020, garde_fin: 2028 })

  await page.goto('/')
  await expect(page.getByTestId('wine-item')).toHaveCount(1)
  await page.reload()
  await expect(page.getByTestId('wine-item')).toHaveCount(1)
})
