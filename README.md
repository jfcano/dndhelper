## dndhelper

Prototipo (Fase 1–2): backend en Python con **FastAPI + LangChain**, RAG sobre un PDF de D&D usando **Chroma persistido** y embeddings **`BAAI/bge-m3`**. Incluye una **página web** para consultar reglas y lore. Por defecto usa **CUDA** si está disponible (configurable con `EMBEDDINGS_DEVICE=cpu`). El código es **multiplataforma** (Windows y Linux).

### Requisitos

- Python 3.10+ (recomendado 3.11)
- Variable de entorno **`OPENAI_API_KEY`** para el modelo de chat (respuesta final)
- Para GPU: PyTorch con soporte CUDA y drivers NVIDIA

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

### Interfaz web (Fase 2)

La página está en **`frontend/index.html`**; la API la sirve en la ruta raíz. Con la API en marcha, abre **http://127.0.0.1:8000/** en el navegador: escribe tu pregunta sobre reglas o lore y pulsa «Preguntar».

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

