# ScrabbleCalculator API Contract

## Base URL

Local development:

    http://localhost:5050

## Versioned API prefix

    /api/v1

## Success response

A successful response follows this structure:

    {
      "success": true,
      "message": "Human-readable message.",
      "data": {},
      "meta": {
        "requestId": "uuid",
        "timestamp": "ISO-8601 timestamp"
      }
    }

## Error response

An unsuccessful response follows this structure:

    {
      "success": false,
      "message": "Human-readable error message.",
      "error": {
        "code": "MACHINE_READABLE_CODE",
        "details": {}
      },
      "meta": {
        "requestId": "uuid",
        "timestamp": "ISO-8601 timestamp"
      }
    }

The details property is optional.

## Sprint 0 endpoints

    GET /
    GET /api/v1/health
    GET /api/v1/health/database

## Request IDs

Every response includes an x-request-id response header.

A client may provide an x-request-id request header. When it is not supplied,
the API generates a UUID.

## Sprint 4 turn endpoint

    POST /api/v1/matches/:matchId/turns

The endpoint requires registered or guest match ownership.

Every request requires an `Idempotency-Key` header.

A new valid turn returns HTTP `201`.

An identical replay returns HTTP `200` with `data.replayed: true`.

Invalid words return HTTP `422` with code `TURN_WORDS_INVALID`.

The response reveals the current turn points but not cumulative totals.

## Sprint 5 hidden-score experience

    GET /api/v1/matches/:matchId/experience

The endpoint requires registered or guest match ownership.

The response exposes categorical match experience data without exposing exact cumulative totals.

A successful turn response from:

    POST /api/v1/matches/:matchId/turns

now includes `data.experience`.

Experience fields include:

- `phase`
- `leaders`
- `hasSharedLead`
- `closeness`
- `standings`
- `events`

Standing fields include:

- `playerId`
- `displayName`
- `rank`
- `movement`
- `momentum`
- `isLeader`

The active-match experience response must not contain:

- `totalPoints`
- `recentTurnPoints`
- `scoreGap`
- `pointsBehind`
- `cumulativePoints`

An idempotent turn replay returns the immutable experience snapshot associated with the original turn.

## Sprint 6 end-game completion and results

### Complete an active match

    POST /api/v1/matches/:matchId/complete

The endpoint requires registered-user or guest-session ownership.

Supported reasons:

- `PLAYER_EMPTIED_RACK`
- `STALEMATE`

The request must provide every match player exactly once together with the
player's remaining rack tiles.

For `PLAYER_EMPTIED_RACK`, `finishingPlayerId` is required and that player's
rack must be empty.

For `STALEMATE`, `finishingPlayerId` is not allowed.

A successful completion:

- applies rack deductions;
- applies a finishing bonus when applicable;
- stores immutable final-result records;
- changes the match to `COMPLETED`;
- sets `currentTurnOrder` to `null`;
- reveals exact final scores;
- returns stored post-match highlights.

Possible completion errors include:

- `MATCH_NOT_FOUND`
- `MATCH_NOT_COMPLETABLE`
- `MATCH_ALREADY_COMPLETED`
- `MATCH_COMPLETION_CONFLICT`
- `END_GAME_PLAYER_ROSTER_INVALID`
- `END_GAME_FINISHER_REQUIRED`
- `END_GAME_FINISHER_NOT_FOUND`
- `END_GAME_FINISHER_RACK_NOT_EMPTY`
- `END_GAME_FINISHER_NOT_ALLOWED`

### Retrieve exact completed results

    GET /api/v1/matches/:matchId/results

The endpoint requires registered-user or guest-session ownership.

An active or draft match returns HTTP `409` with:

    MATCH_RESULT_NOT_AVAILABLE

A completed match returns exact scores, standings, winners, remaining rack
tiles, podium data, and stored highlights.

Exact result data is never returned for an active match.
