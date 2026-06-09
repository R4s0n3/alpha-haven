# Space Haven

Space Haven is a browser game about building Alpha Haven, producing materials,
launching trade routes, and upgrading a fleet over time.

## Stack

- Next.js pages router
- tRPC API routes
- Prisma with PostgreSQL
- NextAuth authentication
- Tailwind CSS
- React Three Fiber for the port and star map scenes

## Local Development

Install dependencies, start a local PostgreSQL database, apply the Prisma
schema, then run the Next.js dev server.

```bash
npm install
npm run db:start
npm run db:push
npm run dev
```

The database helper prints a local `DATABASE_URL`. Keep that value in `.env`.

## Verification

```bash
npm run verify
npm run smoke:gameplay
npm run build
```

`npm run verify` checks for banned raw database access patterns, runs the
TypeScript compiler, and runs Next.js lint.
`npm run smoke:gameplay` requires the local database and exercises the
authenticated server game loop with a temporary user.

## Game Loop

- Buildings passively generate Rhoons and automatically sync material output.
- Launch Pads open port slots for route jobs.
- Routes consume cargo and H3 fuel, then return rewards after travel.
- Rockets and buildings can be upgraded with Rhoons.
- Auto route unlocks once Launch Pads reach the configured balance level.
