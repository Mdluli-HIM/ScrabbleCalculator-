# Sprint 2: Match Setup

## Status

Complete.

API version: `0.3.0`

## Objective

Sprint 2 introduces the complete setup workflow required before Scrabble scoring can begin.

The API now supports registered users and temporary guest sessions as match owners.

## Match lifecycle

- `DRAFT`
- `IN_PROGRESS`
- `COMPLETED`
- `CANCELLED`

Supported transitions:

- `DRAFT` to `IN_PROGRESS`
- `DRAFT` to `CANCELLED`
- `IN_PROGRESS` to `COMPLETED`
- `IN_PROGRESS` to `CANCELLED`

Only draft matches can be edited.

## Match owners

A match has exactly one owner:

- `REGISTERED_USER`
- `GUEST_SESSION`

Database constraints prevent a match from having both owner types or no valid owner.

## Dictionary policies

Each match selects one dictionary policy:

- `OXFORD_ONLY`
- `TOURNAMENT_LEXICON_ONLY`
- `BOTH_REQUIRED`
- `EITHER_ACCEPTED`

The policy can be changed while the match is a draft.

After the match starts, the selected policy becomes immutable.

## Player sources

A match player can originate from:

- `REGISTERED_USER`
- `GUEST_PLAYER`
- `LOCAL`

A registered user can add their own registered identity or local/manual players.

A guest match can add guest players belonging to the owning guest session or local/manual players.

Guest players from another guest session are rejected.

## Player limits

A Scrabble match requires:

- Minimum: 2 players before starting
- Maximum: 4 players

The API prevents:

- Duplicate normalized player names
- Duplicate registered identities
- Duplicate guest identities
- Duplicate seat numbers
- Duplicate turn-order positions
- Incomplete player order
- More than four players

## Match ordering

Each player has:

- `seatNumber`
- `turnOrder`

The seat order controls physical/player display order.

The turn order controls gameplay order.

When a player is removed from a draft, seat and turn positions are restored to a continuous sequence.

## Starting a match

A match can start when:

- It is still a draft
- It contains between two and four players
- Seat numbers form a complete sequence
- Turn-order positions form a complete sequence

Starting a match sets:

- Status to `IN_PROGRESS`
- `startedAt`
- `currentTurnOrder` to `1`
- `currentPlayer` to the player with turn order `1`

## Cancelling a match

Draft and active matches can be cancelled.

Cancelling sets:

- Status to `CANCELLED`
- `cancelledAt`
- `currentTurnOrder` to `null`
- `currentPlayer` to `null`

Completed and already-cancelled matches cannot be cancelled.

## Guest-session claiming

When a guest session is claimed:

1. The guest session is connected to the registered user.
2. Every match owned by that guest session is transferred to the registered user.
3. The old guest token becomes inactive.
4. The registered user can retrieve and continue those matches.

The ownership transfer occurs inside the same database transaction as the guest-session claim.

## Security and privacy

Match endpoints require exactly one actor:

- Bearer access token
- Guest-session token

Supplying both is rejected.

Matches are filtered by owner at database-query level.

A user or guest session cannot retrieve another owner's match.

Unauthorized match retrieval returns `MATCH_NOT_FOUND` rather than exposing whether the match exists.

Current match responses do not contain scores or hidden cumulative totals.

## Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/matches` | Create a draft match |
| GET | `/api/v1/matches` | List owned matches |
| GET | `/api/v1/matches/:matchId` | Retrieve an owned match |
| PATCH | `/api/v1/matches/:matchId` | Update a draft match |
| POST | `/api/v1/matches/:matchId/players` | Add a player |
| PUT | `/api/v1/matches/:matchId/players/order` | Set seat and turn order |
| DELETE | `/api/v1/matches/:matchId/players/:playerId` | Remove a player |
| POST | `/api/v1/matches/:matchId/start` | Start a match |
| POST | `/api/v1/matches/:matchId/cancel` | Cancel a match |

## Database models

Sprint 2 introduced:

- `Match`
- `MatchPlayer`
- `MatchStatus`
- `DictionaryPolicy`
- `MatchOwnerType`
- `MatchPlayerSource`

## Database constraints

- `matches_owner_reference_check`
- `matches_current_turn_order_check`
- `match_players_source_reference_check`
- `match_players_seat_number_check`
- `match_players_turn_order_check`

Additional unique constraints protect:

- Match player names
- Seat numbers
- Turn-order positions

## Automated verification

Current result:

- Test files: 5 passed
- Tests: 23 passed
- ESLint: passed
- TypeScript build: passed
- Prisma schema validation: passed
- Database migration: applied
