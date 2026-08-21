# Authority Object B exact-byte preflight v1

**Status:** operational kit for real v1 blind runs
**Text rule:** LF only

This file is for the independent Authority before E1. It is answer-free and
contains no real cases, expected sets, oracle material, nonce material, or
private run coordinates.

## Goal

Before freezing E1, the Authority must confirm that the exact Object B bytes
are canonical `encodeJsonUtf8Lf` bytes, not merely schema-valid JSON with the
right semantic content.

A schema-valid but non-canonical Object B is a fail-closed condition:

```text
TSEI_V1_UNPROVEN
reason: object_b_bytes_non_canonical
semantic comparison: NOT_EVALUATED
```

## Exact byte rule

Object B must be:

- recursively key-sorted JSON
- UTF-8
- compact (no pretty-print indentation)
- exactly one trailing LF
- no BOM
- no CR / CRLF
- no NUL
- byte-identical to `encodeJsonUtf8Lf(parsed)`

## Mandatory preflight before E1

The Authority should run this checklist on the exact bytes to be frozen:

- [ ] bytes are non-empty
- [ ] bytes are valid UTF-8
- [ ] bytes contain no BOM
- [ ] bytes contain no `\r`
- [ ] bytes contain no NUL
- [ ] bytes end with exactly one final LF
- [ ] bytes parse as JSON
- [ ] re-encoding the parsed value with `encodeJsonUtf8Lf` reproduces the exact same bytes
- [ ] schema is `tsei-invariant-discrimination-v0.authority-oracle.v0`
- [ ] `problem_package_digest` matches Object A digest exactly
- [ ] case universe is exactly the declared run universe
- [ ] only declared invariant IDs appear in `derived_attribution_set`

If any check fails, **do not publish E1**.

## Required Originator handoff materials

Before Object A is released, the Originator should provide the Authority:

1. an **answer-free canonical Object B template**;
2. this exact-byte preflight checklist;
3. at least one valid and one invalid serialization example.

## Minimal freeze discipline

When ready to freeze:

1. derive the attribution sets independently from Object A alone;
2. materialize Object B in canonical form;
3. run the exact-byte preflight on the exact bytes;
4. hash those exact bytes;
5. freeze/publish those exact bytes as E1;
6. send the exact bytes plus E1 coordinates back to the Originator.

## Non-repair rule

If a later check shows that E1 froze non-canonical Object B bytes:

- do not canonicalize and continue the same instance;
- do not re-sign a replacement Object B for that closed instance;
- preserve the original evidence unchanged;
- if a proof is still wanted, start a new blind instance with a new
  `instance_id` and genuinely new cases.
