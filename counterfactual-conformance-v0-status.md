# Counterfactual Conformance v0 — статус робіт

**Дата зрізу:** 2026-08-09  
**Репозиторій:** `C:\Users\msi\dev\crystal-receipt`  
**Поточна гілка:** `fix/counterfactual-runner-stage-closure-v0`  
**Поточний HEAD (next-lane parent):** `a2c63164fcd7272295866fa629629b966164a1e8`  
**Push:** не виконувався  
**Lane G / expected-result-set binding:** не розпочинався  

---

## 1. Де ми зараз (коротко)

Пройдені **Lane A → Lane F**, включно з трьома ремонтними комітами на Lane F:

1. typed execution outcome policy  
2. CAB error provenance boundary  
3. runner execution-stage closure для всіх поверхонь  

**Максимально дозволений claim зараз:**

> ReceiptOS розрізняє returned verifier observations, typed subject-contract rejection і untyped execution failure для поточних підтриманих counterfactual surfaces; frozen CAB semantic rejection можна оцінювати без парсингу raw exception strings; невідомі host/runtime failures лишаються unresolved. Усі runner surfaces мають розділені stages binding → input materialization → subject → output materialization.

**Що ще НЕ закрито (наступні gaps):**

- expected-result-set SHA256 binding  
- aggregate neighborhood conformance verdict  
- materialized-input derivation from source  
- DCN generator / umbrella Counterfactual Conformance package  

---

## 2. Ланцюг комітів (авторитетний порядок)

| Крок | Гілка | Commit | Статус |
|---|---|---|---|
| Lane A | `feat/counterfactual-conformance-challenge-model-v0` | `800603143caaadfcebf125d966181d1c38c397ca` | `COUNTERFACTUAL_CONFORMANCE_V0_LANE_A_PASSED` |
| Lane B | `feat/counterfactual-neighborhood-identity-v0` | `609b7ca0df6888d72b49046b65a8b5c2988da8ab` | `COUNTERFACTUAL_CONFORMANCE_V0_LANE_B_PASSED` (+ `LANE_B_PROFILE_IDENTITY_ALREADY_CLOSED`) |
| Lane C | `feat/counterfactual-result-normalization-v0` | `9c3974e3…` → repair **`a8ca8c4e9b83cced20b23b629ef053d656e3af96`** | `COUNTERFACTUAL_CONFORMANCE_V0_LANE_C_CONTRACT_REPAIR_PASSED` |
| Lane D | `feat/counterfactual-verifier-runner-v0` | `32ef5a68…` → repair **`2ef5c8744b1cac4bd5cd0618162bc4dac3e3e957`** | `COUNTERFACTUAL_CONFORMANCE_V0_LANE_D_BOUNDARY_REPAIR_PASSED` |
| Lane E | `feat/counterfactual-conformance-evaluator-v0` | `d188d64989cf906a6bcb7d6c7a026337bc0abf9b` | `COUNTERFACTUAL_CONFORMANCE_V0_LANE_E_PASSED` |
| Lane F policy | `feat/counterfactual-execution-outcome-policy-v0` | `a3ee269d9c8982e7f3c215a6a99066a399efafe9` | початковий Lane F (пізніше не прийнятий без repair) |
| Lane F provenance repair | `fix/counterfactual-execution-outcome-provenance-v0` | `7e65951428414844f8b395185cb2b0eaaf0a9ff3` | `COUNTERFACTUAL_CONFORMANCE_V0_LANE_F_PROVENANCE_REPAIR_PASSED` |
| Lane F runner stage closure | `fix/counterfactual-runner-stage-closure-v0` | **`a2c63164fcd7272295866fa629629b966164a1e8`** | `COUNTERFACTUAL_CONFORMANCE_V0_LANE_F_RUNNER_STAGE_CLOSURE_PASSED` |

**Батько для наступної lane:** `a2c63164fcd7272295866fa629629b966164a1e8`

---

## 3. Архітектура (як склалося)

