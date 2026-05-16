# Dad Meal Bot - Cloud PostgreSQL Version

Cloud-ready Telegram meal tracker. Use this for Railway or another Node host with PostgreSQL.

## Railway variables

Set these on the Railway app service:

```env
TELEGRAM_BOT_TOKEN=...
OPENAI_API_KEY=...
DATABASE_URL=${{Postgres.DATABASE_URL}}
TIMEZONE=America/Vancouver
OPENAI_MODEL=gpt-4.1-mini
ALLOWED_TELEGRAM_USER_ID=
```

Start command:

```bash
npm start
```

## Commands

```text
/today
/week
/foods
/delete_last
/edit_last corrected meal text here
/weight 170.4
/weights
/settargets 2600 175 305 70 65 35
/addfood name | base qty | unit | cal | protein | carbs | fat | sugar | fiber | aliases
/export
/help
```

## Optional local JSON import

If you want to import your old local `data/meals.json` into PostgreSQL:

1. Put the old file at `data/meals.json` inside this project.
2. Put the Railway public `DATABASE_URL` into your local `.env`, or run this from a Railway shell.
3. Run:

```bash
npm install
npm run import:json
```
