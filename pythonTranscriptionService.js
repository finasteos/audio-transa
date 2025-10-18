const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');

class PythonTranscriptionService {
    constructor() {
        this.pythonScript = path.join(__dirname, 'transcription_pipeline.py');
        this.tempDir = path.join(__dirname, 'temp_audio_transa');

        // Ensure temp directory exists
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }

        this.hfToken = process.env.HF_TOKEN;
    }

    /**
     * Transcribe audio using the Python pipeline
     * @param {Buffer} audioBuffer - Audio data buffer
     * @param {Object} options - Transcription options
     * @returns {Promise<Object>} Transcription result
     */
    async transcribeAudio(audioBuffer, options = {}) {
        return new Promise(async (resolve, reject) => {
            try {
                // Save audio buffer to temporary file
                const tempFilePath = await this.saveAudioBuffer(audioBuffer);

                // Prepare Python script arguments
                const args = [this.pythonScript, tempFilePath];

                if (this.hfToken) {
                    args.push('--hf-token', this.hfToken);
                }

                if (options.outputFormat) {
                    args.push('--output', options.outputFormat);
                }

                // Spawn Python process
                const pythonProcess = spawn('python3', args, {
                    cwd: __dirname,
                    env: { ...process.env, HF_TOKEN: this.hfToken }
                });

                let stdout = '';
                let stderr = '';

                // Collect stdout data
                pythonProcess.stdout.on('data', (data) => {
                    stdout += data.toString();
                });

                // Collect stderr data
                pythonProcess.stderr.on('data', (data) => {
                    stderr += data.toString();
                });

                // Handle process completion
                pythonProcess.on('close', async (code) => {
                    try {
                        // Clean up temporary file
                        await this.cleanupTempFile(tempFilePath);

                        if (code !== 0) {
                            console.error('Python script error:', stderr);
                            reject(new Error(`Python script failed with code ${code}: ${stderr}`));
                            return;
                        }

                        // Parse the output
                        const result = this.parsePythonOutput(stdout, options.outputFormat);

                        if (options.outputFormat === 'markdown') {
                            resolve({
                                text: result,
                                language: 'sv',
                                confidence: 0.9, // High confidence for this pipeline
                                speakers: [], // Could extract from markdown if needed
                                segments: [],
                                pipeline: 'python-local'
                            });
                        } else {
                            resolve({
                                text: result.markdown || result.segments?.map(w => w.word).join(' ') || '',
                                language: 'sv',
                                confidence: 0.9,
                                speakers: result.speakers || [],
                                segments: result.segments || [],
                                duration: result.duration || 0,
                                totalWords: result.total_words || 0,
                                pipeline: 'python-local',
                                raw: result
                            });
                        }
                    } catch (error) {
                        reject(error);
                    }
                });

                // Handle process errors
                pythonProcess.on('error', async (error) => {
                    await this.cleanupTempFile(tempFilePath);
                    reject(new Error(`Failed to start Python process: ${error.message}`));
                });

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Save audio buffer to temporary file
     * @param {Buffer} audioBuffer - Audio data buffer
     * @returns {Promise<string>} Path to temporary file
     */
    async saveAudioBuffer(audioBuffer) {
        return new Promise((resolve, reject) => {
            const tempFileName = `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.wav`;
            const tempFilePath = path.join(this.tempDir, tempFileName);

            fs.writeFile(tempFilePath, audioBuffer, (error) => {
                if (error) {
                    reject(new Error(`Failed to save audio buffer: ${error.message}`));
                } else {
                    resolve(tempFilePath);
                }
            });
        });
    }

    /**
     * Clean up temporary file
     * @param {string} filePath - Path to file to delete
     * @returns {Promise<void>}
     */
    async cleanupTempFile(filePath) {
        return new Promise((resolve) => {
            if (fs.existsSync(filePath)) {
                fs.unlink(filePath, (error) => {
                    if (error) {
                        console.warn(`Failed to cleanup temp file ${filePath}:`, error.message);
                    }
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * Parse output from Python script
     * @param {string} output - Raw output from Python script
     * @param {string} outputFormat - Expected output format
     * @returns {Object|string} Parsed result
     */
    parsePythonOutput(output, outputFormat = 'json') {
        try {
            if (outputFormat === 'markdown') {
                return output.trim();
            } else {
                return JSON.parse(output);
            }
        } catch (error) {
            console.error('Failed to parse Python output:', error);
            console.error('Raw output:', output);
            throw new Error(`Invalid output from Python script: ${error.message}`);
        }
    }

    /**
     * Check if Python and required modules are available
     * @returns {Promise<boolean>} True if available
     */
    async isAvailable() {
        return new Promise((resolve) => {
            const pythonProcess = spawn('python3', ['-c', 'import whisper_timestamped, pyannote.audio; print("OK")']);

            let stderr = '';

            pythonProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            pythonProcess.on('close', (code) => {
                resolve(code === 0 && !stderr.includes('ModuleNotFoundError'));
            });

            pythonProcess.on('error', () => {
                resolve(false);
            });
        });
    }

    /**
     * Get service configuration status
     * @returns {Promise<Object>} Configuration status
     */
    async getStatus() {
        const available = await this.isAvailable();

        return {
            available,
            pythonScript: this.pythonScript,
            tempDir: this.tempDir,
            hfTokenConfigured: !!this.hfToken,
            service: 'python-local-transcription'
        };
    }

    /**
     * Batch transcription for multiple audio files
     * @param {Buffer[]} audioBuffers - Array of audio buffers
     * @param {Object} options - Transcription options
     * @returns {Promise<Object[]>} Array of transcription results
     */
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
}

module.exports = PythonTranscriptionService;