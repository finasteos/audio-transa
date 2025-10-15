#!/usr/bin/env node

/**
 * Test script for the Swedish transcription pipeline
 * This script tests the complete transcription pipeline with a sample audio file
 */

const fs = require('fs');
const path = require('path');
const TranscriptionService = require('./transcriptionService');

async function testTranscriptionPipeline() {
    console.log('🧪 Testing Swedish Transcription Pipeline');
    console.log('========================================\n');

    try {
        // Initialize the transcription service
        const transcriptionService = new TranscriptionService();

        // Check service status
        console.log('1. Checking service configuration...');
        const isConfigured = await transcriptionService.isConfigured();
        const status = await transcriptionService.getServiceStatus();

        console.log(`   - Service configured: ${isConfigured ? '✅' : '❌'}`);
        console.log(`   - Preferred service: ${status.preferredService}`);
        console.log(`   - Python service available: ${status.pythonService.available ? '✅' : '❌'}`);
        console.log(`   - OpenAI configured: ${status.openaiConfigured ? '✅' : '❌'}`);

        if (!isConfigured) {
            console.log('\n❌ No transcription service is properly configured.');
            console.log('   Please ensure either:');
            console.log('   - Python environment with required packages is set up');
            console.log('   - OPENAI_API_KEY is configured');
            return;
        }

        // Create a sample audio file for testing
        console.log('\n2. Creating sample audio file for testing...');
        const sampleAudioPath = await createSampleAudioFile();

        if (!sampleAudioPath) {
            console.log('   ⚠️ Could not create sample audio file, testing with mock data...');

            // Test with mock data
            const mockResult = await testWithMockData(transcriptionService);
            console.log('\n📊 Mock test result:', JSON.stringify(mockResult, null, 2));
            return;
        }

        console.log(`   ✅ Created sample audio file: ${sampleAudioPath}`);

        // Test transcription
        console.log('\n3. Testing transcription...');
        const audioBuffer = fs.readFileSync(sampleAudioPath);

        const result = await transcriptionService.transcribeAudio(audioBuffer, {
            language: 'sv',
            outputFormat: 'json'
        });

        // Display results
        console.log('\n4. Transcription Results');
        console.log('======================');
        console.log(`   - Success: ${result.pipeline === 'python-local' ? '✅' : '⚠️'}`);
        console.log(`   - Pipeline used: ${result.pipeline}`);
        console.log(`   - Language: ${result.language}`);
        console.log(`   - Confidence: ${(result.confidence * 100).toFixed(1)}%`);
        console.log(`   - Speakers detected: ${result.speakers?.length || 0}`);
        console.log(`   - Total words: ${result.totalWords || 0}`);
        console.log(`   - Duration: ${result.duration?.toFixed(2) || 0}s`);

        if (result.segments && result.segments.length > 0) {
            console.log('\n   Sample segments:');
            result.segments.slice(0, 3).forEach((segment, i) => {
                console.log(`     ${i + 1}. "${segment.word}" (${segment.speaker}, ${segment.start?.toFixed(2)}s-${segment.end?.toFixed(2)}s)`);
            });
        }

        if (result.text) {
            console.log(`\n   Transcription text: "${result.text.substring(0, 100)}${result.text.length > 100 ? '...' : ''}"`);
        }

        // Test speaker information extraction
        if (result.segments) {
            console.log('\n5. Speaker Analysis');
            console.log('==================');
            const speakerInfo = transcriptionService.extractSpeakerInfo(result);

            console.log(`   - Unique speakers: ${speakerInfo.speakers.join(', ')}`);
            console.log(`   - Total speakers: ${speakerInfo.speakerCount}`);

            speakerInfo.speakerStats.forEach(stat => {
                console.log(`   - ${stat.speaker}: ${stat.wordCount} words, ${stat.duration.toFixed(1)}s`);
            });
        }

        // Clean up
        if (fs.existsSync(sampleAudioPath)) {
            fs.unlinkSync(sampleAudioPath);
            console.log('\n🧹 Cleaned up sample audio file');
        }

        console.log('\n✅ Transcription pipeline test completed successfully!');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

async function createSampleAudioFile() {
    // For this test, we'll create a simple WAV file header with some dummy audio data
    // In a real scenario, you would use actual audio recording

    const sampleAudioPath = path.join(__dirname, 'test_sample_audio.wav');

    try {
        // Create a minimal WAV file (this is just a header, not real audio data)
        // Real implementation would require actual audio recording or a proper audio file
        const wavHeader = Buffer.alloc(44);

        // WAV header (minimal)
        wavHeader.write('RIFF', 0);                    // RIFF identifier
        wavHeader.writeUInt32LE(36, 4);                 // RIFF chunk size
        wavHeader.write('WAVE', 8);                     // WAVE identifier
        wavHeader.write('fmt ', 12);                    // Format chunk identifier
        wavHeader.writeUInt32LE(16, 16);                // Format chunk size
        wavHeader.writeUInt16LE(1, 20);                 // Audio format (PCM)
        wavHeader.writeUInt16LE(1, 22);                 // Number of channels
        wavHeader.writeUInt32LE(16000, 24);             // Sample rate
        wavHeader.writeUInt32LE(32000, 28);             // Byte rate
        wavHeader.writeUInt16LE(2, 32);                 // Block align
        wavHeader.writeUInt16LE(16, 34);                // Bits per sample
        wavHeader.write('data', 36);                    // Data chunk identifier
        wavHeader.writeUInt32LE(0, 40);                 // Data chunk size

        // Write the header (this creates an empty WAV file)
        fs.writeFileSync(sampleAudioPath, wavHeader);

        return sampleAudioPath;
    } catch (error) {
        console.warn('Failed to create sample audio file:', error.message);
        return null;
    }
}

async function testWithMockData(transcriptionService) {
    console.log('\n📝 Testing with mock transcription data...');

    // Test the speaker extraction and formatting methods
    const mockResult = {
        text: "Det här är ett test av den svenska transkriberingen med flera talare.",
        language: 'sv',
        confidence: 0.95,
        speakers: ['A', 'B'],
        segments: [
            { start: 0.0, end: 1.5, word: 'Det', speaker: 'A', confidence: 0.9 },
            { start: 1.5, end: 2.0, word: 'här', speaker: 'A', confidence: 0.95 },
            { start: 2.0, end: 2.5, word: 'är', speaker: 'A', confidence: 0.92 },
            { start: 2.5, end: 3.5, word: 'ett', speaker: 'B', confidence: 0.88 },
            { start: 3.5, end: 4.5, word: 'test', speaker: 'B', confidence: 0.94 }
        ],
        totalWords: 5,
        duration: 4.5,
        pipeline: 'python-local'
    };

    // Test speaker information extraction
    const speakerInfo = transcriptionService.extractSpeakerInfo(mockResult);
    console.log('Speaker info extracted:', speakerInfo);

    // Test formatting
    const formattedText = transcriptionService.formatTranscriptionResult(mockResult, 'text');
    const formattedMarkdown = transcriptionService.formatTranscriptionResult(mockResult, 'markdown');
    const formattedSpeakers = transcriptionService.formatTranscriptionResult(mockResult, 'speakers');

    console.log('Formatted text:', formattedText);
    console.log('Speaker summary:', formattedSpeakers);

    return {
        speakerInfo,
        formattedText,
        formattedSpeakers,
        success: true
    };
}

// Run the test
if (require.main === module) {
    testTranscriptionPipeline().catch(console.error);
}

module.exports = { testTranscriptionPipeline };