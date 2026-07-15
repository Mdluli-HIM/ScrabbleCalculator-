export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  status: "ACTIVE" | "DISABLED";
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccessTokenClaims {
  userId: string;
  sessionId: string;
}

export interface AuthenticationContext {
  userId: string;
  sessionId: string;
  user: PublicUser;
}

export interface AuthenticationTokens {
  accessToken: string;
  accessTokenType: "Bearer";
  accessTokenExpiresInSeconds: number;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export interface AuthenticationResult {
  user: PublicUser;
  tokens: AuthenticationTokens;
}
