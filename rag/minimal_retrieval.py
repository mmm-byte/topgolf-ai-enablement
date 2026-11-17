"""Minimal retrieval over the governed documentation corpus.

Deliberately not a vector database. The corpus is small, bounded, owned, and cited, and
a keyword index with citations answers these questions as well as an embedding index
would while adding no dependency and no new failure mode.

The upgrade trigger is documented in `rag/when-to-use-retrieval.md`: when keyword
search measurably stops being good enough for the corpus, move to embeddings with the
same three conditions attached.

Every result carries its source path and the matching passage, so a caller can cite it
or withhold the answer when nothing supports it.

Usage:
    python -m rag.minimal_retrieval "which archetype handles shift handover"
    python -m rag.minimal_retrieval --json "escalation policy minors"
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# The corpus is explicit on purpose. Retrieval over an unbounded directory is how
# unrelated content ends up in an answer.
CORPUS: list[tuple[str, str]] = [
    ("archetypes/shift-handover/SKILL.md", "shift handover incident log three lines next shift"),
    ("archetypes/campaign-brief/SKILL.md", "campaign brief claims check audience consent offer"),
    ("archetypes/guest-frequency-anomaly/SKILL.md", "frequency anomaly win-back lapse segment baseline"),
    ("archetypes/retired/legacy-standup-summary/SKILL.md", "standup summary retired merged legacy"),
    ("archetypes/references/intake-questionnaire.md", "intake questionnaire data class owner connector steward"),
    ("archetypes/references/spec-template.md", "spec template rules escalation release gate success measure"),
    ("archetypes/references/guardrails.md", "guardrails scope output policy check severity class"),
    ("platform/connectors/catalog.yaml", "connector catalog approved connector never exposes steward"),
    ("review/ai-output-review-rubric.md", "review rubric code spec gate result findings severity"),
    ("review/gate-finding-triage.md", "triage escalation route security data owner app steward severity"),
    ("rag/when-to-use-retrieval.md", "retrieval query metric decision rag when to use"),
    ("security/adversarial/cases.json", "adversarial injection jailbreak exfiltration policy violation"),
    ("security/guardrails/guardrails.py", "guardrail engine scope output policy self test"),
    ("monitoring/health_report.py", "health report drift prompt bloat archetype monitoring usage"),
    ("scripts/build_pipeline.py", "pipeline bronze silver gold quality checks snapshot synthetic"),
]

STOPWORDS = {
    "the", "a", "an", "and", "or", "of", "to", "in", "for", "on", "is", "are", "was",
    "which", "what", "how", "do", "does", "did", "i", "it", "my", "me", "we", "our",
    "that", "this", "with", "by", "at", "from", "be", "can", "should", "would",
}


def _tokenize(text: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9-]{2,}", text.lower()) if t not in STOPWORDS]


def _load_document(relative_path: str) -> str:
    path = ROOT / relative_path
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8", errors="ignore")


def _score(query_tokens: list[str], doc_tokens: list[str], keywords: list[str]) -> float:
    if not query_tokens or not doc_tokens:
        return 0.0
    doc_set = set(doc_tokens)
    doc_counter = {token: doc_tokens.count(token) for token in set(doc_tokens)}

    score = 0.0
    for token in query_tokens:
        if token in doc_set:
            score += 1.0 + 0.1 * (doc_counter[token] - 1)

    # Keyword hints let a document declare what it is for, which matters for short
    # queries where the literal terms do not appear in the body.
    for keyword in keywords:
        if any(kw in query_tokens or kw in keyword.lower() for kw in query_tokens):
            score += 2.0
            break

    # Small length normalisation so a long document does not win on volume alone.
    return score / (1.0 + 0.0005 * len(doc_tokens))


def _best_passage(text: str, query_tokens: list[str], max_words: int = 90) -> str:
    """Return the paragraph with the strongest overlap, so a citation is precise."""
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    if not paragraphs:
        return ""
    best, best_score = paragraphs[0], -1.0
    for para in paragraphs:
        tokens = _tokenize(para)
        overlap = sum(1 for t in query_tokens if t in set(tokens))
        if overlap > best_score:
            best, best_score = para, overlap
    words = best.split()
    if len(words) > max_words:
        best = " ".join(words[:max_words]) + " ..."
    return best


def search(query: str, limit: int = 5) -> list[dict]:
    query_tokens = _tokenize(query)
    results = []
    for relative_path, keywords in CORPUS:
        text = _load_document(relative_path)
        if not text:
            continue
        doc_tokens = _tokenize(text)
        score = _score(query_tokens, doc_tokens, keywords.split())
        if score <= 0:
            continue
        results.append({
            "source": relative_path,
            "score": round(score, 3),
            "passage": _best_passage(text, query_tokens),
        })
    results.sort(key=lambda r: -r["score"])
    return results[:limit]


def main() -> int:
    parser = argparse.ArgumentParser(description="Minimal retrieval over governed docs")
    parser.add_argument("query", help="The question to retrieve context for")
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON")
    parser.add_argument("--limit", type=int, default=5)
    args = parser.parse_args()

    results = search(args.query, args.limit)

    if args.json:
        print(json.dumps({"query": args.query, "results": results}, indent=2))
        return 0

    if not results:
        print(f"No passage in the governed corpus supports: {args.query}")
        print("Withhold the answer rather than generating one without a source.")
        return 0

    print(f'Query: {args.query}\n')
    for idx, r in enumerate(results, start=1):
        print(f"{idx}. {r['source']}  (score {r['score']})")
        passage = r["passage"]
        print(f"   {passage[:260]}{'...' if len(passage) > 260 else ''}\n")
    print("Every passage above is citable. If none supports the answer, withhold it.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())