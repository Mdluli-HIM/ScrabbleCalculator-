# ScrabbleCalculator Product Rules

## Core experience

ScrabbleCalculator supports physical Scrabble games.

The application does not replace the physical board. It calculates scores,
validates submitted words, manages turns and stores match records.

## Hidden total scores

While a match is active:

- Exact cumulative scores remain hidden.
- Players can see the current ranking order.
- Players can see who is leading.
- Players can see when the leader changes.
- Players can see points earned during the latest turn.
- Players can see momentum and closeness indicators.
- Players cannot see exact score differences.
- Final totals are revealed only when the game ends.

The API must not expose information that allows users to reconstruct the
hidden cumulative totals.

## Dictionary modes

The host selects one dictionary rule before the match starts:

- OXFORD_ONLY
- TOURNAMENT_LEXICON_ONLY
- BOTH_REQUIRED
- EITHER_ACCEPTED

The selected rule cannot change after the match starts.

## Valid word submission

When a word is submitted:

1. Normalise the spelling.
2. Validate the word against the selected dictionary rule.
3. Show whether the spelling and word are valid.
4. Calculate the turn score.
5. Store the word and calculation.
6. Show the points earned during that turn.
7. Tell the player how many replacement tiles to collect.
8. Move to the next player.

Example message:

Marcus earned 18 points. Collect 3 tiles.

## Invalid word submission

When a word is invalid:

- The score is not added.
- The turn does not advance.
- The player is shown which dictionary rejected the word.
- Spelling suggestions may be shown.
- A suggested word is never accepted automatically.
- The player must submit the corrected word.

## Guest matches

Guest users can:

- Start a match without registration.
- Add temporary players.
- Use dictionary validation.
- Calculate turns.
- Complete a match.
- View the final result during the guest session.

Guest matches are temporary unless they are claimed by a registered account.

## Registered users

Registered users can:

- Save match history.
- Maintain player profiles.
- View rankings.
- View head-to-head records.
- Track winning streaks.
- Track personal records.
- Claim eligible guest matches.
