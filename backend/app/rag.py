from __future__ import annotations

from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from backend.app.config import get_settings
from backend.app.vector_store import get_vector_store


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
    settings = get_settings()
    if not settings.openai_api_key:
        raise RuntimeError("Falta OPENAI_API_KEY en el entorno.")

    vs = get_vector_store()
    retriever = vs.as_retriever(search_kwargs={"k": k})
    docs = retriever.get_relevant_documents(question)
    context = "\n\n".join(
        [
            f"[source={d.metadata.get('source','?')} page={d.metadata.get('page','?')}]\n{d.page_content}"
            for d in docs
        ]
    )

    llm = ChatOpenAI(model=settings.openai_model, api_key=settings.openai_api_key)
    messages = _PROMPT.format_messages(context=context, question=question)
    resp = llm.invoke(messages)

    sources = []
    for d in docs:
        sources.append(
            {
                "source": d.metadata.get("source"),
                "page": d.metadata.get("page"),
            }
        )

    return {"answer": getattr(resp, "content", str(resp)), "sources": sources}

