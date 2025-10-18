import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3001"],
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// File upload setup
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/upload', upload.single('audio'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }
    
    const fileInfo = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    };
    
    // Emit upload event to connected clients
    io.emit('fileUploaded', fileInfo);
    
    res.json({ 
      message: 'File uploaded successfully', 
      file: fileInfo 
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('startTranscription', (data) => {
    console.log('Transcription started:', data);
    // Emit transcription progress updates
    socket.emit('transcriptionProgress', { 
      progress: 0, 
      status: 'Starting transcription...' 
    });
  });
  
  socket.on('audioChunk', (chunk) => {
    // Handle real-time audio chunks
    console.log('Received audio chunk:', chunk.length);
    // Process chunk and emit results
    socket.emit('transcriptionChunk', {
      text: 'Sample transcription text...',
      timestamp: Date.now()
    });
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Audio Transcription API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});