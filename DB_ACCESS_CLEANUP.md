# Database Access Cleanup

Status: complete.

The server database layer uses Prisma model methods through `ctx.db`, `db`, or
transaction clients. Raw SQL helpers and Prisma `upsert` are banned by
`scripts/check-db-access.js`, which is part of `npm run verify`.

## Enforced Rules

- No `$queryRaw`.
- No `$executeRaw`.
- No `Prisma.sql`.
- No `.upsert(`.
- Use Prisma `findFirst`, `findUnique`, `create`, `update`, `updateMany`,
  `findMany`, and `groupBy` as appropriate.
- Use transactions for multi-step writes that must stay consistent.

## Shared Repository Helpers

- `src/server/repositories/inventoryRepository.ts`
- `src/server/repositories/tradeRepository.ts`
- `src/server/repositories/stripePurchaseRepository.ts`
- `src/server/repositories/buildingRepository.ts`

## Verification

```bash
npm run check:db-access
npm run verify
```
