# Sprint 4: Score Calculator and Turn Submission

## Status

Complete.

API version: `0.5.0`

## Endpoint

`POST /api/v1/matches/:matchId/turns`

Registered requests use `Authorization: Bearer <access-token>`.

Guest requests use `x-guest-session-token: <guest-session-token>`.

Every request requires an `Idempotency-Key` containing 8 to 120 characters.

## Scoring support

- Standard English tile values
- Blank tiles worth zero points
- Double-letter and triple-letter premiums
- Double-word and triple-word premiums
- Cross-word scoring
- Multiple words per turn
- Fifty-point seven-tile bonus
- Replacement tile count

## Turn processing

A valid turn is scored, stored, added to the private cumulative total, and advances the current player.

Invalid dictionary words receive no points and do not advance the match.

Identical idempotent retries return the original turn without adding points twice.

## Hidden scoring

The submitted turn score is returned, but cumulative player totals remain private while the match is active.

## Verification

- Test files: 9 passed
- Tests: 52 passed
- Turn endpoint tests: 12 passed
- Pure scoring tests: 9 passed
- ESLint: passed
- TypeScript build: passed
- Prisma validation: passed
