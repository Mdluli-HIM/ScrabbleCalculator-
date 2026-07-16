# Sprint 5 Postman Verification

## Files

Collection:

    postman/ScrabbleCalculator-Sprint-5.postman_collection.json

Environment:

    postman/ScrabbleCalculator-Local.postman_environment.json

## Prerequisites

- PostgreSQL is running.
- Prisma migrations are applied.
- The local dictionary is seeded.
- The API is running on `http://localhost:5050`.

## Run from Terminal

    npx newman run \
      postman/ScrabbleCalculator-Sprint-5.postman_collection.json \
      -e postman/ScrabbleCalculator-Local.postman_environment.json

## Sprint 5 flow

The collection retains all Sprint 4 verification and adds a dedicated hidden-score experience group.

The new registered-user flow verifies:

1. Experience owner registration
2. Match creation
3. Registered player creation
4. Local opponent creation
5. Match start
6. First turn submission
7. Opening experience retrieval
8. Second turn submission
9. Active experience retrieval
10. Historical idempotent replay

The guest flow verifies:

1. Guest session creation
2. Two guest players
3. Guest match creation
4. Both guest players added to the match
5. Guest match start
6. Guest turn submission
7. Guest experience retrieval

## Privacy assertions

The Sprint 5 requests recursively inspect public experience responses and reject forbidden fields including:

- `totalPoints`
- `recentTurnPoints`
- `scoreGap`
- `pointsBehind`
- `cumulativePoints`
- `privateTotal`
- `exactTotal`

## Historical replay assertion

After two registered turns, the collection replays turn one using the original idempotency key.

The replay must:

- Return HTTP 200
- Set `replayed` to `true`
- Return turn number one
- Return the original turn-one experience snapshot
- Not return the current turn-two experience state
