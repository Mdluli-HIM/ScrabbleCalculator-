# Sprint 3 Postman Workflow

## Files

Import these files into Postman:

- `postman/ScrabbleCalculator-Local.postman_environment.json`
- `postman/ScrabbleCalculator-Sprint-3.postman_collection.json`

## Requirements

Start PostgreSQL:

```bash
npm run db:up
```

Prepare the local dictionary:

```bash
npm run dictionary:seed
```

Start the API:

```bash
npm run dev
```

The API runs at:

`http://localhost:5050`

Select the Postman environment:

`ScrabbleCalculator - Local`

## Collection coverage

The Sprint 3 collection covers:

1. API health
2. Registered-user creation
3. Local dictionary match creation
4. Registered-player assignment
5. Local-player assignment
6. Match start and lexicon locking
7. Valid-word validation
8. Mixed valid and invalid words
9. Local spelling suggestions
10. Unsupported-character rejection
11. Locked lexicon metadata
12. Disabled external-policy validation
13. Guest-session creation
14. Guest-player creation
15. Guest-owned local match creation
16. Guest match start
17. Guest dictionary validation

## Important behaviour

An invalid dictionary word returns HTTP `200` because the lookup completed successfully.

Use `data.validation.accepted` to determine the result.

The endpoint never awards points, advances the turn, automatically corrects words, or contacts Oxford or another external provider.

## Current local lexicon

- Code: `LOCAL_STARTER`
- Version: `1.0.0`
- Words: `122`

This lexicon is for development and testing. It is not an official Oxford or tournament dictionary.
