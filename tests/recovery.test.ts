import { describe, it, expect } from "vitest";
import {
  inspectAuthCallback,
  buildAuthRedirect,
  recoveryErrorKey,
} from "../src/data/authFlow";
describe("canonical password recovery redirects", () => {
  it("always uses the production root for deployed sites", () => {
    for (const origin of [
      "https://brunbar.fi",
      "https://www.brunbar.fi",
      "https://example.github.io",
    ])
      expect(buildAuthRedirect("recovery", origin, "/wrong/")).toBe(
        "https://brunbar.fi/?auth=recovery",
      );
  });
  it("keeps explicit local development redirects", () =>
    expect(buildAuthRedirect("recovery", "http://localhost:5173")).toBe(
      "http://localhost:5173/?auth=recovery",
    ));
  it("recognizes dashboard implicit callbacks without auth query and never retains tokens", () =>
    expect(
      inspectAuthCallback(
        "https://brunbar.fi/#access_token=test-secret&refresh_token=test-refresh&type=recovery",
      ),
    ).toEqual({ purpose: "recovery", hasError: false }));
  it("recognizes expired callbacks without echoing error descriptions", () =>
    expect(
      inspectAuthCallback(
        "https://brunbar.fi/?auth=recovery#error=access_denied&error_code=otp_expired&error_description=private",
      ),
    ).toEqual({ purpose: "recovery", hasError: true }));
  it("does not treat arbitrary auth parameters as recovery", () =>
    expect(inspectAuthCallback("https://brunbar.fi/?auth=anything")).toEqual({
      purpose: null,
      hasError: false,
    }));
});
describe("safe recovery diagnostics", () => {
  it.each([
    ["over_email_send_rate_limit", 429, "recoveryRateLimit"],
    ["email_address_not_authorized", 403, "recoveryMailRestricted"],
    ["email_provider_disabled", 400, "recoveryEmailDisabled"],
    ["captcha_failed", 400, "recoveryCaptcha"],
    ["unexpected_failure", 500, "recoveryServiceError"],
    ["otp_expired", 403, "recoveryLinkInvalid"],
    ["weak_password", 422, "passwordPolicyError"],
  ])("classifies %s without raw provider details", (code, status, key) =>
    expect(
      recoveryErrorKey(
        { code, status, message: "do not render this secret" },
        "request",
      ),
    ).toBe(key),
  );
  it("keeps unknown errors operation-specific", () => {
    expect(recoveryErrorKey(new Error("private"), "request")).toBe(
      "recoveryRequestError",
    );
    expect(recoveryErrorKey(new Error("private"), "update")).toBe(
      "passwordUpdateError",
    );
  });
});
