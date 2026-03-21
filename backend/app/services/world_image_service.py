"""Mapas, emblemas y retratos bajo demanda (OpenAI Images API, p. ej. DALL·E 3)."""

from __future__ import annotations

import base64
import copy
import logging
import re
import shutil
from pathlib import Path
from typing import Any
from uuid import UUID

import httpx

from backend.app.config import get_settings
from backend.app.openai_key_runtime import get_openai_key_for_llm_and_embeddings
from backend.app.prompts.loader import render_prompt_template

logger = logging.getLogger(__name__)


def _slug(s: str, max_len: int = 48) -> str:
    x = re.sub(r"[^a-z0-9]+", "_", (s or "").lower().strip())
    x = x.strip("_")[:max_len].strip("_")
    return x or "item"


def world_images_base_dir() -> Path:
    return get_settings().project_root / "backend" / "storage" / "world_images"


def world_images_dir(world_id: UUID) -> Path:
    return world_images_base_dir() / str(world_id)


def clear_world_images_dir(world_id: UUID) -> None:
    d = world_images_dir(world_id)
    if d.exists():
        shutil.rmtree(d, ignore_errors=True)


def images_generation_allowed() -> bool:
    s = get_settings()
    if not s.world_image_generation_enabled:
        return False
    try:
        get_openai_key_for_llm_and_embeddings()
    except RuntimeError:
        return False
    return True


def _generate_image_png_bytes(*, prompt: str) -> bytes:
    settings = get_settings()
    api_key = get_openai_key_for_llm_and_embeddings()
    url = "https://api.openai.com/v1/images/generations"
    body: dict[str, Any] = {
        "model": settings.openai_image_model,
        "prompt": prompt[:3800] if len(prompt) > 3800 else prompt,
        "n": 1,
        "size": "1024x1024",
        "response_format": "b64_json",
    }
    if settings.openai_image_model.startswith("dall-e-3"):
        body["quality"] = "standard"
    with httpx.Client(timeout=180.0) as client:
        r = client.post(
            url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=body,
        )
        r.raise_for_status()
        data = r.json()
        b64 = data["data"][0]["b64_json"]
        return base64.b64decode(b64)


def _write_png(path: Path, prompt: str) -> tuple[bool, str | None]:
    try:
        blob = _generate_image_png_bytes(prompt=prompt)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(blob)
        return True, None
    except Exception as e:
        logger.exception("Fallo generando imagen en %s", path)
        return False, str(e)[:500]


def _prompt_world_map(world_name: str, tone: str | None, pitch: str | None, flavor: str) -> str:
    return render_prompt_template(
        "image_world_map.txt",
        {
            "__WORLD_NAME__": world_name,
            "__TONE__": tone or "heroic fantasy",
            "__PITCH__": (pitch or "")[:400],
            "__FLAVOR__": (flavor or "")[:500],
        },
    )


def _prompt_city_map(city_name: str, theme: str, world_flavor: str) -> str:
    return render_prompt_template(
        "image_city_map.txt",
        {
            "__CITY_NAME__": city_name,
            "__THEME__": (theme or "")[:500],
            "__WORLD_FLAVOR__": (world_flavor or "")[:300],
        },
    )


def _prompt_region_map(region_name: str, summary: str, world_flavor: str) -> str:
    return render_prompt_template(
        "image_region_map.txt",
        {
            "__REGION_NAME__": region_name,
            "__SUMMARY__": (summary or "")[:500],
            "__WORLD_FLAVOR__": (world_flavor or "")[:300],
        },
    )


def _prompt_emblem(faction_name: str, objective: str, world_flavor: str) -> str:
    return render_prompt_template(
        "image_faction_emblem.txt",
        {
            "__FACTION_NAME__": faction_name,
            "__OBJECTIVE__": (objective or "")[:450],
            "__WORLD_FLAVOR__": (world_flavor or "")[:300],
        },
    )


