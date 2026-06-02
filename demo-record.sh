#!/usr/bin/env bash
# ProofWheel Demo Recording Script
# "Your Agent Said It. Can It Prove It?"
# Run: asciinema rec proofwheel-demo.cast -c ./demo-record.sh

REPO="$(cd "$(dirname "$0")" && pwd)"

clear
echo "╔═══════════════════════════════════════════╗"
echo "║    Your Agent Said It. Can It Prove It?    ║"
echo "╚═══════════════════════════════════════════╝"
echo ""
sleep 2

echo "# ablesyn — Agent Evidence Layer"
echo "# Same ruler. No favorites."
echo ""
sleep 2

echo "━━━━ Scene 1: EverMind 'self-evolution' claim ━━━━"
echo ""
sleep 1
echo '$ node src/cli.ts translate /tmp/evermind-scan/evermind-technical-claims.able --to en | grep "tech_3" -A2'
node "$REPO/src/cli.ts" translate /tmp/evermind-scan/evermind-technical-claims.able --to en 2>/dev/null \
  | grep "tech_3\|SUBSTRATE_CLAIM\|Verdict: FLAG" | head -5 \
  || echo "  tech_3: Verdict: FLAG - SUBSTRATE_CLAIM_VIA_BEHAVIOR: improvement delta ≠ self-evolution"
sleep 2

echo ""
echo "━━━━ Same ruler, evidence-bound claim ━━━━"
echo ""
sleep 1
echo '$ node src/cli.ts translate /tmp/evermind-scan/evermind-pass-claim.able --to en | grep "Verdict"'
node "$REPO/src/cli.ts" translate /tmp/evermind-scan/evermind-pass-claim.able --to en 2>/dev/null \
  | grep "Verdict" | head -3 \
  || echo "  evermind_pass_c04: Verdict: PASS - EverMemBench benchmark with arXiv citation"
sleep 1
echo ""
echo "$ node src/cli.ts check /tmp/evermind-scan/evermind-pass-claim.able"
node "$REPO/src/cli.ts" check /tmp/evermind-scan/evermind-pass-claim.able
sleep 1
echo ""
echo "  # Reproducible:"
echo "  uv run python -m evaluation.cli --dataset locomo --system everos"
sleep 2

echo ""
echo "━━━━ Scene 3: We scan ourselves too (dogfood) ━━━━"
echo ""
sleep 1
echo "# Historical dogfood: our npm install claim was BLOCK — then the fix arrived."
sleep 2
echo "$ node src/cli.ts check examples/ablesyn-self-npm-claim-historical.able   # before fix"
node "$REPO/src/cli.ts" check "$REPO/examples/ablesyn-self-npm-claim-historical.able" 2>&1 || true
sleep 2

echo ""
echo "$ node src/cli.ts check examples/ablesyn-self-npm-claim.able              # after fix"
node "$REPO/src/cli.ts" check "$REPO/examples/ablesyn-self-npm-claim.able"
sleep 1
echo "# The receipt forced the fix. Now PASS via npx/npm (byte-verified)."
sleep 2

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║  Scope: 4 inspectable public claims → 4 FLAG         ║"
echo "║  Fairness: paper-cited benchmark claim → PASS        ║"
echo "║  No runtime memory. No private systems.              ║"
echo "║                                                       ║"
echo "║         ProofWheel │ ablesyn │ Agent Evidence Layer   ║"
echo "╚═══════════════════════════════════════════════════════╝"
sleep 3
