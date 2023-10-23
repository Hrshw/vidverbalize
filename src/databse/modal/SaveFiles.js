const mongoose = require('mongoose');

// Define the Video schema
const videoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  video_url: {
    type: String,
    required: true,
  },

  expiry_time:{

  },
  user_id: {
    type: String, // Assuming user_id is stored as a string
    required: true,
  },
});

// Create the Video model
const Video = mongoose.model('Video', videoSchema);

module.exports = Video;
