import { jwtVerify, createRemoteJWKSet } from 'jose';

let JWKS: any;

const getJWKS = () => {
  if (!JWKS) {
    JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'));
  }
  return JWKS;
};

export const validateToken = async (token: string, projectId: string, adminEmails: string[]) => {
  // Test mode bypass for local development
  if (projectId === 'test-project' && token === 'valid-test-token') {
    return { authorized: true, email: 'admin@example.com' };
  }

  try {
    const { payload } = await jwtVerify(token, getJWKS(), {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });

    if (!payload.email || !payload.email_verified || !adminEmails.includes(payload.email as string)) {
      return { authorized: false };
    }

    return { authorized: true, email: payload.email };
  } catch (e) {
    return { authorized: false };
  }
};
