import { expect, test } from '@playwright/test'
import { putOpenAiKeyForUser, registerViaApi, uniqueUsername } from './helpers'

test.describe('Generación IA (API)', () => {
  test('genera mundo, imagen, campaña y sesiones', async ({ request }) => {
    test.setTimeout(300_000)

    const openai = process.env.E2E_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY
    test.skip(
      !openai,
      'Requiere OPENAI_API_KEY o E2E_OPENAI_API_KEY (se toma desde .env en docker-compose e2e).',
    )

    const username = uniqueUsername('gen')
    const token = await registerViaApi(request, username)
    await putOpenAiKeyForUser(request, token, openai!)
    const headers = { Authorization: `Bearer ${token}` }

    // 1) Crear mundo y generarlo con IA.
    const worldName = `MundoAI_${Date.now()}`
    let res = await request.post('/api/worlds', {
      headers,
      data: { name: worldName },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    const world = (await res.json()) as { id: string }
    const worldId = world.id

    res = await request.post(`/api/worlds/${worldId}/generate`, {
      headers,
      data: {
        theme_and_mood: 'fantasía oscura con intriga política y magia ancestral',
        factions: [{ name: 'Casa Arkan', objective: 'Controlar los puertos del norte' }],
        characters: [
          {
            name: 'Lyra Voss',
            faction_name: 'Casa Arkan',
            role: 'Espía',
            motivation: 'Desvelar una conspiración en la corte',
            gender: 'mujer',
            appearance: 'cabello corto negro, gabardina azul y cicatriz en la ceja',
          },
        ],
        cities: [{ name: 'Puerto Niebla', theme: 'niebla, comercio y corrupción', relations: [] }],
      },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    const generatedWorld = (await res.json()) as {
      id: string
      status: string
      content_draft: string | null
    }
    expect(generatedWorld.id).toBe(worldId)
    expect(generatedWorld.status).toBe('draft')
    expect((generatedWorld.content_draft ?? '').length).toBeGreaterThan(50)

    // 2) Generar una imagen del mundo y aprobarlo.
    res = await request.post(`/api/worlds/${worldId}/visual:generate`, {
      headers,
      data: { target: 'world_map', index: 0 },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    const worldWithImage = (await res.json()) as {
      visual_assets?: {
        world_map?: { file?: string | null }
      } | null
    }
    expect((worldWithImage.visual_assets?.world_map?.file ?? '').length).toBeGreaterThan(0)

    res = await request.post(`/api/worlds/${worldId}/approve`, {
      headers,
      data: {},
    })
    expect(res.ok(), await res.text()).toBeTruthy()

    // 3) Crear campaña y generar su brief con IA.
    const campaignName = `CampañaAI_${Date.now()}`
    res = await request.post('/api/campaigns', {
      headers,
      data: { name: campaignName },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    const campaign = (await res.json()) as { id: string }
    const campaignId = campaign.id

    res = await request.patch(`/api/campaigns/${campaignId}`, {
      headers,
      data: { world_id: worldId },
    })
    expect(res.ok(), await res.text()).toBeTruthy()

    res = await request.post(`/api/campaigns/${campaignId}/brief`, {
      headers,
      data: {
        kind: 'sandbox',
        tone: 'misterio y aventura',
        themes: ['intriga', 'exploración'],
        starting_level: 3,
        inspirations: ['The Witcher', 'Baldur\'s Gate'],
        constraints: { magic_level: 'medio' },
      },
    })
    expect(res.ok(), await res.text()).toBeTruthy()

    res = await request.post(`/api/campaigns/${campaignId}/brief/approve`, {
      headers,
      data: {},
    })
    expect(res.ok(), await res.text()).toBeTruthy()

    // 4) Generar y aprobar outline; luego generar sesiones con IA.
    res = await request.post(`/api/campaigns/${campaignId}/outline:generate`, {
      headers,
      data: {},
    })
    expect(res.ok(), await res.text()).toBeTruthy()

    res = await request.post(`/api/campaigns/${campaignId}/outline/approve`, {
      headers,
      data: {},
    })
    expect(res.ok(), await res.text()).toBeTruthy()

    res = await request.post(`/api/campaigns/${campaignId}/sessions:generate?session_count=2`, {
      headers,
      data: {},
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    const sessions = (await res.json()) as Array<{ title: string; summary: string | null }>
    expect(sessions).toHaveLength(2)
    for (const s of sessions) {
      expect((s.title ?? '').trim().length).toBeGreaterThan(0)
      expect((s.summary ?? '').trim().length).toBeGreaterThan(0)
    }
  })
})
