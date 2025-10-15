const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('start-recording', () => {
    console.log('Recording started for user:', socket.id);
    socket.emit('recording-status', { status: 'recording' });
  });

  socket.on('stop-recording', (audioData) => {
    console.log('Recording stopped for user:', socket.id);
    // Here we'll process the audio data and send it for transcription
    processAudioForTranscription(audioData, socket);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Audio processing function (placeholder)
async function processAudioForTranscription(audioData, socket) {
  try {
    // Convert audio data to buffer
    const audioBuffer = Buffer.from(audioData.audioBlob, 'base64');

    // Save audio file temporarily (optional)
    const fs = require('fs');
    const audioFileName = `temp_audio_${Date.now()}.wav`;
    fs.writeFileSync(audioFileName, audioBuffer);

    // Send for transcription
    const transcription = await transcribeAudio(audioBuffer);

    // Send transcription back to client
    socket.emit('transcription-result', {
      transcription: transcription,
      timestamp: new Date().toISOString()
    });

    // Clean up temporary file
    fs.unlinkSync(audioFileName);

  } catch (error) {
    console.error('Error processing audio:', error);
    socket.emit('transcription-error', {
      error: 'Failed to process audio for transcription'
    });
  }
}

// Transcription function (placeholder - will use OpenAI Whisper)
async function transcribeAudio(audioBuffer) {
  // This will be implemented when we add the OpenAI integration
  return "Transcription will be implemented with OpenAI Whisper API";
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Audio Transa server running on port ${PORT}`);
  console.log(`📝 Open http://localhost:${PORT} in your browser`);
});

module.exports = { app, server, io };