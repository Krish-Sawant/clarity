import { test } from "node:test";
import assert from "node:assert/strict";
import { authConfiguration } from "../../../authentication/config.ts";

test("missing Auth0 configuration fails closed", () => {
  const config = authConfiguration({});
  assert.equal(config.configured, false);
  assert.ok(config.missing.includes("AUTH0_SECRET"));
  assert.ok(config.missing.includes("AUTH0_AUDIENCE"));
});

test("Auth0 uses the API audience and disables browser access tokens", () => {
  const config = authConfiguration({
    AUTH0_DOMAIN: "test.auth0.com", AUTH0_CLIENT_ID: "client", AUTH0_CLIENT_SECRET: "private",
    AUTH0_SECRET: "a".repeat(64), APP_BASE_URL: "http://127.0.0.1:3001", AUTH0_AUDIENCE: "https://clarity-api",
  });
  assert.equal(config.configured, true);
  assert.equal(config.options.authorizationParameters.audience, "https://clarity-api");
  assert.equal(config.options.enableAccessTokenEndpoint, false);
});
