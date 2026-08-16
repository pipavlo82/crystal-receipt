/**
 * TEST-ONLY synthetic provider injection for the independent-authority scaffold.
 *
 * THIS MODULE IS NOT A PRODUCTION PROVIDER AND NOT AN EXTERNAL TRUST ROOT.
 * It exists solely so unit tests can exercise the VALID_PROVENANCE branch
 * of the classifier. Outcomes from this module:
 *   - MUST set injection_kind to "synthetic_test_only"
 *   - MUST be issued through injectSyntheticVerifiedProvenance before the
 *     test-only evaluator will treat them as verified observations
 *   - MUST NOT be serialized or published as production grounding evidence
 *   - MUST NOT be confused with a declared external provider verifier
 *
 * There is no production verifier in this lane. Do not import this module
 * from production evaluation paths. A caller-shaped
 * { injection_kind: "synthetic_test_only" } object is not issued and cannot
 * mint VALID_PROVENANCE on the production evaluator.
 */

import type { ProviderVerificationOutcome, VerifiedPublicationObservations } from "./independent-authority-model"
import { issueSyntheticTestProvenance } from "./independent-authority"

const SYNTHETIC_KIND = "synthetic_test_only" as const

export function injectSyntheticVerifiedProvenance(
  observations: VerifiedPublicationObservations,
): ProviderVerificationOutcome {
  const outcome: ProviderVerificationOutcome = {
    ok: true,
    injection_kind: SYNTHETIC_KIND,
    observations: {
      ...observations,
      provider_id: observations.provider_id,
      trust_root_id: "synthetic-test-only.not-a-trust-root",
    },
  }
  issueSyntheticTestProvenance(outcome)
  return outcome
}

export { evaluateSyntheticIndependentGrounding } from "./independent-authority"

export const SYNTHETIC_TEST_PUBLISHER = "synthetic-test-publisher.not-production"
