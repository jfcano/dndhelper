from __future__ import annotations

import logging

from langchain_openai import ChatOpenAI

from backend.app.config import get_settings
from backend.app.openai_key_runtime import get_openai_key_for_llm_and_embeddings
from backend.app.prompts.loader import render_prompt_template
from backend.app.vector_store import get_vector_store

logger = logging.getLogger(__name__)


def answer_question(question: str, *, k: int = 4) -> dict:
    logger.info("RAG: pregunta recibida (k=%d): %s", k, question[:100])
    settings = get_settings()
    api_key = get_openai_key_for_llm_and_embeddings()

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

