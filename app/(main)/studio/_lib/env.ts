export function getMaxTokens(): number {
  const val = process.env.AGENTHOOD_MAX_TOKENS;
  if (val) {
    const n = parseInt(val, 10);
    if (!isNaN(n) && n > 0) return n;
  }
  return 4096;
}
