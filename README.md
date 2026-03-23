# DnD Helper

DnD Helper es una aplicación web para directores/as de juego de Dungeons & Dragons (5e) que combina dos capacidades en un único flujo:

- gestión de campañas, mundos y sesiones;
- consultas inteligentes tipo RAG sobre documentación (manuales y material de campaña).

La idea del proyecto es que puedas preparar y evolucionar una campaña completa desde una interfaz única, con apoyo de modelos de lenguaje, almacenamiento relacional y búsqueda semántica.

---

## a. Descripción general del proyecto

DnD Helper está construido como una solución full-stack con backend en FastAPI, frontend en React y PostgreSQL como base de datos principal (incluyendo vectores con pgvector).

De forma práctica, el sistema te permite:

- crear campañas a partir de un brief;
- generar y revisar historias, outlines y sesiones;
- vincular campañas con mundos y activos visuales;
- subir documentos (PDF, TXT, DOCX) para consultas con recuperación semántica.

### Cómo funciona a nivel funcional

1. El usuario se registra o inicia sesión.
2. Define ajustes (por ejemplo, clave de OpenAI en Ajustes).
3. Crea campaña/mundo/sesiones o sube documentación.
4. Consulta por lenguaje natural:
   - **scope `rules`** para manuales/reglas;
   - **scope `campaigns_general`** para referencias generales de campañas;
   - **scope `campaign`** para una campaña concreta.

### Aislamiento por usuario

Cada cuenta trabaja sobre sus propios recursos (`owner_id`):

- campañas, mundos y sesiones;
- trabajos de ingesta;
- colecciones RAG en pgvector;
- ficheros subidos en `backend/data/uploads/<owner_id>/`.

Un usuario administrador puede operar sobre recursos de otros usuarios cuando procede.

---

## b. Stack tecnológico utilizado

### Backend y API

- **Python** (entorno local recomendado 3.11+, imagen Docker basada en 3.12).
- **FastAPI** + **Uvicorn**.
- **SQLAlchemy** + **Alembic** para ORM y migraciones.
- **PyJWT** + `bcrypt` para autenticación.

### Datos y búsqueda semántica

- **PostgreSQL** como base relacional.
- **pgvector** para embeddings y recuperación vectorial.
- **LangChain** (`langchain-openai`, `langchain-postgres`, splitters, loaders).
- Ingesta de documentos con soporte para **PDF/TXT/DOCX**.

### Frontend

- **React 19** + **React Router 7**.
- **TypeScript** + **Vite 8**.
- En desarrollo, Vite usa proxy `/api` hacia `http://127.0.0.1:8000`.

### Infra y despliegue

- **Docker Compose** con servicios: `db`, `backend`, `ingest-worker`, `frontend` (+ perfiles `test` y `e2e`).
- **Kubernetes** (manifiesto de referencia en `deploy/k8s/all-in-one.yaml`).
- **Nginx** para servir frontend en contenedor y enrutar `/api` y `/admin` al backend.

### Testing

- **pytest** para backend.
- **Playwright** para E2E de frontend.

---

## c. Información sobre su instalación y ejecución

Esta sección está pensada para que puedas levantar el proyecto sin adivinar pasos.

### 1) Requisitos previos

- Python 3.11+ (3.12 también válido).
- Node.js LTS + npm.
- PostgreSQL con extensión `vector` (pgvector).
- (Opcional, pero habitual) clave OpenAI para chat/embeddings/imágenes.
- Docker + Compose v2 (si usarás contenedores).

### 2) Instalación en local (desarrollo)

Desde la raíz del repositorio:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -r requirements.txt
```

Instala frontend:

```bash
cd frontend
npm install
cd ..
```

### 3) Configuración de entorno

Crea tu `.env` a partir del ejemplo:

```bash
cp .env.example .env
```

Variables mínimas recomendadas:

- `POSTGRES_URL`: conexión principal a PostgreSQL.
- `JWT_SECRET`: secreto de tokens (cámbialo siempre en entornos reales).
- `POSTGRES_TEST_URL`: base aislada para tests.

Variables de arranque importantes:

- `ADMIN_USERNAME` / `ADMIN_PASSWORD`: crea/actualiza admin al iniciar API.
- `SETUP_MASTER_PASSWORD`: necesaria para instalación inicial vía `/setup` cuando no existe ningún admin.
- `INGEST_WORKER_AUTOSTART` y `INGEST_WORKER_COUNT`: controlan workers de ingesta al arrancar uvicorn.

Modelos IA configurables:

- `OPENAI_MODEL` (chat).
- `OPENAI_EMBEDDINGS_MODEL` (embeddings).
- `OPENAI_IMAGE_MODEL` (imágenes).

La generación de imágenes de mundos está habilitada siempre que el usuario tenga una clave OpenAI activa en Ajustes.

### 4) Base de datos y migraciones

Primero habilita pgvector en tu Postgres:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Después aplica migraciones desde la raíz:

```bash
alembic upgrade head
```

### 5) Ejecución en local

#### Backend

```bash
uvicorn backend.app.main:app --reload
```

Endpoints útiles:

- `http://127.0.0.1:8000/health`
- `http://127.0.0.1:8000/health/ready`
- `http://127.0.0.1:8000/docs`
- `http://127.0.0.1:8000/admin`

#### Frontend

En otra terminal:

```bash
cd frontend
npm run dev
```

Vite normalmente arranca en `http://127.0.0.1:5173` y redirige `/api` al backend.

### 6) Ingesta RAG de documentos

Puedes cargar documentos de dos maneras:

- por UI (`/documentos`) para cola asíncrona;
- por CLI (scripts de ingesta).

