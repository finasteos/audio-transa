// DOM Elements
const recordBtn = document.getElementById('recordBtn');
const stopBtn = document.getElementById('stopBtn');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const timer = document.getElementById('timer');
const transcriptionArea = document.getElementById('transcriptionArea');
const clearBtn = document.getElementById('clearBtn');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const languageSelect = document.getElementById('languageSelect');

// State variables
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let startTime = null;
let timerInterval = null;
let socket = null;
let currentTranscription = '';

// Initialize the application
document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
    // Connect to Socket.IO server
    socket = io();

    // Set up event listeners
    setupEventListeners();

    // Set up Socket.IO event listeners
    setupSocketListeners();

    // Request microphone permission on load
    requestMicrophonePermission();
}

function setupEventListeners() {
    recordBtn.addEventListener('click', startRecording);
    stopBtn.addEventListener('click', stopRecording);
    clearBtn.addEventListener('click', clearTranscription);
    copyBtn.addEventListener('click', copyTranscription);
    downloadBtn.addEventListener('click', downloadTranscription);
    languageSelect.addEventListener('change', handleLanguageChange);
}

function setupSocketListeners() {
    socket.on('connect', () => {
        console.log('Connected to server');
        updateStatus('ready', 'Connected to server');
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        updateStatus('disconnected', 'Disconnected from server');
    });

    socket.on('recording-status', (data) => {
        if (data.status === 'recording') {
            updateStatus('recording', 'Recording...');
        }
    });

    socket.on('transcription-result', (data) => {
        console.log('Transcription result:', data);
        displayTranscription(data.transcription, data.timestamp);
    });

    socket.on('transcription-error', (data) => {
        console.error('Transcription error:', data);
        updateStatus('error', 'Transcription failed');
        showError('Transcription error: ' + data.error);
    });
}

async function requestMicrophonePermission() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            }
        });

        // Stop the stream immediately, we'll start it when recording
        stream.getTracks().forEach(track => track.stop());

        updateStatus('ready', 'Ready to record');
    } catch (error) {
        console.error('Microphone permission denied:', error);
        updateStatus('error', 'Microphone access denied');
        showError('Microphone access is required for audio transcription.');
    }
}

async function startRecording() {
    if (isRecording) return;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            }
        });

        isRecording = true;
        audioChunks = [];
        startTime = Date.now();

        // Set up MediaRecorder
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus'
        });

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            sendAudioForTranscription(audioBlob);
            stream.getTracks().forEach(track => track.stop());
        };

        // Start recording
        mediaRecorder.start(100); // Collect data every 100ms
        updateRecordingUI(true);
        startTimer();

        // Notify server
        socket.emit('start-recording');

    } catch (error) {
        console.error('Error starting recording:', error);
        showError('Failed to start recording: ' + error.message);
    }
}

function stopRecording() {
    if (!isRecording || !mediaRecorder) return;

    isRecording = false;
    mediaRecorder.stop();
    updateRecordingUI(false);
    stopTimer();
    updateStatus('processing', 'Processing audio...');
}

function sendAudioForTranscription(audioBlob) {
    const reader = new FileReader();

    reader.onloadend = () => {
        const base64Audio = reader.result.split(',')[1];

        socket.emit('stop-recording', {
            audioBlob: base64Audio,
            language: languageSelect.value,
            timestamp: new Date().toISOString()
        });
    };

    reader.readAsDataURL(audioBlob);
}

function displayTranscription(transcription, timestamp) {
    const transcriptionText = transcription.text || transcription;

    if (!currentTranscription) {
        currentTranscription = transcriptionText;
        updateTranscriptionArea(transcriptionText);
    } else {
        currentTranscription += ' ' + transcriptionText;
        updateTranscriptionArea(currentTranscription);
    }

    updateStatus('ready', 'Transcription updated');
}

function updateTranscriptionArea(text) {
    const placeholder = transcriptionArea.querySelector('.placeholder');
    if (placeholder) {
        placeholder.remove();
    }

    transcriptionArea.classList.add('has-content');

    let content = transcriptionArea.querySelector('.transcription-content');
    if (!content) {
        content = document.createElement('div');
        content.className = 'transcription-content';
        transcriptionArea.appendChild(content);
    }

    content.textContent = text;

    // Enable control buttons
    copyBtn.disabled = false;
    downloadBtn.disabled = false;
}

function clearTranscription() {
    currentTranscription = '';
    transcriptionArea.classList.remove('has-content');
    transcriptionArea.innerHTML = `
        <div class="placeholder">
            <i class="fas fa-comment-dots"></i>
            <p>Your transcribed text will appear here...</p>
        </div>
    `;

    copyBtn.disabled = true;
    downloadBtn.disabled = true;
}

function copyTranscription() {
    if (!currentTranscription) return;

    navigator.clipboard.writeText(currentTranscription).then(() => {
        showNotification('Text copied to clipboard!', 'success');
    }).catch(() => {
        showError('Failed to copy text to clipboard');
    });
}

function downloadTranscription() {
    if (!currentTranscription) return;

    const blob = new Blob([currentTranscription], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcription_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showNotification('Transcription downloaded!', 'success');
}

function updateRecordingUI(recording) {
    if (recording) {
        recordBtn.disabled = true;
        stopBtn.disabled = false;
        statusIndicator.classList.add('recording');
    } else {
        recordBtn.disabled = false;
        stopBtn.disabled = true;
        statusIndicator.classList.remove('recording');
    }
}

function updateStatus(type, message) {
    statusIndicator.className = `status-indicator ${type}`;
    statusText.textContent = message;
}

function startTimer() {
    timerInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const seconds = Math.floor(elapsed / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        timer.textContent = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    timer.textContent = '00:00';
}

function handleLanguageChange() {
    if (isRecording) {
        showNotification(`Language changed to: ${languageSelect.options[languageSelect.selectedIndex].text}`, 'info');
    }
}

function showError(message) {
    showNotification(message, 'error');
}

function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'error' ? 'exclamation-triangle' : type === 'success' ? 'check-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 4000);
}