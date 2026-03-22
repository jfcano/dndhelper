import { expect, test } from '@playwright/test'
import { E2E_PASSWORD, ensureInstallationDone, loginUi, registerUi, uniqueUsername } from './helpers'

test.describe('Autenticación', () => {
  test('registro, acceso a /campaigns y cierre de sesión', async ({ page }) => {
    const username = uniqueUsername('reg')
    await registerUi(page, username, E2E_PASSWORD)
    await expect(page.getByRole('heading', { name: 'Campañas' })).toBeVisible()
    await page.getByRole('button', { name: 'Salir' }).click()
    await page.waitForURL(/\/login/)
  })

  test('login con credenciales incorrectas muestra error', async ({ page, request }) => {
    await ensureInstallationDone(request)
    const username = uniqueUsername('bad')
    const reg = await request.post('/api/auth/register', {
      data: { username, password: E2E_PASSWORD },
    })
    expect(reg.ok(), await reg.text()).toBeTruthy()
    await page.goto('/login')
    await page.getByLabel('Usuario').fill(username)
    await page.getByLabel('Contraseña').fill('wrongpass9')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.locator('.error-banner')).toContainText(/incorrectos|401/i)
    await expect(page).toHaveURL(/\/login/)
  })

  test('login correcto llega a campañas', async ({ page, request }) => {
    await ensureInstallationDone(request)
    const username = uniqueUsername('ok')
    const reg = await request.post('/api/auth/register', {
      data: { username, password: E2E_PASSWORD },
    })
    expect(reg.ok(), await reg.text()).toBeTruthy()
    await loginUi(page, username, E2E_PASSWORD)
    await expect(page.getByRole('heading', { name: 'Campañas' })).toBeVisible()
  })

  test('ruta protegida redirige a login sin token', async ({ page }) => {
    await page.goto('/campaigns')
    await page.waitForURL(/\/login/)
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
  })
})