def _visual_description_for_portrait(gender: str | None, appearance: str | None, *, max_len: int = 420) -> str:
    """Texto explícito para el modelo de imagen (género + apariencia); evita que solo vea nombre/rol."""
    g = (gender or "").strip()
    a = (appearance or "").strip()
    parts: list[str] = []
    if g:
        parts.append(f"Gender / presentation (must match in the image): {g}")
    if a:
        parts.append(f"Physical build, apparent age, skin, hair, iconic clothing or gear: {a}")
    s = " ".join(parts)
    if not s:
        return (
            "No explicit gender or appearance was provided; stay consistent with name and role only where "
            "reasonable; avoid stereotypical or random gender defaults."
        )
    return s[:max_len]


def _prompt_portrait(
    char_name: str,
    faction: str,
    role: str,
    motivation: str,
    world_flavor: str,
    *,
    gender: str | None = None,
    appearance: str | None = None,
) -> str:
    return render_prompt_template(
        "image_character_portrait.txt",
        {
            "__CHAR_NAME__": char_name,
            "__FACTION__": faction,
            "__ROLE__": (role or "")[:200],
            "__MOTIVATION__": (motivation or "")[:300],
            "__VISUAL_DESCRIPTION__": _visual_description_for_portrait(gender, appearance),
            "__WORLD_FLAVOR__": (world_flavor or "")[:250],
        },
    )


def _prompt_npc_portrait(
    name: str,
    role: str,
    hook: str,
    world_flavor: str,
    *,
    gender: str | None = None,
    appearance: str | None = None,
) -> str:
    return render_prompt_template(
        "image_npc_portrait.txt",
        {
            "__NAME__": name,
            "__ROLE__": (role or "")[:200],
            "__HOOK__": (hook or "")[:350],
            "__VISUAL_DESCRIPTION__": _visual_description_for_portrait(gender, appearance),
            "__WORLD_FLAVOR__": (world_flavor or "")[:300],
        },
    )


def build_wizard_visual_slots(
    *,
    theme_and_mood: str,
    factions: list[dict],
    characters: list[dict],
    cities: list[dict],
    world_name: str,
    pitch: str | None,
    tone: str | None,
    content_snippet: str,
) -> dict[str, Any]:
    """Plantilla sin archivos: el usuario genera cada imagen con el endpoint."""
    ctx = {
        "theme_and_mood": theme_and_mood,
        "factions": factions,
        "characters": characters,
        "cities": cities,
        "world_name": world_name,
        "pitch": pitch,
        "tone": tone,
        "content_snippet": content_snippet[:2000],
    }
    city_maps: list[dict[str, Any]] = []
    for i, c in enumerate(cities):
        if not isinstance(c, dict):
            continue
        name = str(c.get("name") or f"Ciudad_{i}").strip()
        fn = f"city_{i:02d}_{_slug(name)}.png"
        city_maps.append(
            {
                "name": name,
                "kind": "city",
                "planned_file": fn,
                "file": None,
                "error": None,
            }
        )

    faction_emblems: list[dict[str, Any]] = []
    for i, f in enumerate(factions):
        if not isinstance(f, dict):
            continue
        name = str(f.get("name") or f"Facción_{i}").strip()
        fn = f"faction_{i:02d}_{_slug(name)}.png"
        faction_emblems.append(
            {
                "faction_name": name,
                "planned_file": fn,
                "file": None,
                "error": None,
            }
        )

    character_portraits: list[dict[str, Any]] = []
    for i, ch in enumerate(characters):
        if not isinstance(ch, dict):
            continue
        name = str(ch.get("name") or f"PNJ_{i}").strip()
        fac = str(ch.get("faction_name") or "")
        gender = str(ch.get("gender") or "").strip()
        appearance = str(ch.get("appearance") or "").strip()
        fn = f"character_{i:02d}_{_slug(name)}.png"
        character_portraits.append(
            {
                "name": name,
                "faction_name": fac,
                "gender": gender or None,
                "appearance": appearance or None,
                "planned_file": fn,
                "file": None,
                "error": None,
            }
        )

    return {
        "status": "pending",
        "source": "wizard",
        "_context": ctx,
        "world_map": {
            "label": "Mapa del mundo",
            "planned_file": "world_map.png",
            "file": None,
            "error": None,
        },
        "city_maps": city_maps,
        "faction_emblems": faction_emblems,
        "character_portraits": character_portraits,
    }


