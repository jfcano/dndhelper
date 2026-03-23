import { expect } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import * as fs from 'node:fs'
import * as path from 'node:path'

export const E2E_PASSWORD = 'E2e_test_pw_12'

/**
 * Si la API aún no tiene administrador, ejecuta POST /api/setup/ (contraseña maestra desde env).
 */
export async function ensureInstallationDone(request: APIRequestContext) {
  const st = await request.get('/api/setup/status')
  if (!st.ok()) return
  const j = (await st.json()) as { needs_setup: boolean; setup_available: boolean }
  if (!j.needs_setup) return
  const master = process.env.E2E_SETUP_MASTER_PASSWORD?.trim()
  expect(
    !!master,
    'Falta E2E_SETUP_MASTER_PASSWORD para bootstrap de /api/setup cuando needs_setup=true.',
  ).toBeTruthy()
  const username = process.env.E2E_ADMIN_USERNAME ?? 'e2e_admin'
  const password = process.env.E2E_ADMIN_PASSWORD ?? 'E2e_admin_pw_12'
  const res = await request.post('/api/setup/', {
    data: {
      master_password: master!,
      username,
      password,
    },
  })
  if (!res.ok() && res.status() !== 409) {
    expect(res.ok(), await res.text()).toBeTruthy()
  }
}

/** PNG mínimo válido (1×1). */
export const MIN_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

/** Nombre de usuario único; la API exige ≤32 caracteres y `[a-zA-Z0-9_]`. */
export function uniqueUsername(kind = 'u'): string {
  const k = kind.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 6) || 'u'
  const n = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  return `${k}_${n}`.slice(0, 32)
}

export async function registerViaApi(request: APIRequestContext, username: string) {
  await ensureInstallationDone(request)
  const res = await request.post('/api/auth/register', {
    data: { username, password: E2E_PASSWORD },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  const body = (await res.json()) as { access_token: string }
  return body.access_token
}

export async function loginUi(page: Page, username: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Usuario').fill(username)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Campañas' })).toBeVisible({ timeout: 60_000 })
}

export async function registerUi(page: Page, username: string, password: string) {
  await ensureInstallationDone(page.context().request)
  await page.goto('/register')
  await page.getByLabel('Usuario').fill(username)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Registrarse' }).click()
  await page.waitForURL(/\/campaigns/)
}

export async function createWorldApi(request: APIRequestContext, token: string, name: string): Promise<string> {
  const res = await request.post('/api/worlds', {
    headers: { Authorization: `Bearer ${token}` },
    data: { name },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  const body = (await res.json()) as { id: string }
  return body.id
}

export async function setWorldDraftAndApproveApi(
  request: APIRequestContext,
  token: string,
  worldId: string,
  contentDraft: string,
) {
  let res = await request.patch(`/api/worlds/${worldId}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { content_draft: contentDraft },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  res = await request.post(`/api/worlds/${worldId}/approve`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {},
  })
  expect(res.ok(), await res.text()).toBeTruthy()
}

export async function putOpenAiKeyForUser(request: APIRequestContext, token: string, apiKey: string) {
  const res = await request.put('/api/settings/openai', {
    headers: { Authorization: `Bearer ${token}` },
    data: { openai_api_key: apiKey },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
}

/**
 * Escribe un PNG en `backend/storage/world_images/<worldId>/` (misma ruta que usa la API en desarrollo).
 * `cwd` debe ser el directorio `frontend/` al ejecutar Playwright.
 * En Docker Compose (servicio `e2e`), monta `./backend/storage` en `/backend/storage` para que el backend vea el mismo fichero.
 */
export function writeWorldImageFile(worldId: string, filename: string, bytes: Buffer = MIN_PNG) {
  const storageBase =
    process.env.E2E_BACKEND_STORAGE_DIR?.trim() || path.resolve(process.cwd(), '..', 'backend', 'storage')
  const dir = path.resolve(storageBase, 'world_images', worldId)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, filename), bytes)
}