```text
Lane A  VerifierChallengeVectorModelV0
   ↓
Lane B  CounterfactualChallengeIdentityV0 / neighborhood SHA256
   ↓
Lane D  runVerifierChallenge()  → execution outcome
   ↓                              (subject_returned |
   │                               subject_contract_rejected |
   │                               execution_failure)
   │                               RunnerContractError (pre-execution throw)
   ↓
Lane C  normalize* (тільки returned native / expected-side)
   ↓
Lane E  evaluateVerifierChallengeConformance()
          → evaluated conformant | evaluated nonconformant
          → execution_unresolved (verdict null)
```

### Критичні інваріанти

```text
subject_returned
≠ subject_contract_rejected
≠ execution_failure
≠ RunnerContractError
≠ normalized verifier observation
≠ conformance verdict
```

Також:

- expected payload **не** впливає на dispatch / execution  
- немає `source_validity` synthesis  
- immutable closed production adapter registry (без invoker overrides)  
- typed CAB rejection **не** парсить `Error.message`  

---

## 4. Що зроблено по lanes

### Lane A — Challenge model

**Файл:** `src/receiptos/challenge/verifier-challenge-model.ts`  
**Schema:** `receiptos.verifier_challenge_model.v0`

- канонічна проекція frozen challenge vectors  
- surface / subject / source / derivation / expected / native  
- CAB: `subject: null`, `source: null`, audit-boundary operation derivation  

### Lane B — Neighborhood identity

**Файл:** `src/receiptos/challenge/counterfactual-neighborhood.ts`  
**Schemas:**  
- `receiptos.counterfactual_challenge_identity.v0`  
- `receiptos.counterfactual_neighborhood.v0`

- identity **без** expected/actual/verdict  
- frozen neighborhood SHA256 (pinned):

```text
37a213cff7a34e28df165c282f2b9e7460e31fbd37794bf5020c1e91158ed36d
```

### Lane C — Result normalization

**Файл:** `src/receiptos/challenge/counterfactual-result-normalization.ts`  
**Schema:** `receiptos.counterfactual_observation.v0`

Класи спостережень:

- affirmative  
- rejected  
- unverifiable  
- malformed  
- operation  

Repair:

- exact Chronicle admission failure class/reason pairs  
- unknown/`host_error` → `NormalizationContractError`  
- без unauthorized `source_validity_effect`  

### Lane D — Verifier runner

**Файл:** `src/receiptos/challenge/counterfactual-verifier-runner.ts`  
**Schemas:**  
- `receiptos.counterfactual_verifier_runner.v0`  
- `receiptos.counterfactual_execution_outcome.v0`

Поверхні:

- `verify_handoff_receipt_root`  
- `chronicle_admission`  
- `chronicle_continuity`  
- `chronicle_checkpoint_local`  
- `counterfactual_audit_boundary`

Repair:

- прибрано mutable invoker override / test-only production hooks  
- safe diagnostics: closed `error_name` + generic `safe_message`  

### Lane E — Conformance evaluator

**Файл:** `src/receiptos/challenge/counterfactual-conformance-evaluator.ts`  
**Schema:** `receiptos.counterfactual_conformance_evaluation.v0`

- bound path: вимагає `lane_a_model`, ганяє Lane D, порівнює expected vs actual  
- `execution_failure` → завжди `execution_unresolved`, `verdict: null`  
- ніколи не трактує untyped failure як conformant/nonconformant  

### Lane F — Execution outcome policy + repairs

#### F1. Typed CAB rejection (`a3ee269d`)

**Файли:**

- `src/receiptos/challenge/counterfactual-audit-boundary.ts`  
- `src/receiptos/challenge/counterfactual-verifier-runner.ts`  
- `src/receiptos/challenge/counterfactual-conformance-evaluator.ts`  
- `tests/receiptos/counterfactual-execution-outcome-policy-v0.test.ts` (+ оновлення D/E тестів)

Додано:

- closed CAB contract codes  
- `subject_contract_rejected` outcome  
- mapping typed code → frozen `error_message_contains` token  
- mismatch kinds:
  - `unexpected_subject_contract_rejection`
  - `expected_subject_contract_rejection_missing`
  - `subject_contract_rejection_mismatch`

#### F2. Provenance repair (`7e659514`)

Проблема:

