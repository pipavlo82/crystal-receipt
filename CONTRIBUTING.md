# CONTRIBUTING

Thanks for contributing to Crystal Receipt.

## Preferred PR style

Small PRs are strongly preferred.

Please avoid large mixed changes that combine multiple concerns such as:
- proof semantics
- viewer/presentation
- deploy/docs
- unrelated refactors

Smaller PRs are easier to review, test, and revert safely.

## Proof semantics vs presentation

Proof semantics must stay separate from presentation.

In practice:
- receipt verification logic should remain independent from visual rendering
- Evidence Capsule / proof-substrate changes should not be hidden inside purely visual PRs
- visual or demo layers should not redefine proof truth

## Design boundaries

Do **not** add the following without a separate design discussion:
- settlement logic
- reputation logic
- scoring logic
- ATP-linked behavior

Crystal Receipt is proof-first. These concerns must not be mixed into routine PRs.

## receipt_root semantics

All proof-substrate changes should preserve existing `receipt_root` semantics.

That includes:
- canonicalization behavior
- anchor-stripping behavior
- recomputation logic
- verifier expectations

If a PR affects any of those, call it out explicitly.

## Before opening a PR

Please run the existing test suites:

```bash
python -m unittest discover -s tests -p "test_*.py"
bun test tests/receiptos
```

If your change is docs-only, say so clearly in the PR.
