# Sprint 4 Postman Workflow

## Files

- `postman/ScrabbleCalculator-Local.postman_environment.json`
- `postman/ScrabbleCalculator-Sprint-4.postman_collection.json`

## Preparation

```bash
npm run db:up
npx prisma migrate deploy
npm run dictionary:seed
npm run dev
```

The API runs at `http://localhost:5050`.

The Sprint 4 collection builds on the complete Sprint 3 workflow and adds authoritative turn-scoring requests.
