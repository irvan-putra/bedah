# Ideas for checking code you did not write: crev, Unison, Lean

Status: exploration. Sources re-opened 2026-11-16 where marked "verified"; other claims are marked unverified and should be checked before publishing.

## Question
How can a reviewer build trust in code, including code written with AI help, when reading all of it is impractical?

## crev
Signed, distributed code review: reviewers publish proofs and you choose whom to trust. Its docs say trust is about people. Verified: repository exists, with cargo-crev as the Rust implementation. Unverified: current maturity of cargo-crev and of other language versions. https://github.com/crev-dev/crev , https://github.com/crev-dev/cargo-crev

## Unison
Each definition is identified by a hash of its syntax tree; names are metadata (verified from the official overview). A hash shows code did not change, not that it is safe. Whether a WASM or other target exists today is unverified; see https://github.com/unisonweb/unison/discussions/5516 . https://www.unison-lang.org/docs/the-big-idea/

## Lean 4
- lean-yjs formalizes a sequence CRDT in Lean 4 and proves properties such as total ordering of items (verified from its README). https://github.com/iasakura/lean-yjs
- crdtlib is a Lean 4 library of combinators that each preserve convergence, so CRDTs built from them are convergent by construction (verified). https://prg-grp.github.io/crdtlib/
- A proof covers a model of the algorithm. It does not show that separate shipped code matches the model, or cover transport, encryption or UI. Testing the real code against the model is one way to narrow that gap.
- Proofs cover all inputs in the model; property-based tests sample inputs. They are complementary.

## Practices worth trying (author's proposals, not findings)
1. Keep the core logic small and separately reviewable.
2. Ship a short human-readable change summary for the core with each release.
3. Pin and verify dependencies (Gradle: https://docs.gradle.org/current/userguide/dependency_verification.html).
4. Treat tests as a readable spec, not as proof of safety.
5. Optionally specify one component in Lean and test the real code against it.

## Limits
No tool here removes the need for human judgment. Nothing in this note was run or measured.
