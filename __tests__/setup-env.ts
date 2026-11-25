// Production fails closed when CAPTCHA is enabled but misconfigured.
// Unit tests that are not about CAPTCHA keep the former fail-open default.
process.env.TURNSTILE_REQUIRED ||= 'false'
