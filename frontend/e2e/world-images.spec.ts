import { expect, test } from '@playwright/test'
import {
  createWorldApi,
  E2E_PASSWORD,
  loginUi,
  registerViaApi,
  uniqueUsername,
  writeWorldImageFile,
} from './helpers'

test.describe('Imágenes de mundo', () => {
  test('GET /api/worlds/…/image/… con Bearer devuelve 200 si el PNG existe en disco', async ({ page, request }) => {
    const username = uniqueUsername('img')
    const token = await registerViaApi(request, username)
    const wid = await createWorldApi(request, token, `MundoImg_${Date.now()}`)
    const filename = 'e2e-map.png'
    writeWorldImageFile(wid, filename)

    await loginUi(page, username, E2E_PASSWORD)

    const status = await page.evaluate(
      async ({ worldId, file }) => {
        const tok = localStorage.getItem('dndhelper_access_token')
        const res = await fetch(`/api/worlds/${worldId}/image/${file}`, {
          headers: tok ? { Authorization: `Bearer ${tok}` } : {},
        })
        return res.status
      },
      { worldId: wid, file: filename },
    )

    expect(status).toBe(200)
  })
})
