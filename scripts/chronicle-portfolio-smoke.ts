import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  createChronicleEntryV0,
  createChroniclePortfolioV0,
  createPortableProofObjectV0,
  type HandoffEvidence,
  verifyChroniclePortfolioV0,
  verifyHandoffReceiptRoot,
} from "../src/receiptos"

const fixturePath = resolve(import.meta.dir, "../src/receiptos/fixtures/session-evidence.sample.json")
const evidence = JSON.parse(readFileSync(fixturePath, "utf8")) as HandoffEvidence

const receiptVerification = verifyHandoffReceiptRoot(evidence)
const proofObject = await createPortableProofObjectV0(evidence, {
  sourceEvidenceRef: "fixture://session-evidence.sample.json",
})
const chronicleEntry = createChronicleEntryV0(evidence, proofObject)
const portfolio = createChroniclePortfolioV0(chronicleEntry)
const portfolioVerification = verifyChroniclePortfolioV0(portfolio)

console.log(JSON.stringify({
  import_sample_evidence: true,
  create_portable_proof: true,
  verify_receipt_root: receiptVerification.ok,
  create_chronicle_entry_v0: chronicleEntry.schema === "chronicle_entry.v0",
  create_chronicle_portfolio_v0: portfolio.portfolio_version === "chronicle_portfolio.v0",
  verify_portfolio_root: portfolioVerification.ok,
  export_portfolio_json: true,
  receipt_root: proofObject.receipt_root,
  portfolio_root: portfolio.portfolio_root,
  chronicle_entry_id: chronicleEntry.entry_id,
  portfolio_id: portfolio.portfolio_id,
}, null, 2))
