const fs = require('fs');
const path = require('path');

class AudioService {
  constructor() {
    this.isRecording = false;
    this.audioChunks = [];
    this.tempDir = path.join(__dirname, 'temp');
  }

  // Ensure temp directory exists
  ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  // Save audio buffer to temporary file
  saveAudioBuffer(audioBuffer, filename = null) {
    this.ensureTempDir();

    const timestamp = Date.now();
    const audioFileName = filename || `audio_${timestamp}.webm`;
    const filepath = path.join(this.tempDir, audioFileName);

    fs.writeFileSync(filepath, audioBuffer);

    console.log('💾 Audio saved to:', filepath);
    return {
      filepath,
      filename: audioFileName,
      timestamp: new Date().toISOString(),
      size: audioBuffer.length
    };
  }

  // Convert audio buffer to WAV format (for Whisper API)
  convertToWav(audioBuffer) {
    // For now, we'll return the buffer as-is since we're handling conversion client-side
    // In a production environment, you might want to use ffmpeg or similar tools
    return audioBuffer;
  }

  // Process audio data from client
  processAudioData(audioData) {
    try {
      // audioData should contain base64 encoded audio
      const audioBuffer = Buffer.from(audioData.audioBlob, 'base64');

      // Save the audio file
      const savedAudio = this.saveAudioBuffer(audioBuffer);

      return {
        success: true,
        audioInfo: savedAudio,
        message: 'Audio processed successfully'
      };
    } catch (error) {
      console.error('Error processing audio data:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get recording status
  getStatus() {
    return {
      isRecording: this.isRecording,
      tempDirExists: fs.existsSync(this.tempDir),
      tempDir: this.tempDir
    };
  }

  // Clean up temporary files
  cleanup() {
    if (fs.existsSync(this.tempDir)) {
      const files = fs.readdirSync(this.tempDir);
      files.forEach(file => {
        const filePath = path.join(this.tempDir, file);
        try {
          fs.unlinkSync(filePath);
          console.log('🗑️ Cleaned up temporary file:', file);
        } catch (error) {
          console.error('Error cleaning up file:', file, error);
        }
      });
    }
  }

  // Get list of temporary files
  getTempFiles() {
    if (!fs.existsSync(this.tempDir)) {
      return [];
    }

    return fs.readdirSync(this.tempDir).map(file => ({
      name: file,
      path: path.join(this.tempDir, file),
      size: fs.statSync(path.join(this.tempDir, file)).size,
      created: fs.statSync(path.join(this.tempDir, file)).birthtime
    }));
  }
}

// Create and export a singleton instance
const audioService = new AudioService();
module.exports = audioService;