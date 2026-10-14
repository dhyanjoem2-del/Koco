# Koco — Events with feeling

Koco is an event management website with an optional AI event guide. The site is served by a small Node.js server.

## Run locally

- Install Node.js 20.6 or newer.
- Copy .env.example to .env and add your OpenAI API key. Keep .env private.
- Run: node --env-file=.env server.mjs
- Open http://localhost:3000.

## Deploy on Render

1. Create a Web Service connected to this private GitHub repository.
2. Build command: npm install
3. Start command: npm start
4. Add OPENAI_API_KEY in Render Environment settings if you want the AI guide enabled.
5. Open the onrender.com address Render gives you.

The free web service may sleep after a period without visitors, so its first visit afterward can take longer. OpenAI API usage for the AI guide is billed separately from website hosting and ChatGPT subscriptions.

Never commit the .env file or put an API key in GitHub. The .gitignore file excludes .env.