- публічний constructible CAB error + WeakSet дозволяв caller mint  
- shared catch: clone + subject → authentic CAB error з getter під час clone класифікувався як `subject_contract_rejected`

Фікс:

- `CounterfactualAuditBoundaryContractError` **приватний**  
- публічний лише opaque `extractCabContractRejection(thrown) → frozen evidence | null`  
- typed rejection лише з catch навколо реального CAB subject call  
- replay authentic CAB error через clone getter → `execution_failure`

#### F3. Runner stage closure (`a2c63164`) — **поточний HEAD**

Проблема:

- non-CAB adapters клонували input поза try/catch → Promise reject замість `execution_failure`

Фікс для **кожної** surface:

1. binding/validation → `RunnerContractError`  
2. input materialization → `execution_failure` / `input_materialization`  
3. subject invocation → native return / untyped failure / (CAB only) typed rejection  
4. output materialization → `execution_failure` / `output_materialization`

`failure_stage` vocabulary:

```text
input_materialization
subject_invocation
output_materialization
```

**Обмеження reachability:** live output-clone failure наразі практично недосяжний на closed production outputs (вони JSON-cloneable); catch розділений структурно, без invented production throws.

---

## 5. Ключові production файли

| Файл | Роль |
|---|---|
| `src/receiptos/challenge/verifier-challenge-model.ts` | Lane A |
| `src/receiptos/challenge/counterfactual-neighborhood.ts` | Lane B |
| `src/receiptos/challenge/counterfactual-result-normalization.ts` | Lane C |
| `src/receiptos/challenge/counterfactual-verifier-runner.ts` | Lane D + stage closure |
| `src/receiptos/challenge/counterfactual-conformance-evaluator.ts` | Lane E + typed rejection compare |
| `src/receiptos/challenge/counterfactual-audit-boundary.ts` | CAB production + private typed rejection |

### Ключові тести

| Файл | Роль |
|---|---|
| `tests/receiptos/verifier-challenge-model-v0.test.ts` | Lane A |
| `tests/receiptos/counterfactual-neighborhood-identity-v0.test.ts` | Lane B |
| `tests/receiptos/counterfactual-result-normalization-v0.test.ts` | Lane C |
| `tests/receiptos/counterfactual-verifier-runner-v0.test.ts` | Lane D + stage closure |
| `tests/receiptos/counterfactual-conformance-evaluator-v0.test.ts` | Lane E |
| `tests/receiptos/counterfactual-execution-outcome-policy-v0.test.ts` | Lane F / provenance |
| `tests/receiptos/counterfactual-audit-boundary-v0.test.ts` | CAB production binding |
| `tests/receiptos/counterfactual-audit-timestamp-boundary.test.ts` | CAB semantic rejection |

---

## 6. Execution outcomes (після Lane F)

### `subject_returned`

Subject повернув native result (включно з native semantic negatives).

### `subject_contract_rejected`

Лише authentic private CAB contract rejection з subject-stage:

```ts
{
  execution_state: "subject_contract_rejected",
  surface: "counterfactual_audit_boundary",
  rejection: {
    contract: "counterfactual_audit_boundary.semantic_snapshot.v0",
    code: /* closed union */,
    path: /* deterministic semantic path | null */
  }
}
```

Без `native_result`, без raw message/stack.

### `execution_failure`

Нерозпізнаний throw / adapter-stage failure:

```ts
{
  execution_state: "execution_failure",
  surface,
  failure: {
    failure_stage: "input_materialization" | "subject_invocation" | "output_materialization",
    failure_kind: "thrown_error" | "non_error_throw",
    error_name: /* bounded */,
    safe_message: /* bounded, no raw diagnostics */
  }
}
```

### `RunnerContractError`

Кидається **до** валідного execution; ніколи не є member result union.

---

## 7. Lane E comparison (CAB typed rejection)

