# Two ways to build a code map, and how the docs are organised

Status: written from the repo's own comparison script and the design discussion. The comparison was reported earlier; it was not rerun for this note, so no counts are given here.

## Regex vs syntax-tree extraction
The repo has two extractors that build a map of declarations and the links between them. One reads source with regular expressions. The other parses the code into a syntax tree. `tools/compare_extractors.py` (https://raw.githubusercontent.com/irvan-putra/vana/main/tools/compare_extractors.py) runs both on the same files and prints:
- declarations only one side found, and label differences;
- links only the regex side found, sorted by checking them against the source (matches inside strings or comments, containment, other);
- links only the syntax-tree side found, sorted by cause (a declaration the regex missed, parent and inner pairs, links into files not split into declarations, word matches the regex missed such as spread names).

Judgment, not a benchmark: regex is simple but can link names that only appear in text; a syntax tree is stricter and can see nesting. Which gives a better map on a given repo is shown by running the script there.

## Structuring the docs
- C4 (https://c4model.com) describes software at four zoom levels: context, containers, components, code. It suits the map views.
- Diataxis (https://diataxis.fr) separates tutorials, how-to guides, reference and explanation. Using it keeps the review guide, the how-to steps and the design rationale apart.
- "The map is not the territory": a generated map shows what the extractor could see, so each map should say which extractor made it and what it may miss.
