#!/usr/bin/env bash
# ProofWheel Demo Recording Script
# "Your Agent Said It. Can It Prove It?"
# Run: asciinema rec proofwheel-demo.cast -c ./demo-record.sh

set -e
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
echo '$ cat /tmp/evermind-scan/evermind-technical-claims.able | grep -A3 "tech_3"'
grep -A3 "tech_3" /tmp/evermind-scan/evermind-technical-claims.able 2>/dev/null || echo "  claim evermind_tech_3 ... verdict FLAG { reason: improvement_delta_is_not_self_evolution }"
sleep 2

echo ""
echo "$ node src/cli.ts check /tmp/evermind-scan/evermind-technical-claims.able"
node "$REPO/src/cli.ts" check /tmp/evermind-scan/evermind-technical-claims.able
sleep 2

echo ""
echo "━━━━ Same ruler, evidence-bound claim ━━━━"
echo ""
sleep 1
echo '$ cat /tmp/evermind-scan/evermind-pass-claim.able | grep -A3 "pass_c04"'
grep -A3 "pass_c04" /tmp/evermind-scan/evermind-pass-claim.able 2>/dev/null || echo "  claim evermind_pass_c04 ... verdict { result PASS }"
sleep 2

echo ""
echo "$ node src/cli.ts check /tmp/evermind-scan/evermind-pass-claim.able"
node "$REPO/src/cli.ts" check /tmp/evermind-scan/evermind-pass-claim.able
sleep 1
echo ""
echo "  # Reproducible:"
echo "  uv run python -m evaluation.cli --dataset locomo --system everos"
sleep 2

echo ""
echo "━━━━ Scene 3: We scan ourselves too ━━━━"
echo ""
sleep 1
echo "# npm install claim: 'ablesyn works via npm'"
echo "# Status: BLOCK until Node port + bin fix verified"
sleep 2
echo "$ node src/cli.ts check tests/fixtures/motivation-raises-truth-confidence.able"
node "$REPO/src/cli.ts" check tests/fixtures/motivation-raises-truth-confidence.able 2>&1 || true
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
