# Options for classifying a project's parts

Status: research note, 2026-11-20 (WIB). No code changes accompany it, and nothing here is implementation approval. Companion to [the naming proposal](naming-parts-by-what-they-need.md), which defines the kinds this classifier would assign. Repos inspected: bedah at `b107bfb`, daya at `6dcb03e`. External sources fetched 2026-11-20.

## The question

The naming proposal marks each part of a project with a kind: tanya (asks a model at runtime), pasti (deterministic code), muatan (static content), kait (wiring), kata (words), uji (tests), jauh (outside services), kabut (unknown), plus the bekas provenance tag. This note compares ways to actually do that classification, and whether the classifier belongs in Bedah or in [daya](https://github.com/irvan-putra/daya) as a reusable piece Bedah consumes.

Two constraints set the shape of every option:

- Bedah's classification should stay deterministic and checkable, run by the same AST and name scans Bedah already has, rather than asking a model to judge the repo (stated in the naming proposal, matching this project's review philosophy).
- No paid AI services; local or in-page models only.

## Option 1: deterministic scans inside Bedah

Extend the existing extractors (`tools/ast_ts.mjs`, `tools/codemap_scan.py`, checked against each other by `tools/compare_extractors.py`) with kind rules:

- manifests, lockfiles, CI workflows, ignore files → kait;
- test paths and fixtures → uji;
- markdown and docs paths → kata;
- styles, images, fonts, data files, generated data → muatan;
- model weight files (`.onnx`, `.gguf`, `.safetensors`) → tanya;
- code importing a model SDK or referencing a model endpoint → tanya, with the import or endpoint recorded as evidence;
- anything no rule covers → kabut, shown, never dropped.

Every mark records which rule fired, so a reviewer can check the classification the same way they check the extractor. Strengths: deterministic, free, no downloads, already the architecture Bedah is built on. Limits: a prompt template hiding in an ordinary string is semantically invisible to rules; rules cannot discover outside services at all (that is what option 2 is for); rule coverage grows by hand.

## Option 2: a declaration convention

The repo declares its own kinds in a manifest (a JSON file at a known path), which Bedah reads and shows as "declared by hand" evidence. This is the only route that can see **jauh**: a hosted endpoint leaves no file to scan. It also settles the genuinely ambiguous files rules would otherwise send to kabut. Strengths: honest, human-audited, cheap. Limits: declarations drift from reality unless a check compares them against the scans; only as good as the author.

Options 1 and 2 complement each other and are both deterministic. They are the baseline everything else is measured against.

## Option 3: a small classifier model, owned by daya

Daya already runs classification experiments for its own recipe intents, directly reusable experience:

- a zero-shot text classifier (MobileBERT fine-tuned on MNLI, ~27 MB int8 via transformers.js, plus a ~3 MB runtime, downloaded only on an explicit tap) in `docs/compose-classifier.js`;
- an in-page Bayes classifier that reports confidence per sentence and refuses to guess below a threshold;
- SmolLM2-360M (~219-271 MB quants) running via wllama/WebAssembly;
- a purpose-trained tiny model experiment with synthetic-only data and a hand-written held-out set (`experiments/purpose-trained-model/`).

The shape that fits both projects: **daya owns the classifier as a reusable piece; Bedah consumes it as a second opinion.** Bedah's deterministic rules classify what they can; only the files the rules cannot place go to the model, and a model answer below the confidence threshold still lands in kabut. Daya's README is explicit that its confidence scores are not calibrated probabilities, so the threshold and the refusal behavior matter more than the number.

The contract would be: Bedah owns the taxonomy (the kinds and what evidence each mark carries); daya maps a file's text or summary to a kind with a confidence; Bedah decides display and thresholds. The exact model (id, quant, content hash) is pinned and recorded as evidence on every model-derived mark, because a model update silently changing classifications is the same dishonesty as an unlabeled guess.

Strengths: local, no paid AI, one home for classifier quality work instead of every project growing its own. Limits: a model answer is never deterministic evidence; it needs the pin, the threshold and the honesty label, or it undermines the point of the map.

## Option 4: browser- or OS-provided AI

Chrome's built-in AI (Prompt API, Gemini Nano) and Android's ML Kit GenAI APIs (Gemini Nano via AICore) offer on-device inference with no download and no account. Strengths: free, local, no model file to ship. Limits: availability varies by device and browser version, so a classification pipeline cannot depend on it; it cannot run in CI, so results would differ between the published map and any one visitor's recheck; non-deterministic output needs the same pinning problem solved that option 3 has, except the model version is outside the project's control.

Sources: [Chrome built-in AI](https://developer.chrome.com/docs/ai/built-in), [ML Kit GenAI APIs](https://developers.google.com/ml-kit/genai), [Gemini Nano on Android](https://developer.android.com/ai/gemini-nano), [transformers.js](https://huggingface.co/docs/transformers.js/index) (the runtime option 3 already uses).

## Option 5: a hosted model judges the repo

Documented and set aside: it needs an account and payment, sends source out, is non-deterministic across model versions, and contradicts both constraints above. Not recommended for any default path.

## Showing uncertain and mixed results

However the classifier works, the display rules stay the ones the naming proposal set:

- kabut is a first-class bucket, shown and never dropped; a confidence below threshold goes there rather than to the nearest guess.
- Mixed evidence produces multiple marks with per-mark evidence, never one forced label.
- Every mark says where it came from: a rule that fired, a declaration by hand, or a pinned model at a recorded confidence. Model-derived marks carry the same unverified honesty label Bedah already uses for unbacked claims.
- bekas stays a separate provenance tag; authorship and runtime dependence never merge.

## A possible order

1. Options 1 + 2: deterministic rules plus a declaration manifest. Fully checkable, nothing new to download, covers every kind except semantic edge cases, which honestly fall to kabut.
2. Option 3 as an optional second opinion on kabut files only, owned by daya, pinned and thresholded, clearly labeled.
3. Option 4 only if device APIs settle; option 5 stays out.

This order keeps the published map deterministic and reviewable today, and gives the daya collaboration a narrow, testable contract when it happens.
