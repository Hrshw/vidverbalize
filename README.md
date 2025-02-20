# VidVerbalize

VidVerbalize is a tool that processes video content to create short, captioned clips (e.g., 15-second shorts) using AI-powered transcription and video segmentation. It leverages the ChatGPT API for generating or refining captions, Python for video processing, and Node.js for additional functionality or API integration.

## Features
- Accepts a video URL or uploaded video file as input.
- Segments the video into short clips (e.g., 15 seconds) suitable for platforms like YouTube Shorts or TikTok.
- Generates captions for each clip using the ChatGPT API.
- Combines video processing and captioning into an automated workflow.

## Technologies Used
- **Python**: For video processing and segmentation (e.g., using libraries like `ffmpeg-python` or `moviepy`).
- **Node.js**: For handling API requests, server-side logic, or frontend integration.
- **ChatGPT API**: For generating or enhancing captions based on video audio.
- **FFmpeg** (optional): For efficient video splitting and manipulation.

## How It Works
1. **Input**: Provide a video URL or upload a video file.
2. **Processing**: The tool uses Python to split the video into smaller segments (default: 15 seconds).
3. **Transcription**: Audio from each segment is extracted and sent to the ChatGPT API to generate captions.
4. **Output**: The tool combines each video segment with its corresponding captions, producing ready-to-share shorts.

## Prerequisites
- Python 3.8+ installed
- Node.js 18+ installed
- ChatGPT API key (sign up via OpenAI and obtain an API key)
- FFmpeg installed (optional, for video processing)

## Installation
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/Hrshw/vidverbalize.git
   cd vidverbalize
