import type {
  PublicMatchExperience
} from "../experience/experience.types.js";

export interface PublicTurnPlayer {
  id: string;
  displayName: string;
  turnOrder: number;
}

export interface PublicTurnWord {
  wordOrder: number;
  word: string;
  letterPoints: number;
  wordMultiplier: number;
  points: number;
}

export interface PublicTurn {
  id: string;
  matchId: string;
  turnNumber: number;
  player: PublicTurnPlayer;
  wordPoints: number;
  bingoBonus: number;
  points: number;
  placedTileCount: number;
  replacementTileCount: number;
  words: PublicTurnWord[];
  createdAt: string;
}

export interface SubmitTurnResult {
  turn: PublicTurn;
  nextPlayer: PublicTurnPlayer;
  replayed: boolean;
  experience: PublicMatchExperience;
}
