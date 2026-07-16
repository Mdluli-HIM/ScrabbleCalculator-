export type ExperiencePhase =
  | "OPENING"
  | "ACTIVE";

export type ExperienceCloseness =
  | "UNSET"
  | "TIGHT"
  | "COMPETITIVE"
  | "OPEN";

export type ExperienceRankMovement =
  | "NEW"
  | "UP"
  | "DOWN"
  | "SAME";

export type ExperienceMomentum =
  | "NEW"
  | "SURGING"
  | "BUILDING"
  | "STEADY"
  | "COOLING";

export type ExperienceEventType =
  | "LEAD_CHANGE"
  | "SHARED_LEAD"
  | "RANK_RISE"
  | "COMEBACK"
  | "MOMENTUM_SHIFT";

export interface ExperiencePlayerInput {
  playerId: string;
  displayName: string;
  turnOrder: number;

  /**
   * Private engine input.
   * Never expose this value publicly.
   */
  totalPoints: number;

  /**
   * Private recent-turn input.
   * Never expose these values publicly.
   */
  recentTurnPoints: number[];
}

export interface PreviousExperienceState {
  ranks: Record<string, number>;
  leaderIds: string[];
  momentumByPlayerId:
    Partial<
      Record<
        string,
        ExperienceMomentum
      >
    >;
}

export interface BuildExperienceInput {
  players: ExperiencePlayerInput[];
  completedTurns: number;
  previous?: PreviousExperienceState;
}

export interface PublicExperienceLeader {
  playerId: string;
  displayName: string;
}

export interface PublicExperienceStanding {
  playerId: string;
  displayName: string;
  rank: number;
  movement: ExperienceRankMovement;
  momentum: ExperienceMomentum;
  isLeader: boolean;
}

export interface PublicExperienceEvent {
  type: ExperienceEventType;
  playerId: string;
  relatedPlayerId?: string;
}

export interface PublicMatchExperience {
  phase: ExperiencePhase;
  leaders: PublicExperienceLeader[];
  hasSharedLead: boolean;
  closeness: ExperienceCloseness;
  standings: PublicExperienceStanding[];
  events: PublicExperienceEvent[];
}