Ejemplos CLI:

```bash
python -m backend.scripts.ingest_pdf --pdf backend/data/manual.pdf
python -m backend.scripts.ingest_pdfs --dir backend/data
```

Para compartir colección con un usuario concreto:

```bash
python -m backend.scripts.ingest_pdf --pdf backend/data/manual.pdf --owner-id <uuid_usuario>
```

#### Nota importante sobre workers

- En local, por defecto el backend puede lanzar workers (`INGEST_WORKER_AUTOSTART=true`).
- En Compose, existe servicio dedicado `ingest-worker`, y el backend lleva `INGEST_WORKER_AUTOSTART=false` para evitar duplicidades.

### 7) Ejecución con Docker Compose

1. Revisa `.env` (incluye `JWT_SECRET`; y si no hay admin creado, define `SETUP_MASTER_PASSWORD`).
2. Levanta servicios:

```bash
docker compose up -d --build
```

URLs habituales:

- Frontend (Nginx): `http://localhost:80`
- Backend API: `http://localhost:8000`
- PostgreSQL: `localhost:5432`

Servicios principales en Compose:

- `db` (pgvector/pg16),
- `backend`,
- `ingest-worker`,
- `frontend` (nginx con `BACKEND_UPSTREAM`).

Perfiles opcionales:

- `test` para pytest en contenedor.
- `e2e` para Playwright en contenedor.

### 8) Despliegue Kubernetes (referencia)

Hay un manifiesto completo en `deploy/k8s/all-in-one.yaml` con:

- Secret de aplicación y base de datos;
- StatefulSet + Service de PostgreSQL;
- Deployment + Service del backend;
- Deployment separado para `ingest-worker`;
- Deployment + Service de frontend.

Flujo básico:

1. Ajusta credenciales/URLs del Secret.
2. Publica imágenes o usa imágenes accesibles en tu clúster.
3. Aplica el manifiesto:

```bash
kubectl apply -f deploy/k8s/all-in-one.yaml
```

### 9) Pruebas

#### Backend (pytest)

```bash
./scripts/test.sh
```

o en Windows:

```powershell
./scripts/test.ps1
```

#### Suite completa (pytest + E2E)

```bash
./scripts/test-all.sh
```

o en Windows:

```powershell
./scripts/test-all.ps1
```

También puedes usar Compose con perfiles `test`/`e2e`.

---

## d. Estructura del proyecto

```text
dndhelper/
├── README.md
├── .env.example
├── requirements.txt
├── requirements-dev.txt
├── alembic.ini
├── docker-compose.yml
├── alembic/
│   └── versions/
├── backend/
│   ├── Dockerfile
│   ├── docker-entrypoint.sh
│   ├── docker-entrypoint-worker.sh
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── db.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── crud.py
│   │   ├── api/
│   │   │   ├── auth.py
│   │   │   ├── campaigns.py
│   │   │   ├── rag.py
│   │   │   ├── sessions.py
│   │   │   ├── settings.py
│   │   │   ├── setup.py
│   │   │   └── worlds.py
│   │   └── services/
│   ├── scripts/
│   │   ├── ingest_pdf.py
│   │   ├── ingest_pdfs.py
│   │   ├── ingest_worker.py
│   │   └── health_ingest.py
│   ├── admin_ui/
│   ├── data/
│   ├── prompt_templates/
│   └── storage/
├── frontend/
│   ├── Dockerfile
│   ├── Dockerfile.e2e
│   ├── package.json
│   ├── vite.config.ts
│   ├── nginx.docker.conf
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── router.tsx
│       ├── components/
│       └── pages/
├── deploy/
│   └── k8s/
│       └── all-in-one.yaml
└── scripts/
    ├── test.sh
    ├── test.ps1
    ├── test-all.sh
    ├── test-all.ps1
    ├── docker-test-entrypoint.sh
    ├── healthcheck-backend.sh
    ├── healthcheck-postgres.sh
    └── healthcheck-nginx.sh
```

---

## e. Funcionalidades principales

### 1) Autenticación y control de acceso

- Registro e inicio de sesión por JWT.
- Resolución de contexto de usuario en la API.
- Rol administrador con capacidad de operación transversal.
- Flujo de instalación inicial (`/setup`) cuando no hay admin precreado.

### 2) Gestión de campañas

- CRUD de campañas.
- Generación y aprobación de brief, historia y outline.
- Vínculo opcional de campaña con mundo.
- Reapertura de estado de trabajo cuando se quiere iterar.

### 3) Gestión de mundos

- Generación/edición de mundos con campos en borrador y final.
- Definición de temas y tono.
- Generación bajo demanda de activos visuales (según configuración).

### 4) Gestión de sesiones

- Generación de múltiples sesiones por campaña.
- Listados por campaña y listados globales paginados.
- Ciclo de edición/aprobación/reapertura.

### 5) Consultas RAG y documentos

- Endpoint de consulta principal: `POST /api/query_rules`.
- Tres alcances de consulta (`rules`, `campaigns_general`, `campaign`).
- Subida de documentos a cola de ingesta (`/api/upload_pdf`) con soporte PDF/TXT/DOCX.
- Limpieza de índices/recursos por objetivo (`/api/rag/clear`).

### 6) Operación y observabilidad básica

- Endpoints de salud (`/health`, `/health/ready`).
- Documentación OpenAPI en `/docs`.
- Worker de ingesta desacoplable para escalar o separar carga.

---

Si vas a desplegar en producción, revisa especialmente secretos (`JWT_SECRET`, contraseñas DB, `SETUP_MASTER_PASSWORD`), políticas de red y persistencia de volúmenes.
