# Audio Transa 🎤

A real-time audio transcription application built with Node.js, Socket.io, and OpenAI Whisper API.

## Features

- 🎙️ **Real-time audio recording** - Record audio directly from your browser
- 📝 **Live transcription** - See your speech converted to text in real-time
- 🌍 **Multi-language support** - Supports 40+ languages
- 💾 **Export functionality** - Copy or download transcriptions
- 🔧 **Configurable** - Easy to customize and extend
- 🚀 **WebSocket integration** - Real-time communication between client and server

## Tech Stack

- **Backend**: Node.js, Express.js, Socket.io
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Audio Processing**: Web Audio API, MediaRecorder API
- **Transcription**: OpenAI Whisper API
- **Real-time**: Socket.io for bidirectional communication

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- OpenAI API key (for real transcription)

### Installation

1. **Clone and setup**:
   ```bash
   git clone https://github.com/finasteos/audio-transa.git
   cd audio-transa
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your OpenAI API key:
   ```env
   OPENAI_API_KEY=sk-your-actual-openai-api-key-here
   ```

4. **Start the application**:
   ```bash
   npm start
   ```

5. **Open your browser**:
   Navigate to `http://localhost:3000`

## Configuration

The application can be configured using the `.env` file:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `OPENAI_API_KEY` | Your OpenAI API key | Required for transcription |
| `NODE_ENV` | Environment mode | `development` |
| `AUDIO_SAMPLE_RATE` | Audio recording sample rate | `16000` |
| `LOG_LEVEL` | Logging level | `info` |

## Usage

1. **Allow microphone access** when prompted by your browser
2. **Click "Start Recording"** to begin capturing audio
3. **Speak clearly** into your microphone
4. **Click "Stop Recording"** when finished
5. **View your transcription** in the text area
6. **Copy or download** your transcribed text

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Main application interface |
| `/api/health` | GET | Health check and service status |
| `/api/languages` | GET | Supported languages list |

## WebSocket Events

### Client → Server
- `start-recording` - Initialize recording session
- `stop-recording` - Stop recording and process audio

### Server → Client
- `recording-status` - Recording state updates
- `transcription-result` - Transcription results
- `transcription-error` - Error notifications

## Development

### Available Scripts

- `npm start` - Start the production server
- `npm run dev` - Start with auto-reload (if nodemon is configured)

### Project Structure

```
audio-transa/
├── public/                 # Frontend assets
│   ├── index.html         # Main HTML interface
│   ├── styles.css         # Application styles
│   └── app.js             # Frontend JavaScript
├── audioService.js        # Audio recording service
├── transcriptionService.js # OpenAI Whisper integration
├── index.js               # Main server file
├── package.json           # Dependencies and scripts
├── .env                   # Configuration (create from .env.example)
└── README.md              # This file
```

## Troubleshooting

### Common Issues

1. **Microphone not working**:
   - Ensure microphone permissions are granted
   - Check browser console for errors

2. **No transcription results**:
   - Verify OpenAI API key is set correctly
   - Check network connectivity

3. **Audio quality issues**:
   - Use a good quality microphone
   - Speak clearly and at normal volume
   - Reduce background noise

### Debug Mode

Set `DEBUG=true` in `.env` for detailed logging.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Create an issue on GitHub
- Check the troubleshooting section above

---

Built with ❤️ using Node.js and OpenAI Whisper API