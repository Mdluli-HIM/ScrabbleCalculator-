import type {
  BuildExperienceInput,
  ExperienceCloseness,
  ExperienceMomentum,
  ExperiencePlayerInput,
  ExperienceRankMovement,
  PublicExperienceEvent,
  PublicExperienceStanding,
  PublicMatchExperience
} from "./experience.types.js";

interface RankedPlayer
  extends ExperiencePlayerInput {
  rank: number;
}

function validateInput(
  input: BuildExperienceInput
): void {
  if (
    !Number.isInteger(
      input.completedTurns
    ) ||
    input.completedTurns < 0
  ) {
    throw new Error(
      "completedTurns must be a non-negative integer."
    );
  }

  const playerIds =
    new Set<string>();

  const turnOrders =
    new Set<number>();

  for (
    const player of input.players
  ) {
    if (
      !player.playerId.trim()
    ) {
      throw new Error(
        "Every player requires an ID."
      );
    }

    if (
      playerIds.has(
        player.playerId
      )
    ) {
      throw new Error(
        "Player IDs must be unique."
      );
    }

    playerIds.add(
      player.playerId
    );

    if (
      !Number.isInteger(
        player.turnOrder
      ) ||
      player.turnOrder < 1
    ) {
      throw new Error(
        "Turn order must be a positive integer."
      );
    }

    if (
      turnOrders.has(
        player.turnOrder
      )
    ) {
      throw new Error(
        "Turn order values must be unique."
      );
    }

    turnOrders.add(
      player.turnOrder
    );

    if (
      !Number.isInteger(
        player.totalPoints
      ) ||
      player.totalPoints < 0
    ) {
      throw new Error(
        "Private totals must be non-negative integers."
      );
    }

    for (
      const points of
        player.recentTurnPoints
    ) {
      if (
        !Number.isInteger(
          points
        ) ||
        points < 0
      ) {
        throw new Error(
          "Recent turn points must be non-negative integers."
        );
      }
    }
  }
}

function rankPlayers(
  players: ExperiencePlayerInput[]
): RankedPlayer[] {
  const ordered =
    [...players].sort(
      (
        left,
        right
      ) =>
        right.totalPoints -
          left.totalPoints ||
        left.turnOrder -
          right.turnOrder
    );

  let currentRank = 0;
  let previousPoints:
    number | null = null;

  return ordered.map(
    (player) => {
      if (
        previousPoints === null ||
        player.totalPoints !==
          previousPoints
      ) {
        currentRank += 1;
        previousPoints =
          player.totalPoints;
      }

      return {
        ...player,
        rank: currentRank
      };
    }
  );
}

function calculateMovement(
  playerId: string,
  rank: number,
  previousRanks:
    Record<string, number> |
    undefined
): ExperienceRankMovement {
  const previousRank =
    previousRanks?.[playerId];

  if (
    previousRank === undefined
  ) {
    return "NEW";
  }

  if (
    rank < previousRank
  ) {
    return "UP";
  }

  if (
    rank > previousRank
  ) {
    return "DOWN";
  }

  return "SAME";
}

function calculateMomentum(
  recentTurnPoints: number[]
): ExperienceMomentum {
  const recent =
    recentTurnPoints.slice(-3);

  if (
    recent.length === 0
  ) {
    return "NEW";
  }

  const latest =
    recent[
      recent.length - 1
    ] ?? 0;

  if (
    recent.length === 1
  ) {
    if (
      latest >= 30
    ) {
      return "SURGING";
    }

    if (
      latest >= 15
    ) {
      return "BUILDING";
    }

    return "STEADY";
  }

  const earlier =
    recent.slice(
      0,
      -1
    );

  const earlierAverage =
    earlier.reduce(
      (
        total,
        points
      ) =>
        total + points,
      0
    ) /
    earlier.length;

  if (
    latest >=
      earlierAverage + 12
  ) {
    return "SURGING";
  }

  if (
    latest >=
      earlierAverage + 4
  ) {
    return "BUILDING";
  }

  if (
    latest <=
      earlierAverage - 10
  ) {
    return "COOLING";
  }

  return "STEADY";
}

function calculateCloseness(
  players: ExperiencePlayerInput[],
  completedTurns: number
): ExperienceCloseness {
  if (
    completedTurns === 0 ||
    players.length < 2
  ) {
    return "UNSET";
  }

  const totals =
    players.map(
      (player) =>
        player.totalPoints
    );

  const spread =
    Math.max(...totals) -
    Math.min(...totals);

  if (
    spread <= 10
  ) {
    return "TIGHT";
  }

  if (
    spread <= 30
  ) {
    return "COMPETITIVE";
  }

  return "OPEN";
}

