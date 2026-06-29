// @refresh reload

import { render } from "solid-js/web"
import { ProofHome } from "../../../app/src/proof-home"
import "./styles.css"

const root = document.getElementById("root")
if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error("Desktop renderer root not found")
}

if (root instanceof HTMLElement) {
  render(() => <ProofHome />, root)
}
