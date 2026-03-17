from __future__ import annotations

import logging

from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from backend.app.config import get_settings
from backend.app.vector_store import get_vector_store

logger = logging.getLogger(__name__)

_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "Eres un asistente para un Máster de Dungeons & Dragons. "
            "Responde en español, de forma útil y concisa. "
            "Usa únicamente la información del CONTEXTO cuando sea relevante; "
            "si no hay suficiente información en el contexto, dilo explícitamente y sugiere qué buscar.\n\n"
            "CONTEXTO:\n{context}",
        ),
        ("human", "{question}"),
    ]
)


def answer_question(question: str, *, k: int = 4) -> dict:
    logger.info("RAG: pregunta recibida (k=%d): %s", k, question[:100])
    settings = get_settings()
    if not settings.openai_api_key:
        logger.error("RAG: falta OPENAI_API_KEY en el entorno")
        raise RuntimeError("Falta OPENAI_API_KEY en el entorno.")

    vs = get_vector_store()
    retriever = vs.as_retriever(search_kwargs={"k": k})
    docs = retriever.invoke(question)

    num_docs = len(docs) if docs else 0
    logger.info("RAG: documentos recuperados: %d", num_docs)

    context = "\n\n".join(
        [
            f"[source={d.metadata.get('source','?')} page={d.metadata.get('page','?')}]\n{d.page_content}"
            for d in docs
        ]
    )

    llm = ChatOpenAI(model=settings.openai_model, api_key=settings.openai_api_key)
    messages = _PROMPT.format_messages(context=context, question=question)
    resp = llm.invoke(messages)

    answer = getattr(resp, "content", str(resp))
    sources = [{"source": d.metadata.get("source"), "page": d.metadata.get("page")} for d in docs]
    return {"answer": answer, "sources": sources}