def build_brief_visual_slots(
    *,
    draft: dict[str, Any],
    world_name: str,
    pitch: str | None,
    tone: str | None,
) -> dict[str, Any]:
    ctx = {
        "draft": draft,
        "world_name": world_name,
        "pitch": pitch,
        "tone": tone,
    }
    overview = str(draft.get("overview") or "")
    flavor = f"{overview}\n{pitch or ''}"[:2000]

    regions = draft.get("regions") if isinstance(draft.get("regions"), list) else []
    factions = draft.get("factions") if isinstance(draft.get("factions"), list) else []
    npcs = draft.get("major_npcs") if isinstance(draft.get("major_npcs"), list) else []
    cities_raw = draft.get("cities") if isinstance(draft.get("cities"), list) else []

    city_maps: list[dict[str, Any]] = []
    if cities_raw:
        for i, c in enumerate(cities_raw):
            if not isinstance(c, dict):
                continue
            nm = str(c.get("name") or f"Ciudad_{i}").strip()
            fn = f"city_{i:02d}_{_slug(nm)}.png"
            city_maps.append(
                {
                    "name": nm,
                    "kind": "city",
                    "planned_file": fn,
                    "file": None,
                    "error": None,
                }
            )
    else:
        for i, reg in enumerate(regions):
            if not isinstance(reg, dict):
                continue
            nm = str(reg.get("name") or f"Región_{i}").strip()
            fn = f"region_{i:02d}_{_slug(nm)}.png"
            label = f"Región: {nm}"
            city_maps.append(
                {
                    "name": label,
                    "kind": "region",
                    "planned_file": fn,
                    "file": None,
                    "error": None,
                }
            )

    faction_emblems: list[dict[str, Any]] = []
    for i, f in enumerate(factions):
        if not isinstance(f, dict):
            continue
        name = str(f.get("name") or f"Facción_{i}").strip()
        fn = f"faction_{i:02d}_{_slug(name)}.png"
        faction_emblems.append(
            {
                "faction_name": name,
                "planned_file": fn,
                "file": None,
                "error": None,
            }
        )

    character_portraits: list[dict[str, Any]] = []
    for i, n in enumerate(npcs):
        if not isinstance(n, dict):
            continue
        name = str(n.get("name") or f"PNJ_{i}").strip()
        gender = str(n.get("gender") or "").strip()
        appearance = str(n.get("appearance") or "").strip()
        fn = f"npc_{i:02d}_{_slug(name)}.png"
        character_portraits.append(
            {
                "name": name,
                "faction_name": "",
                "gender": gender or None,
                "appearance": appearance or None,
                "planned_file": fn,
                "file": None,
                "error": None,
            }
        )

    # flavor precalculado para prompts (evita recomputar en cada generación)
    ctx["_flavor_brief"] = flavor

    return {
        "status": "pending",
        "source": "brief",
        "_context": ctx,
        "world_map": {
            "label": "Mapa del mundo",
            "planned_file": "world_map.png",
            "file": None,
            "error": None,
        },
        "city_maps": city_maps,
        "faction_emblems": faction_emblems,
        "character_portraits": character_portraits,
    }


def _wizard_flavor(ctx: dict[str, Any]) -> str:
    theme = str(ctx.get("theme_and_mood") or "")
    snippet = str(ctx.get("content_snippet") or "")[:1500]
    return f"{theme}\n{snippet}".strip()


