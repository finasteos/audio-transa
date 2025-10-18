const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const PythonTranscriptionService = require('./pythonTranscriptionService');

class TranscriptionService {
  constructor() {
    // Initialize services
    this.pythonService = new PythonTranscriptionService();

    // Initialize OpenAI client if API key is available (fallback)
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      this.useOpenAI = true;
    } else {
      this.useOpenAI = false;
      console.log('ℹ️ OpenAI API key not found. Will use local Python pipeline only.');
    }

    this.preferredService = 'python'; // Use Python pipeline as preferred method
  }

  // Main transcription method
  async transcribeAudio(audioBuffer, options = {}) {
    try {
      // Try Python pipeline first (preferred method)
      if (this.preferredService === 'python') {
        try {
          const pythonResult = await this.pythonService.transcribeAudio(audioBuffer, options);
          console.log('✅ Used Python local pipeline for transcription');
          return pythonResult;
        } catch (pythonError) {
          console.warn('⚠️ Python pipeline failed, falling back to OpenAI:', pythonError.message);

          // Fall back to OpenAI if available
          if (this.useOpenAI) {
            const openaiResult = await this.transcribeWithOpenAI(audioBuffer, options);
            console.log('✅ Used OpenAI API as fallback');
            return openaiResult;
          } else {
            // No fallback available, throw the original Python error
            throw pythonError;
          }
        }
      }

      // Fallback to OpenAI if Python is not preferred
      if (this.useOpenAI) {
        return await this.transcribeWithOpenAI(audioBuffer, options);
      } else {
        return this.getMockTranscription(audioBuffer, options);
      }
    } catch (error) {
      console.error('Transcription error:', error);
      throw new Error(`Transcription failed: ${error.message}`);
    }
  }

  // Transcribe using OpenAI Whisper API
  async transcribeWithOpenAI(audioBuffer, options = {}) {
    const {
      language = 'en',
      responseFormat = 'json',
      temperature = 0
    } = options;

    try {
      // Create a temporary file for the audio
      const tempFileName = `temp_audio_${Date.now()}.wav`;
      const tempFilePath = path.join(__dirname, 'temp', tempFileName);

      // Ensure temp directory exists
      if (!fs.existsSync(path.join(__dirname, 'temp'))) {
        fs.mkdirSync(path.join(__dirname, 'temp'));
      }

      // Write audio buffer to temporary file
      fs.writeFileSync(tempFilePath, audioBuffer);

      // Create read stream for OpenAI
      const audioReadStream = fs.createReadStream(tempFilePath);

      // Call OpenAI Whisper API
      const response = await this.openai.audio.transcriptions.create({
        file: audioReadStream,
        model: 'whisper-1',
        language: language,
        response_format: responseFormat,
        temperature: temperature
      });

      // Clean up temporary file
      fs.unlinkSync(tempFilePath);

      return {
        text: response.text,
        language: response.language || language,
        duration: response.duration || null,
        segments: response.segments || null,
        confidence: this.calculateConfidence(response.text)
      };

    } catch (error) {
      console.error('OpenAI transcription error:', error);
      throw error;
    }
  }

  // Mock transcription for development/testing
  getMockTranscription(audioBuffer, options = {}) {
    const mockResponses = [
      "Hello, this is a test transcription of the audio.",
      "The audio transcription feature is working correctly.",
      "This is sample text that would normally come from speech recognition.",
      "Audio processing and transcription is now active.",
      "Testing the real-time transcription capabilities."
    ];

    // Simulate processing time
    const randomDelay = Math.random() * 2000 + 1000; // 1-3 seconds

    return new Promise((resolve) => {
      setTimeout(() => {
        const randomResponse = mockResponses[Math.floor(Math.random() * mockResponses.length)];
        resolve({
          text: randomResponse,
          language: options.language || 'en',
          duration: audioBuffer.length / 16000, // Rough estimate
          confidence: Math.random() * 0.3 + 0.7, // 70-100% confidence
          mock: true
        });
      }, randomDelay);
    });
  }

  // Calculate confidence score based on text characteristics
  calculateConfidence(text) {
    if (!text || text.length === 0) return 0;

    let confidence = 0.5; // Base confidence

    // Longer text tends to have higher confidence
    confidence += Math.min(text.length / 100, 0.3);

    // Text with proper punctuation might indicate clearer speech
    const punctuationCount = (text.match(/[.,!?;]/g) || []).length;
    confidence += Math.min(punctuationCount * 0.1, 0.2);

    return Math.min(confidence, 1.0);
  }

  // Batch transcription for multiple audio files
  async transcribeBatch(audioBuffers, options = {}) {
    const results = [];

    for (const audioBuffer of audioBuffers) {
      try {
        const result = await this.transcribeAudio(audioBuffer, options);
        results.push({
          success: true,
          result
        });
      } catch (error) {
        results.push({
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  // Get supported languages
  getSupportedLanguages() {
    return [
      'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh',
      'ar', 'hi', 'nl', 'pl', 'tr', 'sv', 'da', 'no', 'fi', 'he',
      'th', 'cs', 'hu', 'el', 'bg', 'hr', 'sk', 'sl', 'et', 'lv',
      'lt', 'mt', 'ro', 'sq', 'bs', 'mk', 'sr', 'uk', 'ka', 'hy'
    ];
  }

  // Extract speaker information from transcription result
  extractSpeakerInfo(result) {
    if (!result.segments || !Array.isArray(result.segments)) {
      return {
        speakers: [],
        speakerCount: 0,
        speakerSegments: {}
      };
    }

    const speakers = [...new Set(result.segments.map(s => s.speaker).filter(s => s && s !== 'Unknown'))];
    const speakerSegments = {};

    // Group segments by speaker
    result.segments.forEach(segment => {
      if (segment.speaker && segment.speaker !== 'Unknown') {
        if (!speakerSegments[segment.speaker]) {
          speakerSegments[segment.speaker] = [];
        }
        speakerSegments[segment.speaker].push(segment);
      }
    });

    // Calculate speaker statistics
    const speakerStats = speakers.map(speaker => ({
      speaker,
      wordCount: speakerSegments[speaker].length,
      startTime: Math.min(...speakerSegments[speaker].map(s => s.start)),
      endTime: Math.max(...speakerSegments[speaker].map(s => s.end)),
      duration: Math.max(...speakerSegments[speaker].map(s => s.end)) - Math.min(...speakerSegments[speaker].map(s => s.start))
    }));

    return {
      speakers,
      speakerCount: speakers.length,
      speakerSegments,
      speakerStats
    };
  }

  // Format transcription result for display
  formatTranscriptionResult(result, format = 'text') {
    if (format === 'markdown' && result.raw?.markdown) {
      return result.raw.markdown;
    }

    if (format === 'speakers' && result.speakers) {
      const speakerInfo = this.extractSpeakerInfo(result);
      return speakerInfo.speakerStats.map(stat =>
        `${stat.speaker}: ${stat.wordCount} words (${stat.duration.toFixed(1)}s)`
      ).join('\n');
    }

    // Default text format
    return result.text || '';
  }

  // Check if service is properly configured
  async isConfigured() {
    const pythonAvailable = await this.pythonService.isAvailable();
    const openaiConfigured = this.useOpenAI && !!process.env.OPENAI_API_KEY;

    return pythonAvailable || openaiConfigured;
  }

  // Get detailed service status
  async getServiceStatus() {
    const pythonStatus = await this.pythonService.getStatus();
    const openaiConfigured = this.useOpenAI && !!process.env.OPENAI_API_KEY;

    return {
      preferredService: this.preferredService,
      pythonService: pythonStatus,
      openaiConfigured,
      overallConfigured: pythonStatus.available || openaiConfigured
    };
  }
}

module.exports = TranscriptionService;