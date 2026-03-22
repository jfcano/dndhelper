import { expect, test } from '@playwright/test'
import {
  createWorldApi,
  E2E_PASSWORD,
  loginUi,
  putOpenAiKeyForUser,
  registerViaApi,
  setWorldDraftAndApproveApi,
  uniqueUsername,
} from './helpers'

test.describe('Campaña (UI)', () => {
  test('el desplegable de mundos del asistente solo lista mundos aprobados', async ({ page, request }) => {
    const username = uniqueUsername('w')
    const token = await registerViaApi(request, username)
    const draftName = `MundoBorrador_${Date.now()}`
    const approvedName = `MundoAprobado_${Date.now()}`
    await createWorldApi(request, token, draftName)
    const approvedId = await createWorldApi(request, token, approvedName)
    await setWorldDraftAndApproveApi(request, token, approvedId, 'Lore mínimo para E2E.')

    await loginUi(page, username, E2E_PASSWORD)
    await page.getByRole('button', { name: 'Crear nueva campaña' }).click()
    await page.waitForURL(/\/campaigns\/[^/]+$/)

    await page.getByText('Mundo para la campaña').waitFor({ state: 'visible' })
    const combo = page.getByRole('combobox').first()
    await expect(combo.locator('option')).toHaveCount(2)
    await expect(combo.locator('option', { hasText: approvedName })).toHaveCount(1)
    await expect(combo.locator('option', { hasText: draftName })).toHaveCount(0)
  })

  test('brief con IA, outline en JSON y botón crear sesiones habilitado', async ({ page, request }) => {
    const openai = process.env.E2E_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY
    test.skip(!openai, 'Requiere OPENAI_API_KEY o E2E_OPENAI_API_KEY (se guarda en Ajustes del usuario vía API).')

    const username = uniqueUsername('j')
    const token = await registerViaApi(request, username)
    await putOpenAiKeyForUser(request, token, openai!)

    const approvedName = `MundoJourney_${Date.now()}`
    const wid = await createWorldApi(request, token, approvedName)
    await setWorldDraftAndApproveApi(request, token, wid, 'Mundo de prueba para campaña E2E.')

    await loginUi(page, username, E2E_PASSWORD)
    await page.getByRole('button', { name: 'Crear nueva campaña' }).click()
    await page.waitForURL(/\/campaigns\/[^/]+$/)

    await page.getByText('Mundo para la campaña').waitFor({ state: 'visible' })
    const worldSelect = page.locator('select').first()
    await worldSelect.selectOption({ label: `${approvedName} (Aprobado)` })
    await page.getByRole('button', { name: 'Vincular mundo a la campaña' }).click()

    await expect(page.getByRole('button', { name: 'Siguiente paso del asistente' })).toBeEnabled({ timeout: 30_000 })
    await page.getByRole('button', { name: 'Siguiente paso del asistente' }).click()

    await page.getByPlaceholder('intriga política, exploración, horror…').first().fill('E2E tema')
    await page.getByRole('button', { name: 'Siguiente paso del asistente' }).click()

    await expect(page.getByRole('button', { name: 'Guardar borrador del brief' })).toBeEnabled({ timeout: 120_000 })
    await page.getByRole('button', { name: 'Guardar borrador del brief' }).click()

    await page.getByRole('heading', { name: 'Borrador del resumen de historia' }).waitFor({ state: 'visible', timeout: 120_000 })
    await page.getByRole('button', { name: 'Aprobar resumen de historia' }).click()

    await page.getByRole('heading', { name: 'Outline de campaña' }).waitFor({ state: 'visible', timeout: 60_000 })
    const outlineJson = page.locator('label').filter({ hasText: 'Borrador (JSON editable)' }).locator('textarea')
    await outlineJson.fill('{"e2e":true,"acts":[]}')

    await page.getByRole('button', { name: 'Guardar borrador del outline (JSON)' }).click()
    await expect(page.getByText('Outline guardado')).toBeVisible({ timeout: 30_000 })

    await expect(page.getByRole('button', { name: 'Aprobar outline' })).toBeEnabled({ timeout: 30_000 })
    await page.getByRole('button', { name: 'Aprobar outline' }).click()
    await expect(page.getByText(/Outline aprobado/i)).toBeVisible({ timeout: 30_000 })

    await page.getByRole('tab', { name: 'Sesiones' }).click()
    await expect(page.getByRole('button', { name: 'Crear sesiones y generar con IA' })).toBeEnabled()
  })
})
