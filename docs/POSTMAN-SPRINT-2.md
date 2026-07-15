# Sprint 2 Postman Workflow

## Files

Import:

- `postman/ScrabbleCalculator-Local.postman_environment.json`
- `postman/ScrabbleCalculator-Sprint-2.postman_collection.json`

## Requirements

The API must be running at:

`http://localhost:5050`

Start it with:

`npm run dev`

Select the environment:

`ScrabbleCalculator - Local`

## Workflow covered

The collection runs in order and covers:

1. API health
2. Database health
3. Registered-user creation
4. Authenticated profile retrieval
5. Unauthenticated match rejection
6. Registered match creation
7. Minimum-player validation
8. Registered-player creation
9. Local-player creation
10. Duplicate-name rejection
11. Seat and turn ordering
12. Match start
13. Draft-edit rejection after start
14. Match retrieval
15. Match listing
16. Match cancellation
17. Repeated-cancellation rejection
18. Guest-session creation
19. Guest-player creation
20. Guest match creation
21. Guest-player assignment
22. Guest match start
23. Guest-session claiming
24. Old guest-token rejection
25. Transferred match retrieval
26. Registered ownership verification

## Automatic variables

The collection automatically stores:

- Registered user ID
- Access token
- Refresh token
- Registered match ID
- Registered match-player ID
- Local match-player ID
- Guest-session token
- Guest-session ID
- Guest-player IDs
- Guest match ID

The collection is designed to run from top to bottom without manually copying IDs or tokens.
