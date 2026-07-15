export interface PublicGuestPlayer {
  id: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicGuestSession {
  id: string;
  expiresAt: string;
  claimedAt: string | null;
  claimedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  players: PublicGuestPlayer[];
}

export interface GuestSessionContext {
  guestSessionId: string;
  expiresAt: string;
}

export interface GuestSessionCreationResult {
  guestSessionToken: string;
  guestSession: PublicGuestSession;
}
