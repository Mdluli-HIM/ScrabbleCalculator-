# Sprint 3: Local Dictionary Validation

## Status

Complete.

API version: `0.4.0`

## Objective

Sprint 3 introduces local word validation for active Scrabble matches.

The implementation does not use Oxford, a tournament dictionary API, or any other external dictionary service. Words are validated using a versioned local lexicon stored in PostgreSQL.

## Local dictionary

Current development lexicon:

- Code: `LOCAL_STARTER`
- Version: `1.0.0`
- Words: `122`
- Source file: `data/dictionaries/local-starter-v1.txt`

This is a small development dictionary and is not an official Oxford or tournament Scrabble dictionary.

A licensed or external provider can be added later without replacing the local validation architecture.

## Dictionary policy

Sprint 3 adds:

- `LOCAL_WORD_LIST`

The existing policies remain reserved for future providers:

- `OXFORD_ONLY`
- `TOURNAMENT_LEXICON_ONLY`
- `BOTH_REQUIRED`
- `EITHER_ACCEPTED`

Validation under those external policies currently returns:

- `DICTIONARY_POLICY_NOT_AVAILABLE`

## Match dictionary locking

When a `LOCAL_WORD_LIST` match starts:

1. The API finds the current `LOCAL_STARTER` lexicon.
2. The match stores the lexicon ID.
3. The match remains connected to that exact version.
4. Future dictionary versions do not change the rules of an active match.

The database prevents a started local match from existing without a locked lexicon.

## Validation endpoint

### Request

`POST /api/v1/matches/:matchId/dictionary/validate`

Registered authentication:

`Authorization: Bearer <access-token>`

Guest authentication:

`x-guest-session-token: <guest-session-token>`

Body:

```json
{
  "words": [
    "QUIZ",
    "WORLD"
  ]
}
```

## Validation rules

- A minimum of one word is required.
- A maximum of 15 words may be checked at once.
- Each word may contain letters only.
- Each word may contain at most 40 characters.
- Input is trimmed.
- Input is normalized to uppercase.
- Every submitted word is returned independently.
- One invalid word makes the overall validation result invalid.
- Invalid words are never automatically corrected.
- Validation does not award points.
- Validation does not advance the turn.

## Successful response

```json
{
  "success": true,
  "message": "All submitted words are valid.",
  "data": {
    "validation": {
      "matchId": "match-id",
      "dictionaryPolicy": "LOCAL_WORD_LIST",
      "lexicon": {
        "code": "LOCAL_STARTER",
        "version": "1.0.0",
        "name": "ScrabbleCalculator Local Starter Lexicon"
      },
      "accepted": true,
      "words": [
        {
          "submittedWord": "quiz",
          "normalizedWord": "QUIZ",
          "accepted": true,
          "suggestions": []
        }
      ]
    }
  }
}
```

## Rejected word response

The endpoint still returns HTTP 200 when validation completes successfully but the submitted word is not in the dictionary.

```json
{
  "success": true,
  "message": "One or more submitted words are invalid.",
  "data": {
    "validation": {
      "accepted": false,
      "words": [
        {
          "submittedWord": "QUZI",
          "normalizedWord": "QUZI",
          "accepted": false,
          "suggestions": [
            "QUIZ"
          ]
        }
      ]
    }
  }
}
```

An invalid word is a completed validation result, not a server failure.

## Suggestions

Suggestions are produced locally using Levenshtein edit distance.

Suggestions:

- Are informational only.
- Are limited to five results.
- Never modify the submitted word.
- Never cause automatic acceptance.
- Are taken from the match's locked lexicon.

## Match requirements

Dictionary validation requires:

- An owned match.
- Match status `IN_PROGRESS`.
- Policy `LOCAL_WORD_LIST`.
- A locked local lexicon.

Possible errors include:

- `MATCH_ACTOR_REQUIRED`
- `MATCH_NOT_FOUND`
- `MATCH_NOT_IN_PROGRESS`
- `DICTIONARY_POLICY_NOT_AVAILABLE`
- `LOCAL_DICTIONARY_UNAVAILABLE`

## Ownership and privacy

Registered users can only validate words against their own matches.

Guest sessions can only validate words against matches owned by that guest session.

Unauthorized access returns `MATCH_NOT_FOUND` so the API does not reveal whether another owner's match exists.

## Database models

Sprint 3 introduces:

- `DictionaryLexicon`
- `DictionaryWord`

A lexicon is identified by:

- `code`
- `version`

Dictionary words are unique within a lexicon version.

## Database protections

The migration adds:

- A foreign key from `Match` to `DictionaryLexicon`.
- A unique current-version index per lexicon code.
- A check requiring started local matches to have a locked lexicon.
- Unique words within each lexicon version.

## Dictionary version integrity

Existing dictionary versions are immutable.

Running the seed command again succeeds only when the stored version contains exactly the same words as the versioned source file.

Changing version `1.0.0` requires creating a new dictionary version instead of silently replacing the old version.

## Commands

Import or verify the local dictionary:

```bash
npm run dictionary:seed
```

Run project verification:

```bash
npm run lint
npm test
npm run build
npx prisma validate
npm run dictionary:seed
git diff --check
```

## Automated verification

Current result:

- Test files: 7 passed
- Tests: 31 passed
- ESLint: passed
- TypeScript build: passed
- Prisma validation: passed
- Dictionary seed: passed
- Local dictionary words: 122
