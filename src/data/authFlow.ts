import type { Key } from "../i18n";
export type AuthCallback = {
  purpose: "recovery" | "invite" | null;
  hasError: boolean;
};
// Capture intent and error flags only. Tokens stay exclusively in the Supabase SDK.
export function inspectAuthCallback(href: string): AuthCallback {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const type = hash.get("type") || url.searchParams.get("auth");
  return {
    purpose: type === "recovery" || type === "invite" ? type : null,
    hasError:
      hash.has("error") ||
      hash.has("error_code") ||
      url.searchParams.has("error") ||
      url.searchParams.has("error_code"),
  };
}
export function buildAuthRedirect(
  purpose: "recovery" | "invite",
  origin: string,
  base = "/",
) {
  const url = new URL(origin);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  return `${local ? url.origin + base : "https://brunbar.fi/"}?auth=${purpose}`;
}
// Only classify known codes/statuses. Never render provider messages, email addresses or tokens.
export function recoveryErrorKey(
  error: unknown,
  operation: "request" | "update",
): Key {
  const e =
    error && typeof error === "object"
      ? (error as { code?: string; status?: number; name?: string })
      : {};
  if (
    ["over_email_send_rate_limit", "over_request_rate_limit"].includes(
      e.code || "",
    ) ||
    e.status === 429
  )
    return "recoveryRateLimit";
  if (e.code === "email_address_not_authorized")
    return "recoveryMailRestricted";
  if (e.code === "email_provider_disabled") return "recoveryEmailDisabled";
  if (e.code === "captcha_failed") return "recoveryCaptcha";
  if (
    ["otp_expired", "session_not_found", "session_expired", "bad_jwt"].includes(
      e.code || "",
    ) ||
    e.name === "AuthSessionMissingError"
  )
    return "recoveryLinkInvalid";
  if (["weak_password", "same_password"].includes(e.code || ""))
    return "passwordPolicyError";
  if (e.status && e.status >= 500) return "recoveryServiceError";
  return operation === "request"
    ? "recoveryRequestError"
    : "passwordUpdateError";
}