function addRelatedEvent(
  events:
    PublicExperienceEvent[],
  type:
    PublicExperienceEvent["type"],
  playerId: string,
  relatedPlayerId:
    string | undefined
): void {
  if (
    relatedPlayerId
  ) {
    events.push({
      type,
      playerId,
      relatedPlayerId
    });

    return;
  }

  events.push({
    type,
    playerId
  });
}

export function buildMatchExperience(
  input: BuildExperienceInput
): PublicMatchExperience {
  validateInput(input);

  const rankedPlayers =
    rankPlayers(
      input.players
    );

  const leaderRank =
    rankedPlayers[0]?.rank;

  const leaderPlayers =
    leaderRank === undefined
      ? []
      : rankedPlayers.filter(
          (player) =>
            player.rank ===
            leaderRank
        );

  const leaderIds =
    new Set(
      leaderPlayers.map(
        (player) =>
          player.playerId
      )
    );

  const standings:
    PublicExperienceStanding[] =
      rankedPlayers.map(
        (player) => ({
          playerId:
            player.playerId,
          displayName:
            player.displayName,
          rank:
            player.rank,
          movement:
            calculateMovement(
              player.playerId,
              player.rank,
              input.previous
                ?.ranks
            ),
          momentum:
            calculateMomentum(
              player
                .recentTurnPoints
            ),
          isLeader:
            leaderIds.has(
              player.playerId
            )
        })
      );

  const events:
    PublicExperienceEvent[] =
      [];

  if (
    input.previous
  ) {
    const previousLeaderIds =
      new Set(
        input.previous
          .leaderIds
      );

    if (
      leaderPlayers.length === 1
    ) {
      const currentLeader =
        leaderPlayers[0];

      if (
        currentLeader &&
        input.previous
          .leaderIds.length >
          0 &&
        !previousLeaderIds.has(
          currentLeader.playerId
        )
      ) {
        addRelatedEvent(
          events,
          "LEAD_CHANGE",
          currentLeader.playerId,
          input.previous
            .leaderIds[0]
        );
      }
    } else if (
      leaderPlayers.length > 1
    ) {
      const leadChanged =
        leaderPlayers.some(
          (player) =>
            !previousLeaderIds.has(
              player.playerId
            )
        ) ||
        input.previous
          .leaderIds.length !==
          leaderPlayers.length;

      if (
        leadChanged
      ) {
        const joiningLeader =
          leaderPlayers.find(
            (player) =>
              !previousLeaderIds.has(
                player.playerId
              )
          ) ??
          leaderPlayers[0];

        const relatedLeader =
          leaderPlayers.find(
            (player) =>
              player.playerId !==
              joiningLeader
                ?.playerId
          );

        if (
          joiningLeader
        ) {
          addRelatedEvent(
            events,
            "SHARED_LEAD",
            joiningLeader.playerId,
            relatedLeader?.playerId
          );
        }
      }
    }

    for (
      const standing of
        standings
    ) {
      const previousRank =
        input.previous
          .ranks[
            standing.playerId
          ];

      if (
        standing.movement ===
        "UP"
      ) {
        events.push({
          type:
            "RANK_RISE",
          playerId:
            standing.playerId
        });
      }

      if (
        previousRank !==
          undefined &&
        previousRank >= 3 &&
        standing.rank === 1
      ) {
        events.push({
          type:
            "COMEBACK",
          playerId:
            standing.playerId
        });
      }

      const previousMomentum =
        input.previous
          .momentumByPlayerId[
            standing.playerId
          ];

      if (
        previousMomentum &&
        previousMomentum !==
          standing.momentum &&
        (
          standing.momentum ===
            "SURGING" ||
          standing.momentum ===
            "COOLING"
        )
      ) {
        events.push({
          type:
            "MOMENTUM_SHIFT",
          playerId:
            standing.playerId
        });
      }
    }
  }

  return {
    phase:
      input.completedTurns <
      input.players.length
        ? "OPENING"
        : "ACTIVE",

    leaders:
      leaderPlayers.map(
        (player) => ({
          playerId:
            player.playerId,
          displayName:
            player.displayName
        })
      ),

    hasSharedLead:
      leaderPlayers.length >
      1,

    closeness:
      calculateCloseness(
        input.players,
        input.completedTurns
      ),

    standings,
    events
  };
}
