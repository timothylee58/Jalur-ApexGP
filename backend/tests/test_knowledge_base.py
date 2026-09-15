"""Retrieval quality checks.

These assert that a realistic question surfaces the document that
actually answers it. They're the part of a RAG system most likely to
silently degrade — a reworded document that stops matching its own
question fails nothing else in the stack.
"""

import pytest

from app.services import knowledge_base


def _top_ids(query: str, limit: int = 3) -> list[str]:
    return [hit.document.id for hit in knowledge_base.search(query, limit=limit)]


class TestCorpus:
    def test_document_ids_are_unique(self):
        ids = [d.id for d in knowledge_base.DOCUMENTS]
        assert len(ids) == len(set(ids))

    def test_every_document_has_substantive_body(self):
        for doc in knowledge_base.DOCUMENTS:
            assert len(doc.body) > 80, f"{doc.id} is too thin to be worth retrieving"
            assert doc.title and doc.section

    def test_lookup_by_id(self):
        assert knowledge_base.document_by_id("circuit-t15") is not None
        assert knowledge_base.document_by_id("nope") is None


class TestTokenizer:
    def test_keeps_domain_digits(self):
        # "T9" and "2026" carry meaning here; a tokenizer that drops
        # digits would make half the corner questions unanswerable.
        assert "t9" in knowledge_base.tokenize("What is T9 like?")
        assert "2026" in knowledge_base.tokenize("the 2026 regulations")

    def test_drops_stopwords_but_not_negations(self):
        tokens = knowledge_base.tokenize("the car is not on the grid")
        assert "the" not in tokens
        assert "not" in tokens


class TestRetrieval:
    @pytest.mark.parametrize(
        ("query", "expected"),
        [
            ("What's the slowest corner at Sepang?", "circuit-berjaya-tioman"),
            ("Tell me about the Genting Curve", "circuit-genting"),
            ("What is the KLIA curve?", "circuit-klia"),
            ("where is the best overtaking into turn 1", "circuit-t1-t2"),
            ("what is an undercut", "strategy-undercut"),
            ("why does a safety car matter for strategy", "strategy-safety-car"),
            ("what tyre compounds are there", "strategy-tyres"),
            ("how does qualifying work", "weekend-quali"),
            ("what is parc ferme", "weekend-parc-ferme"),
            ("explain DRS", "weekend-drs"),
            ("what is overtake mode", "weekend-drs"),
            ("how does active aero work", "weekend-drs"),
            ("how do I get to the circuit from Kuala Lumpur", "travel-getting-there"),
            ("which grandstand should I sit in", "travel-tickets"),
            ("how many points for a win", "basics-points"),
            ("what changed in the 2026 regulations", "basics-2026-regs"),
            ("when is the Singapore Grand Prix", "weekend-singapore"),
            ("where does this app get its data", "app-data-sources"),
            ("is this official F1", "app-what-it-is"),
        ],
    )
    def test_question_retrieves_the_document_that_answers_it(self, query, expected):
        assert expected in _top_ids(query), (
            f"{query!r} did not surface {expected}; got {_top_ids(query)}"
        )

    def test_drs_document_does_not_present_drs_as_current(self):
        # DRS was dropped for 2026, the season this app is set in. The
        # document has to answer a DRS question by saying it is gone —
        # retrieval alone isn't enough if the prose is out of date.
        doc = knowledge_base.document_by_id("weekend-drs")
        assert doc is not None
        assert "no longer exists" in doc.body
        assert "active aero" in doc.body.lower()
        assert "Overtake" in doc.body

    def test_hot_lap_question_finds_the_simulation_caveat(self):
        # The honesty document must be reachable — a user asking about the
        # lap time should get the "this is simulated" framing with it.
        assert "circuit-hot-lap-sim" in _top_ids("is the hot lap time real", limit=4)

    def test_off_topic_query_returns_nothing(self):
        # No match is the correct answer; rag_service passes the empty
        # list through so the assistant declines rather than answering
        # from whatever ranked least badly.
        assert knowledge_base.search("zzzxqv nonexistent gibberish") == []

    def test_empty_query_returns_nothing(self):
        assert knowledge_base.search("") == []
        assert knowledge_base.search("the and of") == []

    def test_scores_are_ordered_descending(self):
        hits = knowledge_base.search("sepang corner braking", limit=5)
        scores = [h.score for h in hits]
        assert scores == sorted(scores, reverse=True)

    def test_limit_is_respected(self):
        assert len(knowledge_base.search("sepang", limit=2)) <= 2
