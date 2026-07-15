export interface PublicGuestPlayer {
  id: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicGuestSession {
  id: string;
  expiresAt: string;
  claimed: boolean;
  claimedAt: string | null;
  createdAt: string;
  updatedAt: string;
  players: PublicGuestPlayer[];
}

export interface GuestSessionContext {
  sessionId: string;
  expiresAt: Date;
}

export interface CreatedGuestSession {
  guestSessionToken: string;
  tokenType: "GuestSession";
  expiresAt: string;
  session: PublicGuestSession;
}
