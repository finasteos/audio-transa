#!/usr/bin/env python3
"""
Swedish Audio Transcription Pipeline
Implements the three-step pipeline for high-accuracy Swedish transcription with speaker diarization:
1. Whisper-timestamped for word-level timestamps
2. Pyannote.audio for speaker diarization
3. Merge results to assign speaker labels to words
"""

import argparse
import json
import os
import sys
import ssl
from pathlib import Path
import whisper_timestamped as wt
from pyannote.audio import Pipeline
import torch
import numpy as np

# Handle SSL certificate issues
ssl._create_default_https_context = ssl._create_unverified_context


class SwedishTranscriptionPipeline:
    def __init__(self, hf_token=None):
        self.hf_token = hf_token or os.getenv('HF_TOKEN')
        self.device = "cuda" if torch.cuda.is_available() else "cpu"

        # Initialize models
        self.whisper_model = None
        self.diarization_pipeline = None

    def load_models(self):
        """Load Whisper and diarization models"""
        self.whisper_model = wt.load_model("large-v3", device=self.device)

        if self.hf_token:
            self.diarization_pipeline = Pipeline.from_pretrained(
                "pyannote/speaker-diarization-3.1",
                use_auth_token=self.hf_token
            )
            if self.device == "cuda":
                self.diarization_pipeline = self.diarization_pipeline.to(torch.device("cuda"))
        else:
            raise ValueError("HuggingFace token required for diarization. Set HF_TOKEN environment variable.")

    def transcribe_audio(self, audio_path, language="sv"):
        """Step 1: Transcribe with word-level timestamps"""
        if not self.whisper_model:
            self.load_models()

        result = wt.transcribe(
            self.whisper_model,
            audio=audio_path,
            language=language,
            vad="silero",
            compute_word_confidence=True,
            detect_disfluencies=True
        )

        return result

    def diarize_audio(self, audio_path):
        """Step 2: Speaker diarization"""
        if not self.diarization_pipeline:
            self.load_models()

        diarization = self.diarization_pipeline(audio_path)
        return diarization

    def merge_transcription_and_diarization(self, transcription_result, diarization_result):
        """Step 3: Merge words with speaker labels"""

        merged_segments = []

        for segment in transcription_result["segments"]:
            for word in segment["words"]:
                word_midpoint = (word["start"] + word["end"]) / 2

                # Find the speaker active at this midpoint
                speaker_label = "Unknown"
                for turn, _, speaker in diarization_result.itertracks(yield_label=True):
                    if turn.start <= word_midpoint <= turn.end:
                        speaker_label = speaker
                        break

                merged_word = {
                    "start": word["start"],
                    "end": word["end"],
                    "word": word["text"],
                    "speaker": speaker_label,
                    "confidence": word.get("confidence", 1.0)
                }
                merged_segments.append(merged_word)

        return merged_segments

    def format_timestamp(self, seconds):
        """Format seconds as HH:MM:SS.mmm"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        seconds = seconds % 60
        return f"{hours:02d}:{minutes:02d}:{seconds:06.3f}"

    def generate_markdown_output(self, merged_segments):
        """Generate human-friendly Markdown output"""

        markdown_lines = []
        current_speaker = None

        for word_info in merged_segments:
            speaker = word_info["speaker"]
            start_time = self.format_timestamp(word_info["start"])
            end_time = self.format_timestamp(word_info["end"])
            word = word_info["word"]

            if speaker != current_speaker:
                if current_speaker is not None:
                    markdown_lines.append("")
                markdown_lines.append(f"**{speaker}  {start_time}-{end_time}**  {word}")
                current_speaker = speaker
            else:
                # Continue the line for same speaker
                markdown_lines[-1] += f" {word}"

        return "\n".join(markdown_lines)

    def process_audio_file(self, audio_path, output_format="json"):
        """Main processing function"""
        try:
            # Validate input file
            if not os.path.exists(audio_path):
                raise FileNotFoundError(f"Audio file not found: {audio_path}")

            # Processing audio file

            # Step 1: Transcription
            transcription_result = self.transcribe_audio(audio_path, language="sv")

            # Step 2: Diarization
            diarization_result = self.diarize_audio(audio_path)

            # Step 3: Merge
            merged_segments = self.merge_transcription_and_diarization(
                transcription_result, diarization_result
            )

            # Prepare output
            output = {
                "success": True,
                "audio_file": audio_path,
                "total_words": len(merged_segments),
                "segments": merged_segments,
                "speakers": list(set(word["speaker"] for word in merged_segments)),
                "duration": merged_segments[-1]["end"] if merged_segments else 0,
                "markdown": self.generate_markdown_output(merged_segments)
            }

            if output_format.lower() == "markdown":
                return output["markdown"]
            else:
                return json.dumps(output, indent=2, ensure_ascii=False)

        except Exception as e:
            error_output = {
                "success": False,
                "error": str(e),
                "audio_file": audio_path
            }
            return json.dumps(error_output, indent=2, ensure_ascii=False)


def main():
    parser = argparse.ArgumentParser(description="Swedish Audio Transcription Pipeline")
    parser.add_argument("audio_file", help="Path to audio file to transcribe")
    parser.add_argument("--output", "-o", default="json",
                       choices=["json", "markdown"],
                       help="Output format (default: json)")
    parser.add_argument("--hf-token", help="HuggingFace token for diarization model")

    args = parser.parse_args()

    # Create pipeline instance
    pipeline = SwedishTranscriptionPipeline(hf_token=args.hf_token)

    # Process the audio file
    result = pipeline.process_audio_file(args.audio_file, args.output)

    # Output result
    print(result)


if __name__ == "__main__":
    main()