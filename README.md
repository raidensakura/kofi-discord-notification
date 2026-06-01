# kofi-discord-notification
Serverless Netlify Function to forward Ko-fi webhook donation events to Discord and optionally archive supporters in a GitHub Gist.

## Features
- Receives Ko-fi webhook events via Netlify Functions
- Sends a Discord embed using a Discord webhook
- Optionally stores each donation payload in a GitHub Gist
- Uses modern Node.js APIs and supports Node 18+

## Environment variables
Set the following environment variables in Netlify or your local `.env` file:

- `WEBHOOK_URL` — Discord webhook URL
- `KOFI_TOKEN` — Ko-fi webhook verification token
- `KOFI_USERNAME` — optional Ko-fi username for embed link
- `GIST_TOKEN` — optional GitHub token used to update a Gist
- `GIST_URL` — optional URL of the target Gist

## Deployment
1. Deploy to Netlify using the repo or your own site.
2. Configure the environment variables above.
3. The function is available at `https://<your-site>.netlify.app/.netlify/functions/kofi`

## Testing
1. Add the function URL to Ko-fi webhook settings.
2. Use Ko-fi's test webhook button to verify the integration.
3. Confirm Discord receives the embed message.

## Notes
- If `GIST_URL` and `GIST_TOKEN` are both provided, the function will append each incoming payload to `kofi.json` in the specified Gist.
- If the gist information is omitted, the function still delivers Discord notifications.

## Local development
Run locally with:

```bash
npm install
npm run dev
```

Then use the local Netlify endpoint shown by `netlify dev`.

## Help
Feel free to create an issue if you need assistance.