def apply_slot_generation(
    world_id: UUID,
    assets: dict[str, Any],
    target: str,
    index: int,
) -> tuple[dict[str, Any], bool, str | None]:
    """
    Genera una sola imagen y actualiza el dict visual_assets (copia profunda).
    Devuelve (nuevo_dict, ok, mensaje_error).
    """
    if not images_generation_allowed():
        return assets, False, "Generación de imágenes desactivada o falta OPENAI_API_KEY."

    out = copy.deepcopy(assets)
    ctx = out.get("_context")
    if not isinstance(ctx, dict):
        return out, False, "Este mundo no tiene plantilla de imágenes. Regenera el mundo con el asistente."

    source = out.get("source")
    root = world_images_dir(world_id)

    if target == "world_map":
        wm = out.get("world_map")
        if not isinstance(wm, dict):
            return out, False, "Mapa del mundo no definido en la plantilla."
        pfn = str(wm.get("planned_file") or "world_map.png")
        path = root / pfn
        world_name = str(ctx.get("world_name") or "Mundo")
        pitch = ctx.get("pitch")
        tone = ctx.get("tone")
        if source == "brief":
            flavor = str(ctx.get("_flavor_brief") or "")
            ok, err = _write_png(
                path,
                _prompt_world_map(
                    world_name,
                    tone if isinstance(tone, str) else None,
                    pitch if isinstance(pitch, str) else None,
                    flavor,
                ),
            )
        else:
            flavor = _wizard_flavor(ctx)
            ok, err = _write_png(
                path,
                _prompt_world_map(
                    world_name,
                    tone if isinstance(tone, str) else None,
                    pitch if isinstance(pitch, str) else None,
                    flavor,
                ),
            )
        if ok:
            wm["file"] = pfn
            wm["error"] = None
        else:
            wm["error"] = err or "Error desconocido"
        return out, ok, err

    if target == "city_map":
        items = out.get("city_maps")
        if not isinstance(items, list) or index < 0 or index >= len(items):
            return out, False, "Índice de mapa local inválido."
        slot = items[index]
        if not isinstance(slot, dict):
            return out, False, "Entrada de mapa inválida."
        pfn = str(slot.get("planned_file") or "")
        if not pfn:
            return out, False, "Falta planned_file en el mapa."
        path = root / pfn
        name = str(slot.get("name") or "").replace("Región: ", "", 1) if slot.get("kind") == "region" else str(slot.get("name") or "")
        kind = slot.get("kind") or "city"

        if source == "brief":
            flavor = str(ctx.get("_flavor_brief") or "")
            draft = ctx.get("draft") if isinstance(ctx.get("draft"), dict) else {}
            if kind == "region":
                regions = draft.get("regions") if isinstance(draft.get("regions"), list) else []
                reg = regions[index] if index < len(regions) and isinstance(regions[index], dict) else {}
                summ = str(reg.get("summary") or "")
                prompt = _prompt_region_map(name, summ, flavor)
            else:
                cities_raw = draft.get("cities") if isinstance(draft.get("cities"), list) else []
                c = cities_raw[index] if index < len(cities_raw) and isinstance(cities_raw[index], dict) else {}
                th = str(c.get("theme") or c.get("summary") or "")
                prompt = _prompt_city_map(str(slot.get("name") or name), th, flavor)
        else:
            flavor = _wizard_flavor(ctx)
            cities = ctx.get("cities") if isinstance(ctx.get("cities"), list) else []
            c = cities[index] if index < len(cities) and isinstance(cities[index], dict) else {}
            th = str(c.get("theme") or "")
            prompt = _prompt_city_map(str(slot.get("name") or name), th, flavor)

        ok, err = _write_png(path, prompt)
        if ok:
            slot["file"] = pfn
            slot["error"] = None
        else:
            slot["error"] = err or "Error desconocido"
        return out, ok, err

    if target == "faction_emblem":
        items = out.get("faction_emblems")
        if not isinstance(items, list) or index < 0 or index >= len(items):
            return out, False, "Índice de facción inválido."
        slot = items[index]
        if not isinstance(slot, dict):
            return out, False, "Entrada de facción inválida."
        pfn = str(slot.get("planned_file") or "")
        path = root / pfn
        fname = str(slot.get("faction_name") or "")

        if source == "brief":
            flavor = str(ctx.get("_flavor_brief") or "")
            draft = ctx.get("draft") if isinstance(ctx.get("draft"), dict) else {}
            factions = draft.get("factions") if isinstance(draft.get("factions"), list) else []
            f = factions[index] if index < len(factions) and isinstance(factions[index], dict) else {}
            goal = str(f.get("goal") or f.get("objective") or "")
            methods = str(f.get("methods") or "")
            obj = f"{goal} {methods}".strip()
        else:
            flavor = _wizard_flavor(ctx)
            factions = ctx.get("factions") if isinstance(ctx.get("factions"), list) else []
            f = factions[index] if index < len(factions) and isinstance(factions[index], dict) else {}
            obj = str(f.get("objective") or "")

        ok, err = _write_png(path, _prompt_emblem(fname, obj, flavor))
        if ok:
            slot["file"] = pfn
            slot["error"] = None
        else:
            slot["error"] = err or "Error desconocido"
        return out, ok, err

    if target == "character_portrait":
        items = out.get("character_portraits")
        if not isinstance(items, list) or index < 0 or index >= len(items):
            return out, False, "Índice de personaje inválido."
        slot = items[index]
        if not isinstance(slot, dict):
            return out, False, "Entrada de personaje inválida."
        pfn = str(slot.get("planned_file") or "")
        path = root / pfn
        pname = str(slot.get("name") or "")

        if source == "brief":
            flavor = str(ctx.get("_flavor_brief") or "")
            draft = ctx.get("draft") if isinstance(ctx.get("draft"), dict) else {}
            npcs = draft.get("major_npcs") if isinstance(draft.get("major_npcs"), list) else []
            n = npcs[index] if index < len(npcs) and isinstance(npcs[index], dict) else {}
            role = str(n.get("role") or "")
            hook = str(n.get("hook") or "")
            ng = str(n.get("gender") or "").strip() or None
            na = str(n.get("appearance") or "").strip() or None
            # Si el borrador no trae género/apariencia, usar lo guardado en el slot (p. ej. edición manual JSON).
            sg = str(slot.get("gender") or "").strip() or None
            sa = str(slot.get("appearance") or "").strip() or None
            prompt = _prompt_npc_portrait(
                pname,
                role,
                hook,
                flavor,
                gender=ng or sg,
                appearance=na or sa,
            )
        else:
            flavor = _wizard_flavor(ctx)
            characters = ctx.get("characters") if isinstance(ctx.get("characters"), list) else []
            ch = characters[index] if index < len(characters) and isinstance(characters[index], dict) else {}
            fac = str(ch.get("faction_name") or "")
            role = str(ch.get("role") or "")
            mot = str(ch.get("motivation") or "")
            cg = str(ch.get("gender") or "").strip() or None
            ca = str(ch.get("appearance") or "").strip() or None
            sg = str(slot.get("gender") or "").strip() or None
            sa = str(slot.get("appearance") or "").strip() or None
            prompt = _prompt_portrait(
                pname,
                fac,
                role,
                mot,
                flavor,
                gender=cg or sg,
                appearance=ca or sa,
            )

        ok, err = _write_png(path, prompt)
        if ok:
            slot["file"] = pfn
            slot["error"] = None
        else:
            slot["error"] = err or "Error desconocido"
        return out, ok, err

    return out, False, f"Objetivo desconocido: {target}"


# Compatibilidad con código que aún llame should_run_image_job
def should_run_image_job() -> bool:
    return images_generation_allowed()
