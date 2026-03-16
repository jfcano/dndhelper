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

    try:
        vs = get_vector_store()
        retriever = vs.as_retriever(search_kwargs={"k": k})
        docs = retriever.invoke(question)
    except Exception as e:
        logger.exception("RAG: error al recuperar documentos del vector store: %s", e)
        raise

    num_docs = len(docs) if docs else 0
    logger.info("RAG: documentos recuperados: %d", num_docs)
    if num_docs == 0:
        logger.warning("RAG: no hay documentos en el índice o la búsqueda no devolvió resultados. ¿Ingestaste un PDF?")

    context = "\n\n".join(
        [
            f"[source={d.metadata.get('source','?')} page={d.metadata.get('page','?')}]\n{d.page_content}"
            for d in docs
        ]
    )
    logger.debug("RAG: longitud del contexto: %d caracteres", len(context))

    try:
        llm = ChatOpenAI(model=settings.openai_model, api_key=settings.openai_api_key)
        messages = _PROMPT.format_messages(context=context, question=question)
        resp = llm.invoke(messages)
    except Exception as e:
        logger.exception("RAG: error al llamar al modelo de chat (OpenAI): %s", e)
        raise

    answer = getattr(resp, "content", str(resp))
    logger.info("RAG: respuesta generada (%d caracteres)", len(answer))

    sources = []
    for d in docs:
        sources.append(
            {
                "source": d.metadata.get("source"),
                "page": d.metadata.get("page"),
            }
        )

    return {"answer": answer, "sources": sources}

