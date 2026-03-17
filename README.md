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
```

- `RAG_COLLECTION` sigue siendo el nombre lógico de la colección (se usa como `collection_name`).
- Si cambias el modelo de embeddings, debes **reindexar** (borra la colección/índice y reingesta los PDFs). En este proyecto puedes usar `--force` al ingestar.

### Migraciones (campañas)

La tabla `campaigns` se gestiona con **Alembic**.

```bash
# Crear/actualizar tablas
alembic upgrade head
```

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

### Campañas (Fase 3)

Endpoints:
- `POST /api/campaigns`
- `GET /api/campaigns`
- `GET /api/campaigns/{id}`
- `PATCH /api/campaigns/{id}`
- `DELETE /api/campaigns/{id}`

### Arcos y sesiones (Fase 3 ampliada)

Endpoints (Arcs):
- `POST /api/campaigns/{campaign_id}/arcs`
- `GET /api/campaigns/{campaign_id}/arcs`
- `GET /api/arcs/{arc_id}`
- `PATCH /api/arcs/{arc_id}`
- `DELETE /api/arcs/{arc_id}`

Endpoints (Sessions):
- `POST /api/arcs/{arc_id}/sessions`
- `GET /api/arcs/{arc_id}/sessions`
- `GET /api/campaigns/{campaign_id}/sessions`
- `GET /api/sessions/{session_id}`
- `PATCH /api/sessions/{session_id}`
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

