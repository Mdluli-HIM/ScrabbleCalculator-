# Sprint 6 Postman Collection

## Files

Collection:

    postman/ScrabbleCalculator-Sprint-6.postman_collection.json

Environment:

    postman/ScrabbleCalculator-Local.postman_environment.json

## Coverage

The Sprint 6 folder verifies:

- registered match creation;
- registered and local players;
- active-result privacy;
- accepted turns;
- player-emptied-rack completion;
- rack deduction and finishing bonus;
- exact score reveal;
- stored post-match highlights;
- completed result retrieval;
- immutable completion and retrieval responses;
- repeated completion rejection;
- guest session creation;
- guest players and guest-owned match;
- guest stalemate completion;
- tied winners;
- neutral highlights for a match without turns;
- guest result retrieval.

## Local execution

Start PostgreSQL:

    docker compose up -d db

Apply migrations:

    npx prisma migrate deploy

Seed the local dictionary:

    npm run dictionary:seed

Build and start the API:

    npm run build
    npm start

Run Newman from a separate terminal:

    npx newman run \
      postman/ScrabbleCalculator-Sprint-6.postman_collection.json \
      -e postman/ScrabbleCalculator-Local.postman_environment.json

## Expected behaviour

The collection must complete without failed requests, failed tests, or failed
assertions.

Exact score fields must be rejected before match completion and returned only
after a successful completion transaction.
