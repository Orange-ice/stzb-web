# web

Next.js + Prisma Web project for season-based data sharing and display.

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run prisma:generate
npm run prisma:migrate:dev
npm run prisma:studio
```

## Database

Default local connection is defined in `.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/stzb_web?schema=public"
```

Before first run:

```bash
npm run prisma:generate
npm run prisma:migrate:dev -- --name init
```
