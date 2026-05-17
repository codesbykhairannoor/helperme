# WhatsApp Bot

A feature-rich WhatsApp bot built with Baileys (WhiskeySockets) for Node.js.

## Features

- **Anti-Delete**: Recovers and saves deleted messages
- **View-Once Saver**: Saves view-once media and resends as normal messages
- **Status Features**: Auto-view, auto-react, and grab status media
- **AI Chat**: Conversational AI powered by Groq
- **Games**: Tic-tac-toe, trivia, and word guess (hangman)

## Commands

| Command | Description |
|---------|-------------|
| `.help` | Show all commands |
| `.ai <message>` | Chat with AI |
| `.antidelete on/off` | Toggle deleted message recovery |
| `.viewonce on/off` | Toggle view-once saving |
| `.autoview on/off` | Toggle auto-view status |
| `.autoreact on/off` | Toggle auto-react to status |
| `.settings` | Show current settings |
| `.ttt @user` | Start Tic-Tac-Toe |
| `.trivia [rounds]` | Start trivia game |
| `.guess` | Start word guess game |
| `.ping` | Check bot status |

## Setup

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and configure:
   ```bash
   cp .env.example .env
   ```

4. Set your environment variables:
   - `GROQ_API_KEY`: Get from [console.groq.com](https://console.groq.com)
   - `OWNER_NUMBER`: Your WhatsApp number (country code, no +)
   - `BOT_PREFIX`: Command prefix (default: `.`)

5. Build and run:
   ```bash
   npm run build
   npm start
   ```

6. Scan the QR code with WhatsApp

## Deployment on Render

1. Create a new **Background Worker** on Render
2. Connect your repository
3. Set environment variables in Render dashboard
4. Add a persistent disk:
   - Mount path: `/data`
   - Size: 1GB
5. Deploy!

Alternatively, use the `render.yaml` Blueprint for one-click deployment.

## Project Structure

```
bot/
├── src/
│   ├── index.ts           # Entry point
│   ├── config.ts          # Configuration
│   ├── connection.ts      # WhatsApp connection
│   ├── database/          # SQLite database
│   ├── handlers/          # Message handlers
│   ├── features/          # Bot features
│   │   ├── anti-delete.ts
│   │   ├── viewonce-saver.ts
│   │   ├── status-handler.ts
│   │   ├── ai-chat.ts
│   │   └── games/
│   ├── utils/             # Utilities
│   └── types/             # TypeScript types
├── media/                 # Stored media files
├── auth/                  # WhatsApp auth state
└── package.json
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GROQ_API_KEY` | Groq API key for AI chat | Yes (for AI) |
| `OWNER_NUMBER` | Your WhatsApp number | Recommended |
| `BOT_PREFIX` | Command prefix | No (default: `.`) |
| `DEFAULT_ANTI_DELETE` | Enable anti-delete by default | No |
| `DEFAULT_VIEWONCE_SAVE` | Enable view-once saving by default | No |
| `DEFAULT_AUTO_VIEW_STATUS` | Enable auto-view by default | No |
| `DEFAULT_AUTO_REACT_STATUS` | Enable auto-react by default | No |

## Notes

- The bot requires a persistent connection to WhatsApp
- First run will show a QR code to scan
- Auth credentials are saved in the `auth/` folder
- Media and messages are stored in SQLite database
- Old data is automatically cleaned up after 7 days

## License

MIT
