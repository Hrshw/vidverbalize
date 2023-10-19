import argparse
import os
from moviepy.editor import VideoFileClip, TextClip, CompositeVideoClip
import requests
import random
import string
import shutil
from pymongo import MongoClient
from datetime import datetime, timedelta
import boto3  # Import the AWS SDK

# Set your AWS credentials and S3 bucket name
aws_access_key_id = 'AKIAVFWDH4ZANUPQHWME'
aws_secret_access_key = 'qwKMgSE5/5/vykAf0HDrJfg/V8qfoKYu6KLoVVxF'
s3_bucket_name = 'vid-storages'

# Create an S3 client
s3 = boto3.client('s3', aws_access_key_id=aws_access_key_id, aws_secret_access_key=aws_secret_access_key)

# Set your MongoDB connection details
mongo_client = MongoClient("mongodb+srv://rahul:RSsmy11ssm@formbuilder.t0jplog.mongodb.net/ourproduct")
db = mongo_client.get_database()
videos = db.videos

# Function to generate a random string for the output filename
def random_string(length=10):
    letters = string.ascii_lowercase
    return ''.join(random.choice(letters) for _ in range(length))

# Function to transcribe audio using OpenAI Whisper API
def transcribe_audio(audio_file_path):
    # model_id = 'whisper-1'

    # with open(audio_file_path, 'rb') as audio_file:
    #     response = openai.Audio.transcribe(
    #         api_key=openai.api_key,
    #         model=model_id,
    #         file=audio_file
    #     )

    # return response['text']
    return "This is a placeholder transcription. Uncomment the OpenAI API call to transcribe the audio."

# Function to download a video in the best quality available
def download_video(url):
    try:
        os.makedirs('temp', exist_ok=True)  # Create the 'temp' directory if it doesn't exist

        if "youtube.com" in url or "youtu.be" in url:
            # Download YouTube videos using pytube
            from pytube import YouTube

            yt = YouTube(url)
            # Get the highest quality stream available
            stream = yt.streams.get_highest_resolution()

            if stream:
                # Generate a temporary file name for the video
                video_filename = f"{random_string()}.mp4"
                video_path = os.path.join('temp', video_filename)

                # Download and save the video to the 'temp' directory
                stream.download(output_path='temp', filename=video_filename)
            else:
                raise Exception("No valid stream found for this video.")
        else:
            response = requests.get(url)
            if response.status_code == 200:
                # Generate a temporary file name based on the URL
                video_filename = url.split("/")[-1] + ".mp4"
                video_path = os.path.join('temp', video_filename)
                with open(video_path, "wb") as video_file:
                    video_file.write(response.content)
            else:
                raise Exception(f"Failed to download video from URL: {url}")
    except requests.exceptions.RequestException as e:
        raise Exception(f"Error downloading video from URL: {str(e)}")

    return video_path

# Function to upload a file to AWS S3
def upload_to_s3(file_path, s3_key):
    s3.upload_file(file_path, s3_bucket_name, s3_key)

# Function to process the video and save it to AWS S3, store S3 URL in MongoDB
def process_video(input_path, max_video_duration=90, user_id=None):
    video_clip = VideoFileClip(input_path)
    total_duration = video_clip.duration
    num_segments = int(total_duration / max_video_duration) + 1

    # Transcribe the entire video's audio
    audio_clip = video_clip.audio
    temp_audio_file_path = 'temp/audio.mp3'
    audio_clip.write_audiofile(temp_audio_file_path, codec='mp3')
    audio_transcription = transcribe_audio(temp_audio_file_path)

    for segment_index in range(num_segments):
        segment_start_time = segment_index * max_video_duration
        segment_end_time = min((segment_index + 1) * max_video_duration, total_duration)
        print(f"Segment {segment_index + 1}: Start time: {segment_start_time}, End time: {segment_end_time}")

        # Check if the segment's duration is zero
        if segment_start_time >= total_duration:
            continue

        # Limit the segment duration to 15 seconds
        if segment_end_time - segment_start_time > 15:
            segment_end_time = segment_start_time + 15

        # Trim the video segment
        video_segment = video_clip.subclip(segment_start_time, segment_end_time)

        # Extract audio for this segment
        audio_segment = audio_clip.subclip(segment_start_time, segment_end_time)

        # Transcribe audio for this segment
        temp_segment_audio_path = f'temp/segment_{segment_index}_audio.mp3'
        audio_segment.write_audiofile(temp_segment_audio_path, codec='mp3')
        audio_segment_transcription = transcribe_audio(temp_segment_audio_path)

        # Create a TextClip with the transcription for this segment
        text_clip = TextClip(audio_segment_transcription, fontsize=28, color="white")
        text_clip = text_clip.set_position(("center", "bottom")).set_start(0).set_duration(video_segment.duration)

        # Overlay the text clip onto the video segment
        video_with_text = CompositeVideoClip([video_segment, text_clip])

        unique_title = random_string()
        short_video_path = os.path.join('temp', f"{unique_title}.mp4")

        video_with_text.write_videofile(short_video_path, codec='libx264', audio_codec='aac', remove_temp=True)

        # Upload the video to AWS S3
        s3_key = f"videos/{unique_title}.mp4"
        upload_to_s3(short_video_path, s3_key)

        # Store the S3 URL in MongoDB
        s3_url = f"https://{s3_bucket_name}.s3.amazonaws.com/{s3_key}"
        video_doc = {
            "title": unique_title,
            "video_url": s3_url,  # Store the S3 URL
            "expiry_time": datetime.now() + timedelta(minutes=2),
            "user_id": user_id  # Associate the video with the user
        }
        videos.insert_one(video_doc)

    # Check if the temporary file exists
    if os.path.exists('TEMP_MPY_wvf_snd.mp4'):
        # Delete the temporary file
        os.remove('TEMP_MPY_wvf_snd.mp4')

def main():
    parser = argparse.ArgumentParser(description="Download and process a video")
    parser.add_argument("--input", required=True, help="Video source (URL or local file path)")
    parser.add_argument("--duration", required=True, type=float, help="Duration of each segment (in seconds)")
    parser.add_argument("--user-id", required=True, type=str, help="User ID for video association")
    args = parser.parse_args()

    input_source = args.input
    duration = args.duration
    user_id = args.user_id  # Get the user's ID from command-line arguments

    if input_source.startswith("http") or input_source.startswith("www"):
        input_video_path = download_video(input_source)
    else:
        if not os.path.exists(input_source):
            print("Error: The specified input file does not exist.")
            return
        input_video_path = input_source

    process_video(input_video_path, max_video_duration=duration, user_id=user_id)

    # Remove the 'temp' directory and its contents
    shutil.rmtree('temp')

if __name__ == "__main__":
    main()
