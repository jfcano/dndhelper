# DnD Helper

Asistente para **Dungeons & Dragons** (orientado a 5e) que combina **consultas tipo RAG** sobre PDFs de reglas o lore con **herramientas de campaña**: creación y edición de campañas, mundos generados con IA, guiones por sesión y activos visuales opcionales (mapas, emblemas, retratos).

El proyecto está pensado como **MVP multiplataforma** (Windows y Linux): backend en Python, datos en **PostgreSQL** con **pgvector**, y una interfaz **React** para el flujo principal de campañas y mundos.

---

## Tabla de contenidos

1. [Descripción general](#descripción-general)
2. [Stack tecnológico](#stack-tecnológico)
3. [Requisitos previos](#requisitos-previos)
4. [Instalación](#instalación)
5. [Configuración (`.env`)](#configuración-env)
6. [Base de datos y migraciones](#base-de-datos-y-migraciones)
7. [Ingesta de PDFs (RAG)](#ingesta-de-pdfs-rag)
8. [Ejecución](#ejecución)
9. [Docker Compose](#docker-compose)
10. [Estructura del proyecto](#estructura-del-proyecto)
11. [Funcionalidades principales](#funcionalidades-principales)
12. [Tests](#tests)
13. [API y referencia rápida](#api-y-referencia-rápida)

---

## Descripción general

**DnD Helper** permite:

- **Preguntar en lenguaje natural** sobre el contenido de los PDFs indexados (reglas, trasfondos, etc.), recuperando fragmentos relevantes y generando una respuesta con un modelo de lenguaje.
- **Gestionar campañas** con un flujo por fases: brief del director, historia/guion de campaña, outline, y **sesiones** numeradas con borradores que pueden aprobarse o reabrirse.
- **Definir mundos** vinculados a campañas: texto en borrador o final, y **plantilla de imágenes** (mapa mundial, mapas locales, emblemas, retratos) generables **bajo demanda** mediante la API de imágenes de OpenAI cuando está habilitado.

El aislamiento de datos en el MVP se hace con un **UUID de propietario local** (`LOCAL_OWNER_UUID`), sin sistema de login todavía.

---

## Stack tecnológico

| Capa | Tecnologías |
|------|-------------|
| **API** | [FastAPI](https://fastapi.tiangolo.com/), [Uvicorn](https://www.uvicorn.org/) |
| **IA / RAG** | [LangChain](https://www.langchain.com/) (OpenAI: chat + embeddings), recuperación con [langchain-postgres](https://github.com/langchain-ai/langchain-postgres) / **PGVector** |
| **Datos relacionales y vectoriales** | [PostgreSQL](https://www.postgresql.org/) + [pgvector](https://github.com/pgvector/pgvector), [SQLAlchemy](https://www.sqlalchemy.org/), [Alembic](https://alembic.sqlalchemy.org/) |
| **PDFs** | [pypdf](https://pypdf.readthedocs.io/) vía LangChain |
| **Frontend (app principal)** | [React](https://react.dev/) 19, [React Router](https://reactrouter.com/) 7, [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/) 8 |
| **UI admin mínima** | HTML/JS estático servido bajo `/admin` (`backend/admin_ui/`) |
| **Tests** | [pytest](https://pytest.org/), [HTTPX](https://www.python-httpx.org/) |

Dependencias Python declaradas en `requirements.txt` (incluye paquetes LangChain y utilidades como `sentence-transformers` según el árbol de dependencias del proyecto).

---

## Requisitos previos

- **Python 3.10+** (recomendado 3.11).
- **Node.js** (LTS recomendado) y **npm**, para el frontend React en `frontend/`.
- **PostgreSQL** con la extensión **`vector`** (pgvector).
- Cuenta **OpenAI** y variable **`OPENAI_API_KEY`** para chat, embeddings e (opcionalmente) generación de imágenes.

---

## Instalación

### 1. Clonar y entorno virtual (Python)

Desde la **raíz del repositorio** (`dndhelper`):

```bash
python -m venv .venv
```

Activación:

- **Windows (PowerShell):** `.venv\Scripts\activate`
- **Linux / macOS:** `source .venv/bin/activate`

```bash
pip install -U pip
pip install -r requirements.txt
```

### 2. Frontend (React)

```bash
cd frontend
npm install
```

### 3. Proxy de Vite (desarrollo)

El cliente usa rutas relativas (`/api/...`). El archivo **`frontend/vite.config.ts`** reenvía `/api` a **`http://127.0.0.1:8000`** mientras corres `npm run dev`. Si el backend escucha en otro host o puerto, ajusta `server.proxy` ahí.

---

## Configuración (`.env`)

Copia `.env.example` a `.env` y completa al menos:

| Variable | Descripción |
|----------|-------------|
| `POSTGRES_URL` | Cadena SQLAlchemy, p. ej. `postgresql+psycopg://usuario:password@localhost:5432/nombre_bd` |
| `OPENAI_API_KEY` | Respaldo global (chat, embeddings, imágenes). Si en **Ajustes** guardas una clave para tu `LOCAL_OWNER_UUID`, esa tiene **prioridad** en la API. Sin ninguna de las dos, las rutas de IA responden 400 pidiendo configurar la clave. |
| `LOCAL_OWNER_UUID` | UUID del “propietario” local (MVP sin login); también determina la fila en `owner_settings` donde se guarda la clave desde la UI. |

Opcionales frecuentes:

| Variable | Descripción |
|----------|-------------|
| `OPENAI_MODEL` | Modelo de chat (por defecto `gpt-4o-mini`) |
| `OPENAI_EMBEDDINGS_MODEL` | Modelo de embeddings (por defecto `text-embedding-3-large`) |
| `RAG_COLLECTION` | Nombre lógico de la colección vectorial (por defecto `rules_5e`) |
| `RAG_CHUNK_SIZE` / `RAG_CHUNK_OVERLAP` | Particionado de texto al indexar |
| `OPENAI_IMAGE_MODEL` | Imágenes (por defecto `dall-e-3`) |
| `WORLD_IMAGE_GENERATION` | `true`/`false`: habilita o deshabilita llamadas a la API de imágenes para mundos |
| `POSTGRES_TEST_URL` | Base de datos **aparte** para tests automatizados |
| `HF_TOKEN` | Opcional: token de Hugging Face si usas flujos que descargan modelos con avisos de rate limit |

---

## Base de datos y migraciones

1. En PostgreSQL:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

2. Aplicar esquema relacional (campañas, mundos, sesiones, etc.):

```bash
alembic upgrade head
```

Ejecutar **desde la raíz del repo**, con el venv activado y `POSTGRES_URL` definida.

---

## Ingesta de PDFs (RAG)

1. Coloca los **PDF** en `backend/data/` (también en subcarpetas; la búsqueda es recursiva).
2. Con el entorno configurado (`POSTGRES_URL`, `OPENAI_API_KEY`), ejecuta desde la raíz:

**Todos los PDFs bajo `backend/data/`:**

```bash
python -m backend.scripts.ingest_pdf
```

**Un solo archivo:**

```bash
python -m backend.scripts.ingest_pdf --pdf backend/data/manual.pdf
```

**Script alternativo** (`ingest_pdfs`) para varias rutas o otro directorio:

```bash
python -m backend.scripts.ingest_pdfs --dir backend/data
```

- Los PDFs nuevos **se añaden** al índice sin borrar los existentes.
- Reingestar el **mismo** PDF (misma ruta) no duplica chunks salvo que el archivo cambie o uses `--force`.
- **`--force`**: reindexa agresivamente; en escenarios con un solo PDF puede recrear la colección de ese documento. Si cambias el modelo de embeddings, conviene reindexar con coherencia (p. ej. `--force` o limpieza acorde).

---

## Ejecución

### Backend (API)

**Siempre desde la raíz del repositorio:**

```bash
# Windows
.venv\Scripts\uvicorn backend.app.main:app --reload

# Linux / macOS
uvicorn backend.app.main:app --reload
```

Por defecto la API queda en **http://127.0.0.1:8000**.

Para que la **subida de manuales** (RAG) avance desde la UI, arranca además el worker de cola (otra terminal, misma raíz del repo y mismo `.env`):

```bash
python -m backend.scripts.ingest_worker
```

Al **arrancar**, el worker pasa de nuevo a «En cola» los trabajos que quedaron en «Procesando» (reinicio o corte), para reintentar la indexación.

- **Salud:** `GET http://127.0.0.1:8000/health`
- **Documentación interactiva:** `http://127.0.0.1:8000/docs` (OpenAPI/Swagger de FastAPI)
- **Página servida en `/`:** `frontend/index.html` (entrada HTML de la app React; en producción conviene servir el **build** de Vite o seguir usando el dev server con proxy)
- **Admin mínimo:** `http://127.0.0.1:8000/admin`

### Frontend React (desarrollo)

En **otra terminal**, con el backend en marcha:

```bash
cd frontend
npm run dev
```

Abre la URL que indique Vite (habitualmente **http://127.0.0.1:5173**). El proxy de **`frontend/vite.config.ts`** enruta `/api` al backend en el puerto 8000.

### Probar RAG por HTTP

En PowerShell, para evitar el alias de `curl`:

```powershell
curl.exe -s -X POST http://127.0.0.1:8000/api/query_rules `
  -H "Content-Type: application/json" `
  -d "{\"question\":\"¿Qué es una tirada de salvación?\"}"
```

---

## Docker Compose

Despliegue con **cuatro servicios**: Postgres (**pgvector**), API FastAPI, **worker de ingesta RAG** (`ingest-worker`, mismo código que el backend) y frontend estático (**Nginx**) que enruta `/api` y `/admin` al backend (mismo comportamiento que el proxy de Vite en desarrollo).

**Requisitos:** [Docker](https://docs.docker.com/get-docker/) y Docker Compose v2.

1. Copia `.env.example` a `.env` y completa al menos **`OPENAI_API_KEY`** (y el resto de variables que uses). El fichero **`.env`** debe existir para que Compose pueda cargarlo en los servicios `backend` e `ingest-worker`.
2. **`POSTGRES_URL` dentro del contenedor** la fija `docker-compose.yml` apuntando al servicio `db` (`dndhelper` / `dndhelper` / base `dndhelper`). La variable de tu `.env` para Postgres **se sustituye** en Compose al arrancar el backend y el worker.
3. Construcción y arranque:

```bash
docker compose up -d --build
```

4. Aplicar migraciones (una vez la base está arriba):

```bash
docker compose run --rm backend alembic upgrade head
```

5. **URLs habituales**
   - App React (vía Nginx): **http://localhost:80** (si el puerto 80 está ocupado o requiere permisos elevados en tu sistema, cambia en `docker-compose.yml` el mapeo del servicio `frontend`, p. ej. `8080:80`).
   - API directa (opcional): **http://localhost:8000** (`/docs`, `/health`).
   - Postgres en el host: **localhost:5432** (usuario/contraseña/base `dndhelper`).

Los PDFs para RAG pueden dejarse en **`backend/data/`** en el host: el compose monta esa carpeta en el contenedor del backend **y** del worker (subidas desde la UI y manifiestos de ingesta). Las **imágenes de mundos** (y el resto de ficheros bajo `backend/storage/`, p. ej. `world_images/`) también se persisten mediante el volumen **`./backend/storage` → `/app/backend/storage`**.

La subida desde **Manuales** encola un trabajo en BD; el proceso **`ingest-worker`** (`python -m backend.scripts.ingest_worker`) lo toma y actualiza el porcentaje de progreso. Sin ese servicio (o sin ejecutar el worker en local), los trabajos quedarán en «En cola». Cada vez que el worker **arranca**, recupera trabajos que hubieran quedado en «Procesando» y los vuelve a encolar.

La imagen del backend es **grande** (PyTorch / `sentence-transformers`). En Compose se fuerza **`EMBEDDINGS_DEVICE=cpu`**; para GPU haría falta configurar el runtime de NVIDIA y una imagen base distinta.

---

## Estructura del proyecto

```text
dndhelper/
├── .env.example              # Plantilla de variables de entorno
├── docker-compose.yml        # Postgres + backend + ingest-worker + frontend (Nginx)
├── alembic.ini               # Configuración de Alembic
├── alembic/                  # Migraciones SQL (versiones en versions/)
├── requirements.txt          # Dependencias Python
├── scripts/
│   ├── test.ps1              # Tests (Windows)
│   └── test.sh               # Tests (Unix)
├── backend/
│   ├── Dockerfile            # Imagen de la API (contexto de build: raíz del repo)
│   ├── app/
│   │   ├── main.py           # FastAPI: rutas, montaje de routers, /, /admin, /health
│   │   ├── config.py         # Settings desde entorno
│   │   ├── db.py             # Sesión SQLAlchemy
│   │   ├── models.py         # ORM: worlds, campaigns, sessions, …
│   │   ├── schemas.py        # Esquemas Pydantic
│   │   ├── crud.py           # Operaciones de persistencia
│   │   ├── embeddings.py     # Embeddings (OpenAI)
│   │   ├── vector_store.py   # PGVector / LangChain
│   │   ├── ingest.py         # Lógica de ingesta de PDFs
│   │   ├── rag.py            # Utilidades RAG (si aplica)
│   │   ├── api/              # Routers: rag, campaigns, sessions, worlds
│   │   ├── services/         # RAG, generación de campaña/mundo, imágenes
│   │   └── prompts/          # Carga y composición de prompts
│   ├── admin_ui/             # UI estática bajo /admin
│   ├── data/                 # PDFs para indexar (no versionar contenido propietario)
│   ├── prompt_templates/     # Plantillas de texto (RAG, campaña, sesiones, imágenes, …)
│   ├── scripts/              # ingest_pdf, ingest_pdfs, ingest_worker (cola RAG)
│   └── storage/              # Metadatos locales de ingesta (p. ej. manifiestos)
└── frontend/
    ├── Dockerfile            # Build Vite + Nginx (proxy /api y /admin → backend)
    ├── nginx.docker.conf     # Configuración Nginx del contenedor frontend
    ├── index.html            # Shell de la SPA
    ├── vite.config.ts        # Dev: proxy /api → http://127.0.0.1:8000
    ├── package.json
    └── src/
        ├── main.tsx          # Router y entrada React
        ├── lib/api.ts        # Cliente HTTP hacia /api
        ├── pages/            # Campañas, detalle, mundos, …
        └── components/       # Layout, wizard, diálogos, …
```

---

## Funcionalidades principales

### Consultas RAG sobre PDFs

- Endpoint **`POST /api/query_rules`**: pregunta en JSON (`question`), respuesta con **`answer`** y lista **`sources`** (origen y página de los fragmentos usados).
- Requiere PDFs ingestados y colección vectorial en Postgres.

### Campañas

- CRUD vía API (`POST/GET/PATCH/DELETE` bajo `/api/campaigns`).
- **Brief** (borrador y aprobación; la aprobación del brief consolida también la **historia** en `story_final`), **outline** (borrador y aprobación).
- Asociación opcional a un **mundo** (`world_id`).

### Mundos

- Generación y edición de mundos (texto en borrador / final, tono, temas en JSON).
- **Activos visuales** (`visual_assets`): plantilla con huecos; la generación de cada imagen es **explícita** (endpoint de generación bajo `/api/worlds/...`), no automática al crear el mundo.
- Servicio de ficheros de imagen expuesto por la API para visualización en el cliente.

### Sesiones

- Generación por campaña (`sessions:generate` con número de sesiones).
- Listado por campaña o listado global del propietario (`all-sessions` con paginación).
- Edición de borradores, **aprobación**, **reapertura** a borrador y borrado.

### Interfaz de usuario

- **React**: flujo principal en `/campaigns`, `/worlds`, `/rules` (consultas RAG), `/manuals` (subida de PDFs al índice), **Ajustes** en `/settings` (clave OpenAI), etc. (ver `frontend/src/main.tsx`).
- **Admin** en `/admin`: interfaz mínima servida por FastAPI.

### Aislamiento por propietario

- Todas las entidades relevantes llevan `owner_id` alineado con **`LOCAL_OWNER_UUID`** hasta que exista autenticación real.

---

## Tests

Los tests usan una base **dedicada**; define `POSTGRES_TEST_URL` y ejecuta:

**Windows (PowerShell):**

```powershell
$env:POSTGRES_TEST_URL="postgresql+psycopg://user:pass@host:5432/db_test"
./scripts/test.ps1 -Quiet
```

**Linux / macOS:**

```bash
export POSTGRES_TEST_URL="postgresql+psycopg://user:pass@host:5432/db_test"
./scripts/test.sh
```

---

## API y referencia rápida

### Ajustes (clave OpenAI por propietario)

- `GET /api/settings` — estado (`has_stored_openai_key`, `env_openai_key_configured`; no se devuelve el secreto).
- `PUT /api/settings/openai` — cuerpo `{"openai_api_key": "sk-..."}`; persiste para `LOCAL_OWNER_UUID`.
- `DELETE /api/settings/openai` — borra la clave guardada en BD (sigue pudiendo usarse `OPENAI_API_KEY` del entorno si existe).

### RAG

- `POST /api/query_rules` — Pregunta sobre PDFs indexados.
- `POST /api/upload_pdf` — Subida multipart (`file`) de un PDF; lo guarda en `backend/data/uploads/<LOCAL_OWNER_UUID>/` con nombre único por trabajo, crea una fila en `ingest_jobs` y responde **202** con `job_id` (la indexación la hace el worker; requiere clave OpenAI en el momento de la subida).
- `GET /api/ingest_jobs?limit=50` — Lista de trabajos del propietario: `status` (`queued` | `processing` | `done` | `failed`), `progress_percent`, `phase_label`, y al terminar `outcome` (`indexed` | `unchanged` | `empty`), `message`, metadatos.

### Campañas (extracto)

- `POST /api/campaigns`, `GET /api/campaigns`, `GET /api/campaigns/{id}`, `PATCH`, `DELETE`
- Brief: `POST` o `PATCH .../brief`, `POST .../brief/approve` — al aprobar el brief se fija también la **historia** (`story_final` a partir de `story_draft`, generándola si hace falta)
- Historia en borrador: `PATCH .../story`, `POST .../story/reset`; reabrir campaña: `POST .../reopen`
- Outline: `POST .../outline:generate`, `PATCH .../outline`, `POST .../outline/approve`
- Wizard asistido: `POST /api/campaigns:wizard/autogenerate`

### Mundos

- Generación: `POST /api/campaigns/{campaign_id}/world:generate`
- `GET/PATCH /api/worlds/{id}`, `POST .../approve`
- Imágenes: generación bajo demanda y lectura de ficheros (rutas en el router `worlds`)

### Sesiones

- `POST /api/campaigns/{campaign_id}/sessions:generate?session_count=N`
- `GET /api/campaigns/{campaign_id}/sessions`
- `GET /api/all-sessions` o `GET /api/sessions` (listados con `limit` / `offset`)
- `GET /api/sessions/{session_id}`, `PATCH`, `POST .../approve`, `POST .../reopen`, `DELETE`

> **Nota:** Evita rutas ambiguas; por ejemplo no uses un path tipo `/api/sessions/list` que pueda confundirse con `/api/sessions/{session_id}`.

Los **prompts** de plantilla viven en `backend/prompt_templates/` y se renderizan con el mismo mecanismo que el resto de la aplicación (`render_prompt_template`).

---

## Licencia y uso

Usa el repositorio según la licencia del proyecto (si no hay archivo `LICENSE`, acláralo con los mantenedores). El contenido de los PDFs de D&D puede estar sujeto a derechos de autor de sus editores; la ingesta es responsabilidad de quien despliega la herramienta.
