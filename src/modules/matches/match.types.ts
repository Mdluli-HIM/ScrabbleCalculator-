export type MatchStatusValue =
  | "DRAFT"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type DictionaryPolicyValue =
  | "LOCAL_WORD_LIST"
  | "OXFORD_ONLY"
  | "TOURNAMENT_LEXICON_ONLY"
  | "BOTH_REQUIRED"
  | "EITHER_ACCEPTED";

export type MatchOwnerTypeValue =
  | "REGISTERED_USER"
  | "GUEST_SESSION";

export type MatchPlayerSourceValue =
  | "REGISTERED_USER"
  | "GUEST_PLAYER"
  | "LOCAL";

export type MatchActor =
  | {
      type: "REGISTERED_USER";
      userId: string;
      sessionId: string;
    }
  | {
      type: "GUEST_SESSION";
      guestSessionId: string;
      expiresAt: string;
    };

export interface PublicDictionaryLexicon {
  code: string;
  version: string;
  name: string;
}

export interface PublicMatchPlayer {
  id: string;
  source: MatchPlayerSourceValue;
  registeredUserId: string | null;
  guestPlayerId: string | null;
  displayName: string;
  seatNumber: number;
  turnOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublicMatch {
  id: string;
  name: string | null;
  status: MatchStatusValue;
  dictionaryPolicy: DictionaryPolicyValue;
  dictionaryLexicon:
    PublicDictionaryLexicon | null;
  ownerType: MatchOwnerTypeValue;
  currentTurnOrder: number | null;
  currentPlayer: PublicMatchPlayer | null;
  playerCount: number;
  canEdit: boolean;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  players: PublicMatchPlayer[];
}
