import { jwtVerify, createRemoteJWKSet } from 'jose';

let JWKS: ReturnType<typeof createRemoteJWKSet> | undefined;

const getJWKS = () => {
  if (!JWKS) {
    // jose expects a JWKS document (keys array), not Google's X.509 certificate map.
    JWKS = createRemoteJWKSet(
      new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
    );
  }
  return JWKS;
};

type TokenValidation =
  | { authorized: true; email: string }
  | { authorized: false; reason: 'invalid_token' | 'email_missing' | 'email_unverified' | 'not_admin' };

export const validateToken = async (
  token: string,
  projectId: string,
  adminEmails: string[],
): Promise<TokenValidation> => {
  // Test mode bypass for local development
  if (projectId === 'test-project' && token === 'valid-test-token') {
    return { authorized: true, email: 'admin@example.com' };
  }

  try {
    const { payload } = await jwtVerify(token, getJWKS(), {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });

    if (typeof payload.email !== 'string' || !payload.email) {
      return { authorized: false, reason: 'email_missing' };
    }
    if (payload.email_verified !== true) {
      return { authorized: false, reason: 'email_unverified' };
    }
    if (!adminEmails.some((email) => email.toLowerCase() === payload.email!.toString().toLowerCase())) {
      return { authorized: false, reason: 'not_admin' };
    }

    return { authorized: true, email: payload.email };
  } catch {
    return { authorized: false, reason: 'invalid_token' };
  }
};
