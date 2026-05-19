[README.md](https://github.com/user-attachments/files/28000233/README.md)
# Dad Meal Web App V1

Mobile-first macro tracker web app for Railway + PostgreSQL + OpenAI.

## What it includes

- Dashboard with macro progress bars and remaining macros
- Log meal page with AI analyze → confirm → save
- Recommendations based on today's remaining macros and saved fridge foods
- AI-written explanation for recommendations, with code doing the macro math
- Foods / fridge manager
- Weight logging
- History / weekly averages
- Settings for macro goals

## Railway variables

Set these on the web app service:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
OPENAI_API_KEY=...
TIMEZONE=America/Vancouver
APP_USER_ID=dad
WEB_PIN=1234
COOKIE_SECRET=any_random_string
OPENAI_MODEL=gpt-4.1-mini
```

If you want to share the same data as your Telegram bot, set `APP_USER_ID` to the same Telegram ID the bot used.

## Run locally

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Deploy

Upload this project to GitHub, connect Railway, add PostgreSQL, set variables, deploy.

## Notes

The recommendation engine is hybrid:

1. Code calculates today's remaining macro room.
2. Code builds safe meal candidates from saved foods/fridge foods.
3. OpenAI explains the best candidates in normal language.
