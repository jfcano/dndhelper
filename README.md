## dndhelper

Prototipo (Fase 1): backend en Python con **FastAPI + LangChain**, RAG sobre un PDF de D&D usando **Chroma persistido** y embeddings **`BAAI/bge-m3` (CPU)**.

### Requisitos

- Python 3.10+ (recomendado 3.11)
- Variable de entorno **`OPENAI_API_KEY`** para el modelo de chat (respuesta final)

### Instalación

```bash
python -m venv .venv
source .venv/bin/activate
pip install -U pip
# Torch en CPU (evita descargas CUDA enormes)
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r backend/requirements.txt
```

### Añadir el PDF

Copia tu PDF a `backend/data/pdfs/` (por ejemplo `backend/data/pdfs/manual.pdf`).

### Ingesta (crear embeddings y persistirlos)

```bash
python -m backend.scripts.ingest_pdf --pdf backend/data/pdfs/manual.pdf
```

Esto crea/actualiza un índice Chroma persistido en `backend/storage/chroma_rules/`.

### Ejecutar la API

```bash
uvicorn backend.app.main:app --reload
```

### Probar una consulta

```bash
curl -s -X POST http://127.0.0.1:8000/api/query_rules \
  -H 'Content-Type: application/json' \
  -d '{"question":"¿Qué es una tirada de salvación?"}'
```

