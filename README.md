## dndhelper

Prototipo (Fase 1–3): backend en Python con **FastAPI + LangChain**.

- RAG sobre PDFs de D&D usando **Postgres + pgvector** para almacenar embeddings.
- Persistencia de **campañas** en Postgres con **SQLAlchemy + Alembic**.
- Incluye una UI admin mínima en `/admin` y una página pública simple.

Por defecto usa **CUDA** si está disponible (configurable con `EMBEDDINGS_DEVICE=cpu`). El código es **multiplataforma** (Windows y Linux).

### Requisitos

- Python 3.10+ (recomendado 3.11)
- Variable de entorno **`OPENAI_API_KEY`** para el modelo de chat (respuesta final)
- Para GPU: PyTorch con soporte CUDA y drivers NVIDIA

**Opcional:** para evitar el aviso de “unauthenticated requests” y tener mejores límites de descarga al usar modelos de Hugging Face (p. ej. bge-m3), define **`HF_TOKEN`** en tu `.env` con un [token de acceso](https://huggingface.co/settings/tokens) de Hugging Face.

### Instalación

```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

pip install -U pip
# Con GPU NVIDIA (recomendado si tienes CUDA):
pip install torch
# Solo CPU (instalación más ligera):
# pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
```

### Añadir PDFs

Coloca tus PDFs en `backend/data/` (o en subcarpetas dentro; se buscan en profundidad). Ejemplo: `backend/data/manual.pdf`, `backend/data/libros/campana.pdf`.

### Ingesta (crear embeddings y persistirlos)

### Almacenamiento de embeddings (Postgres/pgvector)

El proyecto usa **Postgres** con **pgvector** para persistir embeddings (y más adelante campañas).

1. Asegúrate de tener un Postgres accesible y que la extensión `vector` esté instalada en la BD:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

2. En `.env` configura:

```env
POSTGRES_URL=postgresql+psycopg://usuario:password@localhost:5432/mi_bd
OPENAI_EMBEDDINGS_MODEL=text-embedding-3-large
LOCAL_OWNER_UUID=bec82f4c-14ae-43aa-8c40-f45d950517f1
```

- `RAG_COLLECTION` sigue siendo el nombre lógico de la colección (se usa como `collection_name`).
- Si cambias el modelo de embeddings, debes **reindexar** (borra la colección/índice y reingesta los PDFs). En este proyecto puedes usar `--force` al ingestar.

### Migraciones (campañas)

La tabla `campaigns` se gestiona con **Alembic**.

```bash
# Crear/actualizar tablas
alembic upgrade head
```

### Columna `visual_assets` (mapas / emblemas / retratos de mundos)

Tras actualizar el código, aplica en Postgres el script SQL (o equivalente), o `alembic upgrade head` si incluye la migración de `visual_assets`.

Al **generar un mundo**, la API guarda una **plantilla** con todos los huecos (mapa mundial, mapas locales, emblemas, retratos). Las imágenes **no** se generan solas: en la pestaña **Imágenes** del mundo el usuario pulsa **Generar** en cada una cuando quiera (endpoint `POST /api/worlds/{id}/visual:generate`).

Variables opcionales en `.env`:

- `OPENAI_IMAGE_MODEL` (por defecto `dall-e-3`): modelo de imágenes de OpenAI.
- `WORLD_IMAGE_GENERATION=false`: impide llamar a la API de imágenes (los botones fallarán con un error claro).

Los **prompts de generación de imágenes** (mapa mundial, ciudad/región, emblema, retrato PJ/NPC) están en `backend/prompt_templates/` como `image_*.txt`, sustituidos con el mismo mecanismo que el resto (`render_prompt_template`).

### Propietario (usuario local, sin autenticación todavía)

Aunque el MVP no incluye login, el backend **aísla campañas/sesiones por propietario** usando `LOCAL_OWNER_UUID`.

- Si mantienes un único usuario local, puedes dejar el valor por defecto.
- Si lo cambias, recuerda que tus campañas existentes en BD seguirán con el `owner_id` anterior (deberías migrarlas o mantener el UUID).

Si cambias modelos, generas una migración nueva con:

```bash
alembic revision --autogenerate -m "tu_cambio"
```

**Por defecto** (recomendado): indexa **todos** los PDFs encontrados en `backend/data` de forma recursiva:

```bash
python -m backend.scripts.ingest_pdf
```

**Un solo PDF:**

```bash
python -m backend.scripts.ingest_pdf --pdf backend/data/manual.pdf
```

**Varios PDFs desde otra carpeta** (script alternativo):

```bash
python -m backend.scripts.ingest_pdfs --pdf backend/data/manual.pdf --pdf backend/data/campana.pdf
python -m backend.scripts.ingest_pdfs --dir backend/data
```

- Los nuevos PDFs **se añaden** al índice sin borrar los que ya estaban.
- Si vuelves a ingestar el **mismo** PDF (misma ruta), no se duplican chunks: se reutiliza el índice salvo que cambie el archivo o uses `--force`.
- `--force`: recrea el índice de ese PDF; usado en un solo archivo borra toda la colección y deja solo ese. Con varios PDFs, la colección queda formada solo por los que pases en esa ejecución.

### Ejecutar la API

```bash
.venv\Scripts\uvicorn backend.app.main:app --reload
```

Arranca **siempre desde la raíz del repo** (`dndhelper`) para que importe `backend.app.main`. Si un endpoint nuevo devuelve `404 Not Found`, reinicia uvicorn tras guardar cambios.

En **PowerShell**, `curl` suele ser un alias de `Invoke-WebRequest`. Para probar la API como HTTP real usa:

```powershell
curl.exe -s "http://127.0.0.1:8000/api/all-sessions?limit=20&offset=0"
```

### Tests automáticos

Los tests usan un Postgres **aislado** (no el de dev). Define `POSTGRES_TEST_URL` y ejecuta:

- Windows (PowerShell):

```powershell
$env:POSTGRES_TEST_URL="postgresql+psycopg://user:pass@host:5432/db_test"
./scripts/test.ps1 -Quiet
```

- Linux/macOS:

```bash
export POSTGRES_TEST_URL="postgresql+psycopg://user:pass@host:5432/db_test"
./scripts/test.sh
```

### Interfaz web (Fase 2)

La página está en **`frontend/index.html`**; la API la sirve en la ruta raíz. Con la API en marcha, abre **http://127.0.0.1:8000/** en el navegador: escribe tu pregunta sobre reglas o lore y pulsa «Preguntar».

UI admin mínima: abre **http://127.0.0.1:8000/admin**.

### Frontend avanzado (React, en progreso)

Además del `frontend/` simple, existe un frontend React pensado para ir ampliándolo con la revisión/edición de campañas y mundos generados.

Arranque (desarrollo):

1. Inicia el backend:

```bash
.venv\\Scripts\\uvicorn backend.app.main:app --reload
```

2. En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

El frontend usa un **proxy** de Vite para `/api` apuntando a `http://127.0.0.1:8000`.

### Campañas (Fase 3)

Endpoints:
- `POST /api/campaigns`
- `GET /api/campaigns`
- `GET /api/campaigns/{id}`
- `PATCH /api/campaigns/{id}`
- `DELETE /api/campaigns/{id}`

### Generación de contenido (Fase 4, borradores editables)

Flujo recomendado (con aprobación entre fases):

1. **Brief** (preferencias del usuario)
   - `POST /api/campaigns/{campaign_id}/brief`
   - `POST /api/campaigns/{campaign_id}/brief/approve`

2. **Mundo**
   - `POST /api/campaigns/{campaign_id}/world:generate` (crea un `world` en *draft* y lo vincula a la campaña)
   - `PATCH /api/worlds/{world_id}` (editar borrador)
   - `POST /api/worlds/{world_id}/approve`

3. **Guión general (outline)**
   - `POST /api/campaigns/{campaign_id}/outline:generate`
   - `PATCH /api/campaigns/{campaign_id}/outline` (editar borrador)
   - `POST /api/campaigns/{campaign_id}/outline/approve`

4. **Sesiones**
   - `POST /api/campaigns/{campaign_id}/sessions:generate?session_count=3`
   - `PATCH /api/sessions/{session_id}` (editar resumen y guion `content_draft` a mano; bloqueado si ya está aprobada)
   - `POST /api/sessions/{session_id}/approve`
   - `POST /api/sessions/{session_id}/reopen` (vuelve a borrador una sesión aprobada)

Notas:
- El backend usa `LOCAL_OWNER_UUID` (MVP sin login) para aislar datos por propietario.
- Para usar generación real necesitas `OPENAI_API_KEY` (se usa `OPENAI_MODEL`).

### Sesiones (Fase 3 ampliada)

Endpoints:
- `POST /api/campaigns/{campaign_id}/sessions:generate?session_count=3`
- `GET /api/campaigns/{campaign_id}/sessions`
- `GET /api/sessions` o `GET /api/all-sessions` (todas las sesiones del propietario; `limit` / `offset`). No uses `/api/sessions/list`: se confunde con `/api/sessions/{session_id}`.
- `GET /api/sessions/{session_id}`
- `PATCH /api/sessions/{session_id}`
- `POST /api/sessions/{session_id}/approve`
- `POST /api/sessions/{session_id}/reopen`
- `DELETE /api/sessions/{session_id}`

### Probar una consulta (API)

```bash
curl -s -X POST http://127.0.0.1:8000/api/query_rules \
  -H 'Content-Type: application/json' \
  -d '{"question":"¿Qué es una tirada de salvación?"}'
```

### Comprobar que los embeddings usan CUDA

1. **Verificar que PyTorch ve la GPU**
   ```bash
   python -c "import torch; print('CUDA disponible:', torch.cuda.is_available()); print('Dispositivo:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'N/A')"
   ```

2. **Ejecutar la ingesta** (aquí se calculan todos los embeddings; con GPU será mucho más rápido)
   ```bash
   python -m backend.scripts.ingest_pdf --pdf backend/data/pdfs/manual.pdf
   ```
   En otra terminal puedes ejecutar `nvidia-smi` durante la ingesta: deberías ver uso de GPU y memoria.

3. **Forzar CPU** (por si quieres comparar o no tienes GPU)
   - PowerShell: `$env:EMBEDDINGS_DEVICE="cpu"; python -m backend.scripts.ingest_pdf --pdf backend/data/pdfs/manual.pdf`
   - Linux/macOS: `EMBEDDINGS_DEVICE=cpu python -m backend.scripts.ingest_pdf --pdf backend/data/pdfs/manual.pdf`

