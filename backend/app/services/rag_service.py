from __future__ import annotations

import logging

from langchain_openai import ChatOpenAI

from backend.app.config import get_settings
from backend.app.openai_key_runtime import get_openai_key_for_llm_and_embeddings
from backend.app.prompts.loader import render_prompt_template
from backend.app.vector_store import get_vector_store

logger = logging.getLogger(__name__)

_MAX_EXTRA_CONTEXT_CHARS = 120_000


def answer_question(
    question: str,
    *,
    collection_name: str,
    k: int = 4,
    extra_context: str | None = None,
    metadata_filter: dict | None = None,
) -> dict:
    """
    extra_context: texto fijo (p. ej. snapshot de campaña) que se antepone al contexto recuperado por RAG.
    metadata_filter: filtro de metadatos PGVector (p. ej. {"campaign_id": "<uuid>"}).
    """
    logger.info("RAG: pregunta recibida (colección=%s, k=%d): %s", collection_name, k, question[:100])
    settings = get_settings()
    api_key = get_openai_key_for_llm_and_embeddings()

    vs = get_vector_store(collection_name=collection_name)
    if metadata_filter:
        docs = vs.similarity_search(question, k=k, filter=metadata_filter)
    else:
        retriever = vs.as_retriever(search_kwargs={"k": k})
        docs = retriever.invoke(question)

    num_docs = len(docs) if docs else 0
    logger.info("RAG: documentos recuperados: %d", num_docs)

    rag_blocks = "\n\n".join(
        [
            f"[source={d.metadata.get('source', '?')} page={d.metadata.get('page', '?')}]\n{d.page_content}"
            for d in docs
        ]
    )
    extra = (extra_context or "").strip()
    if len(extra) > _MAX_EXTRA_CONTEXT_CHARS:
        extra = extra[:_MAX_EXTRA_CONTEXT_CHARS] + "\n\n[…contenido truncado…]"
    if extra and rag_blocks:
        context = f"{extra}\n\n---\n\nFragmentos relevantes (búsqueda semántica):\n{rag_blocks}"
    elif extra:
        context = extra
    else:
        context = rag_blocks

    llm = ChatOpenAI(model=settings.openai_model, api_key=api_key)
    system_prompt = render_prompt_template("rag_system.txt", {"__CONTEXT__": context})
    messages = [
        ("system", system_prompt),
        ("human", question),
    ]
    resp = llm.invoke(messages)

    answer = getattr(resp, "content", str(resp))
    sources = [{"source": d.metadata.get("source"), "page": d.metadata.get("page")} for d in docs]
    return {"answer": answer, "sources": sources}
