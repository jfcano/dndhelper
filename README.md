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
12. [Tests](#tests) — [E2E Playwright (frontend)](#tests-e2e-playwright-frontend)
13. [API y referencia rápida](#api-y-referencia-rápida)

---

## Descripción general

**DnD Helper** permite:

- **Preguntar en lenguaje natural** sobre el contenido de los PDFs indexados (reglas, trasfondos, etc.), recuperando fragmentos relevantes y generando una respuesta con un modelo de lenguaje.
- **Gestionar campañas** con un flujo por fases: brief del director, historia/guion de campaña, outline, y **sesiones** numeradas con borradores que pueden aprobarse o reabrirse.
- **Definir mundos** vinculados a campañas: texto en borrador o final, y **plantilla de imágenes** (mapa mundial, mapas locales, emblemas, retratos) generables **bajo demanda** mediante la API de imágenes de OpenAI cuando está habilitado.

Los datos se aislan **por usuario registrado**: cada cuenta tiene su propio `owner_id` (UUID) y solo ve mundos, campañas, ajustes OpenAI, trabajos RAG y la **colección de embeddings** que le corresponden. La API exige **JWT** (`Authorization: Bearer …`) salvo en registro e inicio de sesión.

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
| **Tests** | [pytest](https://pytest.org/), [HTTPX](https://www.python-httpx.org/), [Playwright](https://playwright.dev/) (E2E frontend) |

Dependencias Python declaradas en `requirements.txt` (incluye paquetes LangChain y utilidades como `sentence-transformers` según el árbol de dependencias del proyecto).

---

## Requisitos previos

- **Python 3.10+** (recomendado 3.11).
- **Node.js** (LTS recomendado) y **npm**, para el frontend React en `frontend/`.
- **PostgreSQL** con la extensión **`vector`** (pgvector).
- Cuenta **OpenAI** (la clave de API se configura en **Ajustes** de la aplicación, no en `.env`) para chat, embeddings e (opcionalmente) generación de imágenes.

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
| `JWT_SECRET` | Secreto para firmar tokens de acceso; **obligatorio cambiarlo en producción**. |
| `JWT_EXPIRE_MINUTES` | Validez del token (por defecto 10080 ≈ 7 días). |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Opcionales: si ambas están definidas, al **arrancar la API** se crea (o se actualiza) un usuario **administrador** con acceso a los recursos de todos los usuarios. |
| `RAG_COLLECTION` | Nombre de colección por defecto para los **scripts** `ingest_pdf` / `ingest_pdfs` **sin** `--owner-id`. Con `--owner-id`, la web y el CLI comparten la colección de **manuales** (`rag_u_<hex>_manuals`). La colección de **referencias de campaña** es `rag_u_<hex>_campaign` (material generado y consultas amplias). |

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
| `INGEST_WORKER_AUTOSTART` | `true`/`false` (por defecto `true`): si es `true`, uvicorn lanza proceso(s) de ingesta RAG. Pon `false` si ejecutas el worker a mano o en otro contenedor (p. ej. Compose). |
| `INGEST_WORKER_COUNT` | Entero `0`–`32` (por defecto `1`): número de subprocesos `ingest_worker` que arranca uvicorn. `0` no lanza ninguno (útil con `INGEST_WORKER_AUTOSTART=true` si solo quieres desactivar workers sin tocar el flag). Varias instancias comparten la misma cola en BD (`SKIP LOCKED`). |

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
2. Con `POSTGRES_URL` configurada y una **clave OpenAI** guardada en **Ajustes** (para embeddings), ejecuta desde la raíz:

**Todos los PDFs bajo `backend/data/`:**

```bash
python -m backend.scripts.ingest_pdf
```

**Un solo archivo:**

```bash
python -m backend.scripts.ingest_pdf --pdf backend/data/manual.pdf
```

**Misma colección de manuales que la aplicación web** (recomendado para **Consultas → Reglas**): usa el UUID de tu usuario (véase **Ajustes** / `GET /api/auth/me`) con `--owner-id`:

```bash
python -m backend.scripts.ingest_pdf --pdf backend/data/manual.pdf --owner-id xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Sin `--owner-id`, el script usa `RAG_COLLECTION` (p. ej. `rules_5e`), **distinta** de la colección de manuales por usuario (`rag_u_<hex>_manuals`), y las consultas desde la UI en modo **Reglas** no verán esos documentos.

**Script alternativo** (`ingest_pdfs`) para varias rutas o otro directorio:

```bash
python -m backend.scripts.ingest_pdfs --dir backend/data
```

- Los PDFs nuevos **se añaden** al índice sin borrar los existentes.
- El manifiesto local (`backend/storage/ingest_manifest.json`) evita re-embeddings innecesarios, pero si vacías Postgres o recreas las tablas vectoriales, la ingesta **vuelve a ejecutarse** al detectar que ya no hay fragmentos en la colección.
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

La **indexación RAG** (cola de manuales subidos desde la UI) la procesa uno o más **workers** que, por defecto (**`INGEST_WORKER_AUTOSTART=true`**, **`INGEST_WORKER_COUNT=1`**), **uvicorn arranca** al levantar la API. Puedes subir el paralelismo con `INGEST_WORKER_COUNT` (p. ej. `3`). No necesitas una segunda terminal salvo que desactives el autostart (`INGEST_WORKER_AUTOSTART=false`) y entonces ejecutes a mano:

```bash
python -m backend.scripts.ingest_worker
```

En **Docker Compose**, el servicio `ingest-worker` ya corre el worker; el contenedor del API lleva `INGEST_WORKER_AUTOSTART=false` para no duplicar procesos.

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

1. Copia `.env.example` a `.env` y completa al menos **`JWT_SECRET`** (y el resto de variables que uses; opcionalmente `ADMIN_USERNAME` / `ADMIN_PASSWORD`). Si no defines credenciales de administrador en el entorno, configura **`SETUP_MASTER_PASSWORD`** (obligatorio para arrancar sin admin en BD) y completa la **instalación inicial** en la ruta `/setup` de la aplicación. El fichero **`.env`** debe existir para que Compose pueda cargarlo en los servicios `backend` e `ingest-worker`. Las claves de **OpenAI** y **Hugging Face** se configuran en la aplicación (**Ajustes**), no en el entorno.
2. **`POSTGRES_URL` dentro del contenedor** la fija `docker-compose.yml` apuntando al servicio `db` (`dndhelper` / `dndhelper` / base `dndhelper`). La variable de tu `.env` para Postgres **se sustituye** en Compose al arrancar el backend y el worker.
3. Construcción y arranque:

```bash
docker compose up -d --build
```

4. **Migraciones:** el contenedor del API ejecuta `alembic upgrade head` al arrancar (tras esperar a Postgres). Solo necesitas el paso manual `docker compose run --rm backend alembic upgrade head` si quieres aplicar migraciones sin levantar el servicio.

5. **URLs habituales**
   - App React (vía Nginx): **http://localhost:80** (si el puerto 80 está ocupado o requiere permisos elevados en tu sistema, cambia en `docker-compose.yml` el mapeo del servicio `frontend`, p. ej. `8080:80`).
   - API directa (opcional): **http://localhost:8000** (`/docs`, `/health`).
   - Postgres en el host: **localhost:5432** (usuario/contraseña/base `dndhelper`).

Los PDFs para RAG pueden dejarse en **`backend/data/`** en el host: el compose monta esa carpeta en el contenedor del backend **y** del worker (subidas desde la UI y manifiestos de ingesta). Las **imágenes de mundos** (y el resto de ficheros bajo `backend/storage/`, p. ej. `world_images/`) también se persisten mediante el volumen **`./backend/storage` → `/app/backend/storage`**.

La subida desde **Documentos** encola un trabajo en BD; el proceso **`ingest-worker`** (`python -m backend.scripts.ingest_worker`) lo toma y actualiza el porcentaje de progreso. Sin ese servicio (o sin ejecutar el worker en local), los trabajos quedarán en «En cola». Cada vez que el worker **arranca**, recupera trabajos que hubieran quedado en «Procesando» y los vuelve a encolar.

La imagen del backend es **grande** (PyTorch / `sentence-transformers`). En Compose se fuerza **`EMBEDDINGS_DEVICE=cpu`**; para GPU haría falta configurar el runtime de NVIDIA y una imagen base distinta.

**Paridad con Kubernetes:** se usan las mismas imágenes y entrypoints (`docker-entrypoint.sh` con espera a Postgres + `alembic upgrade head` + uvicorn; `docker-entrypoint-worker.sh` con la misma espera, `alembic upgrade head` idempotente y el worker de ingesta). Variables alineadas: `POSTGRES_URL`, `EMBEDDINGS_DEVICE`, `INGEST_WORKER_AUTOSTART=false`, `SETUP_MASTER_PASSWORD` (API y worker), Nginx con `BACKEND_UPSTREAM` al host del API. El **frontend** y el **ingest-worker** esperan a que el **backend** esté sano (`healthcheck` sobre `GET /health`), equivalente a desplegar el API antes de asumir tráfico o trabajo de cola.

### Kubernetes

Manifiesto de ejemplo (Postgres con pgvector, API + worker en un solo `Deployment`, PVCs para datos, frontend Nginx): [`deploy/k8s/all-in-one.yaml`](deploy/k8s/all-in-one.yaml).

1. Construye las imágenes (`docker build -f backend/Dockerfile -t dndhelper-backend:latest .` y `docker build -f frontend/Dockerfile -t dndhelper-frontend:latest ./frontend`) y súbelas a tu registry si no usas imágenes locales.
2. Edita el `Secret` `dndhelper-secrets` (contraseñas y `POSTGRES_URL` coherentes con el usuario de Postgres).
3. Despliega: `kubectl apply -f deploy/k8s/all-in-one.yaml`

Scripts de comprobación de salud reutilizables: [`scripts/healthcheck-postgres.sh`](scripts/healthcheck-postgres.sh), [`scripts/healthcheck-backend.sh`](scripts/healthcheck-backend.sh), [`scripts/healthcheck-nginx.sh`](scripts/healthcheck-nginx.sh). El worker puede usar `python -m backend.scripts.health_ingest`.

---

## Estructura del proyecto

```text
dndhelper/
├── .env.example              # Plantilla de variables de entorno
├── docker-compose.yml        # Postgres + backend + ingest-worker + frontend (Nginx)
├── deploy/k8s/               # Manifiesto Kubernetes (ej. all-in-one.yaml)
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

### Consultas RAG

- Endpoint **`POST /api/query_rules`**: cuerpo JSON con **`question`**, **`scope`** (`rules` \| `campaigns_general` \| `campaign`) y, si `scope` es `campaign`, **`campaign_id`**. Respuesta **`answer`** y **`sources`** (fragmentos de recuperación semántica).
- Modo **Reglas**: índice de manuales. **Campañas en general** / **campaña concreta**: índice de referencias de campaña; en el modo campaña se añade además el texto completo de la campaña (brief, historia, outline, sesiones, mundo) como contexto.
- Para **Reglas** hacen falta documentos ingestados en la colección de manuales.

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

- **React**: flujo principal en `/campaigns`, `/worlds`, `/consultas` (consultas RAG; `/rules` redirige aquí), `/documentos` (subida de documentos al índice RAG; elige colección manuales o referencias de campaña; `/manuals` redirige aquí), **Ajustes** en `/settings` (claves OpenAI y Hugging Face), etc. (ver `frontend/src/main.tsx`).
- **Admin** en `/admin`: interfaz mínima servida por FastAPI.

### Usuarios y aislamiento

- Registro e inicio de sesión: la UI usa `/register` y `/login`; la API expone `POST /api/auth/register`, `POST /api/auth/login` y `GET /api/auth/me`.
- **Administrador:** si defines `ADMIN_USERNAME` y `ADMIN_PASSWORD` en `.env`, al arrancar la API se crea un usuario con `is_admin=true` que puede listar y operar sobre **cualquier** recurso (campañas, mundos, trabajos RAG, etc.). En rutas RAG, el admin puede indicar el propietario objetivo en el cuerpo o formulario (`target_owner_id`, `for_owner_id`).
- Las tablas de dominio usan `owner_id` = `users.id`. Los PDFs subidos van a `backend/data/uploads/<owner_id>/`.
- El índice RAG (pgvector) es **por usuario**: colección `rag_u_<uuid sin guiones>`; las consultas en **Reglas** solo buscan en la colección del usuario autenticado (salvo admin con `target_owner_id`).

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

**Todo junto (pytest + Playwright):** con la API en marcha para la parte E2E, desde la raíz del repo:

- **Windows (PowerShell):** `./scripts/test-all.ps1`
- **Linux / macOS:** `./scripts/test-all.sh`

Solo pytest: `./scripts/test-all.ps1 -SkipE2E` o `SKIP_E2E=1 ./scripts/test-all.sh`. Solo E2E: `-SkipBackend` / `SKIP_BACKEND=1`.

### Tests E2E (Playwright, frontend)

Pruebas en navegador bajo `frontend/e2e/`: rutas React, token en `localStorage`, proxy `/api` de Vite y flujos de UI que no cubre `TestClient`.

**Requisitos:** Node.js, backend FastAPI y PostgreSQL en marcha (p. ej. `uvicorn` en `127.0.0.1:8000`, igual que el proxy de `frontend/vite.config.ts`). Instala los navegadores de Playwright una vez:

```bash
cd frontend
npm install
npx playwright install chromium
```

**Ejecución recomendada (dos terminales):**

1. Terminal A: base de datos + API (misma `POSTGRES_URL` que uses en desarrollo).
2. Terminal B:

```bash
cd frontend
npm run test:e2e
```

Playwright arranca **solo** el servidor de Vite (`npm run dev`) si no hay uno escuchando ya en la URL base. La API **no** la levanta el runner.

**Variables útiles:**

| Variable | Descripción |
|----------|-------------|
| `PLAYWRIGHT_BASE_URL` | URL del frontend (por defecto `http://127.0.0.1:5173`). |
| `OPENAI_API_KEY` o `E2E_OPENAI_API_KEY` | Opcional pero necesaria para el spec largo de campaña: el test guarda la clave en **Ajustes** del usuario vía API y usa el brief con IA. Sin ella, ese caso se omite (`test.skip`). |
| `CI` | Si está definida, Playwright no reutiliza un `vite dev` ya arrancado y activa reintentos ligeros. |

**Scripts npm:** `npm run test:e2e` · `npm run test:e2e:ui`

**CI (opcional):** un job reproducible suele combinar Postgres (p. ej. imagen `pgvector/pgvector`), migraciones Alembic, `uvicorn`, `npm run build` + `vite preview` y `npm run test:e2e`, con `PLAYWRIGHT_BASE_URL` apuntando al preview y el proxy de `/api` coherente con el host del backend. Puedes usar `docker compose up` como base y ejecutar Playwright en el host o en un contenedor con Node.

---

## API y referencia rápida

### Autenticación

- `POST /api/auth/register` — cuerpo `{"username": "...", "password": "..."}`; crea usuario (contraseña con hash bcrypt) y devuelve `access_token` + datos públicos del usuario.
- `POST /api/auth/login` — mismo cuerpo; devuelve token si las credenciales son válidas.
- `GET /api/auth/me` — requiere `Authorization: Bearer <token>`; devuelve `id`, `username` e `is_admin`.

### Ajustes (claves por usuario)

- `GET /api/settings` — estado (`has_stored_openai_key`, `has_stored_hf_token`; no se devuelven secretos).
- `PUT /api/settings/openai` — cuerpo `{"openai_api_key": "sk-..."}`; persiste para el usuario autenticado.
- `DELETE /api/settings/openai` — borra la clave OpenAI guardada en BD.
- `PUT /api/settings/hf` — cuerpo `{"hf_token": "hf_..."}`; token de Hugging Face Hub (opcional).
- `DELETE /api/settings/hf` — borra el token HF guardado.

### RAG

- `POST /api/query_rules` — Cuerpo `question`, `scope` (`rules` \| `campaigns_general` \| `campaign`), opcional `campaign_id` si `scope=campaign`, opcional `target_owner_id` (admin). Las subidas van al índice de **manuales**; las referencias de campaña se reindexan al consultar (y desde la generación de contenido).
- `POST /api/upload_pdf` — Subida multipart: campo **`rag_target`** (`manuals` \| `campaign`), **`files`** repetido (uno o más documentos PDF, TXT o DOCX); guarda en `backend/data/uploads/<user_id>/`, crea una fila en `ingest_jobs` por fichero (con la colección destino en `collection_name`) y responde **202** con `{ "queued": [...], "errors": [...] }`. El campo `file` (singular) sigue admitido por compatibilidad. La indexación la hace el worker en la colección elegida (**manuales** o **referencias de campaña**).
- `GET /api/ingest_jobs?limit=50` — Lista de trabajos del propietario: `status` (`queued` | `processing` | `done` | `failed`), `progress_percent`, `phase_label`, y al terminar `outcome` (`indexed` | `unchanged` | `empty`), `message`, metadatos.
- `POST /api/rag/clear` — Cuerpo `{"targets": ["manuals", "campaign"]}` (uno o ambos); opcional `target_owner_id` (admin). Borra la(s) colección(es) PGVector, trabajos de ingesta asociados, ficheros en `uploads/<usuario>/` y manifiestos locales (`ingest_manifest.json`, `campaign_rag_meta.json` para las campañas del usuario).

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
