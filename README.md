# Jabber

## Setup (local)
1. `npm install`
2. copy `.env.example` to `.env` and set `OPENAI_API_KEY`.
3. `npm start` and open http://localhost:3000

## Deploying on Render
1. Push these files to GitHub.
2. Create a Web Service on Render (connect your repo).
3. In Render > Service > Environment > Add `OPENAI_API_KEY` with your production key.
4. Deploy. Check logs for errors.

Make sure `logo.png` is in the repo root (or edit index.html if you put it in a folder).