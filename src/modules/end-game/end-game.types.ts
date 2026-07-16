export type EndGameReason =
  | "PLAYER_EMPTIED_RACK"
  | "STALEMATE";

export type EndGameScoringErrorCode =
  | "END_GAME_PLAYER_COUNT_INVALID"
  | "END_GAME_PLAYER_ID_INVALID"
  | "END_GAME_PLAYER_ID_DUPLICATE"
  | "END_GAME_DISPLAY_NAME_INVALID"
  | "END_GAME_TURN_ORDER_INVALID"
  | "END_GAME_TURN_ORDER_DUPLICATE"
  | "END_GAME_TOTAL_INVALID"
  | "END_GAME_RACK_TOO_LARGE"
  | "END_GAME_TILE_INVALID"
  | "END_GAME_FINISHER_REQUIRED"
  | "END_GAME_FINISHER_NOT_FOUND"
  | "END_GAME_FINISHER_RACK_NOT_EMPTY"
  | "END_GAME_FINISHER_NOT_ALLOWED";

export interface EndGameRackTileInput {
  letter: string;
  isBlank: boolean;
}

export interface EndGamePlayerInput {
  playerId: string;
  displayName: string;
  turnOrder: number;

  /**
   * The private cumulative score before
   * end-game rack adjustments.
   */
  totalPoints: number;

  rackTiles:
    EndGameRackTileInput[];
}

export interface EndGameCalculationInput {
  reason: EndGameReason;

  players:
    EndGamePlayerInput[];

  /**
   * Required only when a player emptied
   * their rack.
   */
  finishingPlayerId?: string;
}

export interface FinalPlayerReference {
  playerId: string;
  displayName: string;
}

export interface FinalPlayerStanding {
  playerId: string;
  displayName: string;
  turnOrder: number;

  baseScore: number;
  rackTileCount: number;
  rackDeduction: number;
  finishingBonus: number;
  finalScore: number;

  rank: number;
  isWinner: boolean;
}

export interface EndGameCalculationResult {
  reason: EndGameReason;
  finishingPlayerId?: string;

  totalRackDeduction: number;
  hasSharedWin: boolean;

  winners:
    FinalPlayerReference[];

  podium:
    FinalPlayerStanding[];

  standings:
    FinalPlayerStanding[];
}

export class EndGameScoringError
  extends Error {
  readonly code:
    EndGameScoringErrorCode;

  constructor(
    code:
      EndGameScoringErrorCode,
    message: string
  ) {
    super(message);

    this.name =
      "EndGameScoringError";

    this.code = code;
  }
}

export interface PublicRemainingRackTile {
  letter: string;
  isBlank: boolean;
  value: number;
}

export interface PublicFinalStanding
  extends FinalPlayerStanding {
  remainingRack:
    PublicRemainingRackTile[];
}


export interface PublicHighestScoringTurn {
  turnNumber: number;
  points: number;
  playerId: string;
  displayName: string;
}

export interface PublicHighestScoringWord {
  word: string;
  points: number;
  turnNumber: number;
  playerId: string;
  displayName: string;
}

export interface PublicExperienceEventHighlights {
  total: number;
  leadChanges: number;
  sharedLeads: number;
  rankRises: number;
  comebacks: number;
  momentumShifts: number;
}

export interface PublicMatchHighlights {
  totalTurns: number;
  totalWords: number;
  bingoCount: number;

  highestScoringTurn:
    PublicHighestScoringTurn | null;

  highestScoringWord:
    PublicHighestScoringWord | null;

  experienceEvents:
    PublicExperienceEventHighlights;
}

export interface PublicMatchResult {
  matchId: string;
  status: "COMPLETED";
  reason: EndGameReason;
  finishingPlayerId: string | null;
  completedAt: string;

  totalRackDeduction: number;
  hasSharedWin: boolean;

  highlights:
    PublicMatchHighlights;

  winners:
    FinalPlayerReference[];

  podium:
    PublicFinalStanding[];

  standings:
    PublicFinalStanding[];
}
