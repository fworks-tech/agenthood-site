export const MEMBERS = [
  "the-architect", "the-auditor", "the-builder", "the-debugger", "the-doorman",
  "the-envoy", "the-herald", "the-inspector", "the-librarian", "the-mailman",
  "the-operator", "the-oracle", "the-reviewer", "the-scribe", "the-sentinel",
  "the-steward", "the-strategist", "the-tester", "the-warden",
  "the-mediator",
];

// agenthood 4.0 renamed skills/<the-x>/ to skills/<x>/ and dropped the prefix
// from registry ids. The site keeps the-* as its canonical ids, so normalize
// at both boundaries instead of renaming every consumer.
export function skillDir(member) {
  return member.replace(/^the-/, "");
}

export function siteMemberId(name) {
  return name.startsWith("the-") ? name : `the-${name}`;
}
