export type TilePremium =
  | "NONE"
  | "DOUBLE_LETTER"
  | "TRIPLE_LETTER"
  | "DOUBLE_WORD"
  | "TRIPLE_WORD";

export interface ScoringPlacedTile {
  id: string;
  letter: string;
  isBlank: boolean;
  premium: TilePremium;
}

export type ScoringWordTile =
  | {
      source: "PLACED";
      placedTileId: string;
    }
  | {
      source: "EXISTING";
      letter: string;
      isBlank: boolean;
    };

export interface ScoringWordInput {
  tiles: ScoringWordTile[];
}

export interface CalculateTurnScoreInput {
  placedTiles: ScoringPlacedTile[];
  words: ScoringWordInput[];
}

export interface ScoredTurnWord {
  word: string;
  letterPoints: number;
  wordMultiplier: number;
  points: number;
}

export interface TurnScoreResult {
  placedTileCount: number;
  replacementTileCount: number;
  wordPoints: number;
  bingoBonus: number;
  totalPoints: number;
  words: ScoredTurnWord[];
}

export type TurnScoringErrorCode =
  | "INVALID_PLACED_TILE_COUNT"
  | "TURN_WORDS_REQUIRED"
  | "INVALID_TILE_ID"
  | "DUPLICATE_PLACED_TILE_ID"
  | "INVALID_TILE_LETTER"
  | "TURN_WORD_EMPTY"
  | "UNKNOWN_PLACED_TILE"
  | "DUPLICATE_PLACED_TILE_REFERENCE"
  | "WORD_MUST_USE_PLACED_TILE"
  | "UNUSED_PLACED_TILE";

export class TurnScoringError extends Error {
  public readonly code:
    TurnScoringErrorCode;

  public constructor(
    message: string,
    code: TurnScoringErrorCode
  ) {
    super(message);
    this.name = "TurnScoringError";
    this.code = code;
  }
}
