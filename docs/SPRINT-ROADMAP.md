# ScrabbleCalculator API Sprint Roadmap

## Sprint 0: Foundation

- Node.js and TypeScript project
- Express application
- PostgreSQL container
- Prisma ORM
- Environment validation
- Structured logging
- Standard API responses
- Health endpoints
- Automated tests
- Postman collection
- Initial GitHub push

## Sprint 1: Identity and guest sessions

- Registered user model
- Registration
- Login
- Refresh tokens
- Logout
- Guest sessions
- Guest players
- Authentication middleware
- Claim eligible guest activity
- Sprint 1 Postman collection

## Sprint 2: Match setup

- Create a match
- Add players
- Choose turn order
- Choose dictionary mode
- Configure hidden-score rules
- Start a match
- Guest match access
- Sprint 2 Postman collection

## Sprint 3: Dictionary validation

- Dictionary provider interface
- Oxford provider integration
- Tournament lexicon provider integration
- Both-required validation
- Either-accepted validation
- Spelling suggestions
- Validation records
- Sprint 3 Postman collection

## Sprint 4: Score calculator — Complete (API 0.5.0)

- Letter values
- Blank tiles
- Double-letter bonuses
- Triple-letter bonuses
- Double-word bonuses
- Triple-word bonuses
- Seven-tile bonus
- Crosswords
- Turn total
- Collect-tiles instruction
- Sprint 4 Postman collection

## Sprint 5: Dramatic hidden-score experience — Complete (API 0.6.0)

- Private exact totals
- Public ranking order
- Lead changes
- Position changes
- Momentum indicators
- Match closeness indicators
- Dramatic match events
- Responses that cannot expose hidden totals
- Sprint 5 Postman collection

## Sprint 6: End game and results

- Remaining rack deductions
- Finishing-player bonus
- Final score reveal
- Winner
- Podium
- Match highlights
- Personal records
- Sprint 6 Postman collection

## Sprint 7: History and rankings

- Match history
- Player statistics
- Private rankings
- Head-to-head records
- Winning streaks
- Highest-scoring words
- Longest words
- Average turn score
- Sprint 7 Postman collection
