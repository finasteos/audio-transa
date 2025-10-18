'use client';

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";

export default function Home() {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    // Connect to Socket.IO server
    socketRef.current = io('http://localhost:3001');
    
    socketRef.current.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to server');
    });

    socketRef.current.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from server');
    });

    socketRef.current.on('transcriptionChunk', (data) => {
      setTranscription(prev => prev + ' ' + data.text);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      
      // Setup audio level monitoring
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Monitor audio levels
      const monitorAudio = () => {
        if (analyserRef.current && isRecording) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(average);
          requestAnimationFrame(monitorAudio);
        }
      };

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && socketRef.current) {
          socketRef.current.emit('audioChunk', event.data);
        }
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Send chunks every second
      setIsRecording(true);
      monitorAudio();
      
      socketRef.current?.emit('startTranscription', { 
        language: 'sv',
        model: 'medium' 
      });
      
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    setIsRecording(false);
    setAudioLevel(0);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🎤 Audio Transcription
          </h1>
          <p className="text-gray-600">
            Real-time Swedish audio transcription med MLX-Whisper
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-500">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        {/* Recording Controls */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-6">
            {/* Audio Level Indicator */}
            <div className="w-32 h-32 rounded-full border-4 border-blue-200 flex items-center justify-center relative overflow-hidden">
              <div 
                className="absolute inset-0 bg-gradient-to-t from-blue-500 to-blue-300 transition-all duration-150"
                style={{ 
                  transform: `translateY(${100 - (audioLevel / 255) * 100}%)`,
                  opacity: isRecording ? 0.7 : 0
                }}
              ></div>
              <div className="relative z-10">
                {isRecording ? (
                  <div className="text-2xl animate-pulse">🎙️</div>
                ) : (
                  <div className="text-2xl text-gray-400">🎤</div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={!isConnected}
              className={`px-8 py-3 rounded-lg font-semibold transition-all ${
                isRecording 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {isRecording ? '⏹️ Stop Recording' : '🎙️ Start Recording'}
            </Button>
          </div>
        </div>

        {/* Transcription Output */}
        <Card className="p-6 bg-white shadow-lg">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            📝 Live Transcription
          </h2>
          <div className="min-h-[200px] p-4 bg-gray-50 rounded-lg border">
            {transcription ? (
              <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                {transcription}
              </p>
            ) : (
              <p className="text-gray-400 italic">
                {isRecording ? 'Listening for audio...' : 'Click "Start Recording" to begin transcription'}
              </p>
            )}
          </div>
        </Card>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <Card className="p-4 bg-white shadow">
            <h3 className="font-semibold text-gray-700">Status</h3>
            <p className="text-sm text-gray-500">
              {isRecording ? 'Recording...' : 'Ready'}
            </p>
          </Card>
          <Card className="p-4 bg-white shadow">
            <h3 className="font-semibold text-gray-700">Audio Level</h3>
            <p className="text-sm text-gray-500">
              {Math.round((audioLevel / 255) * 100)}%
            </p>
          </Card>
          <Card className="p-4 bg-white shadow">
            <h3 className="font-semibold text-gray-700">Language</h3>
            <p className="text-sm text-gray-500">Swedish (sv)</p>
          </Card>
        </div>
      </div>
    </main>
  );
}