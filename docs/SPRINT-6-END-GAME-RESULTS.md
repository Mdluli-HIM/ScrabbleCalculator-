# Sprint 6 — End-Game Results

## Release

API version: `0.7.0`

## Objective

Sprint 6 completes the physical Scrabble match lifecycle.

Exact cumulative scores remain private while a match is active. Once the
owner explicitly completes the match, the API applies end-game rack
adjustments, stores an immutable final result, marks the match as completed,
and reveals exact scores.

## Supported completion reasons

### PLAYER_EMPTIED_RACK

Use this reason when a player empties their rack at the end of the game.

Rules:

- The finishing player's remaining rack must be empty.
- Every opponent loses the value of tir remaining rack.
- The finishing player receives the combined value deducted from opponents.
- Blank tiles are worth zero.

### STALEMATE

Use this reason when the game ends without a player emptying their rack.

Rules:

- Every player loses the value of their own remaining rack.
- No finishing-player bonus is awarded.
- A finishing player must not be supplied.

## Completion endpoint

    POST /api/v1/matches/:matchId/complete

The request requires registered-user or guest-session ownership.

Example:

    {
      "reason": "PLAYER_EMPTIED_RACK",
      "finishingPlayerId": "match-player-id",
      "players": [
        {
          "playerId": "match-player-id",
          "rackTiles": []
        },
        {
          "playerId": "opponent-player-id",
          "rackTiles": [
            {
              "letter": "Q",
              "isBlank": false
            },
            {
              "letter": "I",
              "isBlank": false
            }
          ]
        }
      ]
    }

The request must contain every player in the match exactly once.

Completion is performed inside a serializable database transaction. The match
transition and every final-result record either succeed together or roll back
together.

## Result endpoint

    GET /api/v1/matches/:matchId/results

Exact results are only available after successful completion.

An active match returns:

    MATCH_RESULT_NOT_AVAILABLE

Another user's or guest session's match remains hidden behind:

    MATCH_NOT_FOUND

## Final result fields

The result contains:

- completion reason;
- completion timestamp;
- finishing player, when applicable;
- exact base scores;
- rack deductions;
- finishing bonus;
- exact final scores;
- dense rankings;
- winner or tied winners;
- podium standings;
- remaining rack tiles and their values;
- stored post-match highlights.

## Highlights

Highlights are calculated from immutable server-side records:

- total accepted turns;
- total formed words;
- bingo count;
- highest-scoring turn;
- highest-scoring word;
- lead-change count;
- shared-lead count;
- rank-rise count;
- comeback count;
- momentum-shift count.

The completion response and later `GET /results` response are generated from
the same stored records.

## Privacy

Before completion, public match and experience responses must not expose:

- cumulative points;
- base scores;
- final scores;
- rack deductions;
- finishing bonuses;
- highest-scoring turn;
- highest-scoring word.

## Persistence

Sprint 6 adds:

- `MatchResult`
- `MatchPlayerResult`
- `MatchRemainingRackTile`

Migration:

    20260716141432_add_end_game_results

## Verification

The automated suite contains 100 passing tests, including:

- pure end-game calculation;
- registered completion;
- guest completion;
- exact result retrieval;
- ownership enforcement;
- active-match privacy;
- repeated completion protection;
- transaction rollback;
- immutable highlights.
