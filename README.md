# Luna Voice

Luna Voice is a desktop AI voice companion featuring the Singularity Horizon visualization and powered by ElevenLabs Conversational AI.

## Features

- **ElevenLabs Conversational AI** - Natural voice conversations with the Luna SmartStart agent
- **Singularity Horizon** - Stunning WebGL2 visualization that responds to conversation state
- **Light minimalist UI** - Clean, modern interface with glassmorphic design
- **Artifact panel** - Display markdown, charts, images, notes, and more
- **Computer use mode** - Optional macOS automation capabilities
- **macOS app** - Installable app you can keep in your Dock

## Requirements

- macOS (for full features) or Linux/Windows (basic features)
- Node.js 20+
- npm
- ElevenLabs API key with Conversational AI access

## Quick Start

```bash
git clone https://github.com/kokodagwapo/lunavoice.git
cd lunavoice
npm install
cp .env.example .env.local
# Edit .env.local with your API keys
npm run dev
```

## Configuration

Edit `.env.local`:

```bash
# Required - ElevenLabs Conversational AI
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_AGENT_ID=agent_9201m2rz87evfjsaek9c3a275b62

# Optional - Exa web search
EXA_API_KEY=your_exa_api_key_here

# Optional - OpenAI for image generation tools
OPENAI_API_KEY=your_openai_api_key_here
```

### ElevenLabs Agent

Luna Voice uses the **Luna - SmartStart** agent by default:
- Agent ID: `agent_9201m2rz87evfjsaek9c3a275b62`
- Voice: Custom female voice (ID: `nAjIdBO5jCaTG1W0RTrz`)

You can use your own ElevenLabs agent by changing `ELEVENLABS_AGENT_ID`.

## Building the macOS App

### Install to Applications & Dock

1. Build the distributable:
   ```bash
   npm run dist:mac
   ```

2. Find the built app:
   - DMG installer: `release/Luna Voice-3.0.0.dmg`
   - Or direct app: `release/mac/Luna Voice.app`

3. Install:
   - Open the DMG and drag Luna Voice to Applications, OR
   - Copy `Luna Voice.app` to `/Applications`

4. Keep in Dock:
   - Launch Luna Voice from Applications
   - Right-click the Dock icon → Options → Keep in Dock

### Development Build

For a quick local build without creating a DMG:

```bash
npm run pack:mac
# App at: release/mac/Luna Voice.app
```

## Development

```bash
npm run dev       # Start dev server + Electron
npm run typecheck # Type check
npm run build     # Production build (web assets only)
```

## macOS Permissions

Luna Voice may request:
- **Microphone** - Required for voice conversations
- **Accessibility** - Required for computer-control tools
- **Screen Recording** - Required for screenshots

## Controls

- **Call** - Connect to Luna voice agent
- **Mute** - Toggle microphone
- **End** - Disconnect call
- **Volume** - Adjust playback volume
- **Keyboard** - Type messages instead of speaking
- **Computer** - Switch to computer-use mode
- **Panel** - Toggle artifact panel
- **History** - Show conversation log
- **Restart** - Restart the app (confirms if call is active)

## Singularity Horizon

The main avatar is a WebGL2 visualization with:
- Interactive drag-to-orbit camera
- Mood-reactive states (idle → listening → speaking)
- HUD overlay with real-time metrics
- Respects `prefers-reduced-motion`

## License

MIT
