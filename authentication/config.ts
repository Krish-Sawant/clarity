/** Shared, server-only Auth0 configuration. No browser environment variables. */
export function authConfiguration(env: Record<string, string | undefined>) {
  const required = ["AUTH0_DOMAIN", "AUTH0_CLIENT_ID", "AUTH0_CLIENT_SECRET", "AUTH0_SECRET", "APP_BASE_URL", "AUTH0_AUDIENCE"];
  const missing = required.filter((key) => !env[key]?.trim());
  return {
    configured: missing.length === 0,
    missing,
    options: {
      domain: env.AUTH0_DOMAIN,
      clientId: env.AUTH0_CLIENT_ID,
      clientSecret: env.AUTH0_CLIENT_SECRET,
      secret: env.AUTH0_SECRET,
      appBaseUrl: env.APP_BASE_URL,
      authorizationParameters: { scope: "openid profile email", audience: env.AUTH0_AUDIENCE },
      // Access tokens are used only by server-side API adapters.
      enableAccessTokenEndpoint: false,
    },
  };
}