| Expected | Actual | Result |
|---|---|---|
| frozen CAB `outcome:"rejected"` matching code/path token | `subject_contract_rejected` | evaluated **conformant** |
| rejected expected, wrong code/path | typed rejection | evaluated **nonconformant** (`subject_contract_rejection_mismatch`) |
| accepted/operation expected | typed rejection | evaluated **nonconformant** (`unexpected_subject_contract_rejection`) |
| rejected expected | `subject_returned` operation | evaluated **nonconformant** (`expected_subject_contract_rejection_missing`) |
| any expected | `execution_failure` (будь-який stage) | **execution_unresolved**, `verdict: null` |

Порівняння CAB rejection: closed code → frozen `error_message_contains` token + optional `error_path`.  
**Не** через `Error.message`.

---

## 8. Закріплені digests (мають лишатися без змін)

### Lane B neighborhood

```text
37a213cff7a34e28df165c282f2b9e7460e31fbd37794bf5020c1e91158ed36d
```

### Frozen packages

| Package | Digests |
|---|---|
| CAB | `7503d5cac003a23489f194c5521ef90b01ac0b2ce345a2cec57ad12ffeb274f8` / `db664c5e8da2f0fb6d1d94a036eab572ae2941ffeb5193624365d4bdbaeec24a` |
| verifyHandoff set | `6a4f84a109f633559c7df2e9dd86092e00ce52a81c4a3dcd46c112175748e284` / child `945ec30015490b3d92c01177124be5eddcee18b99308d3aed7701fedff67d326` |
| Chronicle admission set | `dbf062131278b8164373725442e069eb53328729058960b52213dd74b78c83c5` / child `55c8f203255bf97c40ab76255a95db3447bc2dc30ec961fd65f6a39eba12f22a` |
| Chronicle continuity set | `77261f48e3a712536e3cd37f4384c0b62a5063a3c6be7cf14ac648848feea716` / child `4448c728b264cc51d369de7b42430205b9dfdabedb09a282c619e5a42e0d61ac` |
| Chronicle checkpoint-local set | `2c5b171806a253c32495a819d011087c46f4cfb8bad27b0821f6abd280a6ef89` / child `5bcdef8fa4fdb24287e29efb273b4e1998e443047ea1251ec12e3c8097269e28` |

Frozen challenge fixtures **не** змінювались для проходження тестів.

---

## 9. Тестовий baseline

| Момент | Totals |
|---|---|
| Post–Lane E | 851 pass / 0 fail / 4291 expect / 70 files |
| Post–Lane F policy | 862 pass / 0 fail / 4448 expect / 71 files |
| Post–provenance repair | 863 pass / 0 fail / 4457 expect / 71 files |
| **Post–runner stage closure (зараз)** | **864 pass / 0 fail / 4542 expect / 71 files** |

Повний suite: `bun test tests/receiptos`

---

## 10. Поточний worktree

Tracked changes після останнього коміту: **чисто**.

Дозволений untracked noise (не чіпати в цих lanes):

- `docs/paper/_release_candidate/`  
- `release-builds/`  
- локальні `rsf-*.md`  

Цей статус-файл також може бути untracked, доки його окремо не закомітять.

---

## 11. Що робити далі (не стартовано)

Наступний логічний крок **після** parent `a2c63164…` — окрема lane на один із remaining gaps:

1. **expected-result-set SHA256 binding**  
2. **aggregate neighborhood conformance verdict**  
3. **materialized-input derivation from source**  
4. **DCN generator / umbrella package**

Не починати наступну lane в цій сесії, якщо інструкція каже stop.

---

## 12. Швидкі команди для перевірки

```bash
git branch --show-current
git rev-parse HEAD
# очікується: fix/counterfactual-runner-stage-closure-v0
# очікується: a2c63164fcd7272295866fa629629b966164a1e8

bun test tests/receiptos/counterfactual-verifier-runner-v0.test.ts \
         tests/receiptos/counterfactual-conformance-evaluator-v0.test.ts \
         tests/receiptos/counterfactual-execution-outcome-policy-v0.test.ts

bun test tests/receiptos
```

---

## 13. Фінальний статус цього зрізу

```text
COUNTERFACTUAL_CONFORMANCE_V0_LANE_F_RUNNER_STAGE_CLOSURE_PASSED
```

Lane A–F (з repairs) завершені.  
Next parent для наступної роботи: **`a2c63164fcd7272295866fa629629b966164a1e8`**.
