require('dotenv').config();
const express = require('express');
const util = require('util');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const flash = require('express-flash');
const bcrypt = require('bcrypt');
const fs = require('fs');
const multer = require('multer');
const bodyParser = require('body-parser');
const isAuthenticated = require('./src/middleware/authMiddleware');
const mongoose = require('./src/databse/db_conn/db_conn');
const User = require('./src/databse/modal/user_model');
const Video = require('./src/databse/modal/SaveFiles');
const { spawn } = require('child_process');
const hbs = require('hbs');
const app = express();
const moment = require('moment');
const cors = require('cors'); 
const port = process.env.PORT || 3000;

// Initialize passport and session
app.use(session({
  secret: process.env.SECRET_KEY,
  resave: false,
  saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());

// Add express-flash middleware
app.use(flash());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Set up Handlebars as the template engine
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, './src/views'));

// Configure multer to upload video files
const upload = multer({
  dest: './temp/',
});

// Use the CORS middleware
app.use(cors());

// Passport configuration
passport.use(new LocalStrategy(
  { usernameField: 'email', passwordField: 'password' },
  async (email, password, done) => {
    try {
      const user = await User.findOne({ email: email });
      if (!user) {
        return done(null, false, { message: 'Incorrect email.' });
      }
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return done(null, false, { message: 'Incorrect password.' });
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id)
    .then((user) => {
      done(null, user);
    })
    .catch((err) => {
      done(err, null);
    });
});

app.get('/signup', (req, res) => {
  res.render('signup');
});

// Sign up - Route for handling user registration
app.post('/sign-up', async (req, res) => {
  try {
    const { email, password } = req.body;

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).send('Email is already in use.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({ email, password: hashedPassword });

    await newUser.save();

    res.redirect('/login');
  } catch (error) {
    console.error('Error during signup:', error);
    res.status(500).send('Error during signup');
  }
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', (req, res, next) => {
  passport.authenticate('local', {
    successRedirect: '/Home',
    failureRedirect: '/login',
    failureFlash: true,
    successFlash: 'Welcome!',
  })(req, res, next);
});

app.get('/Home', isAuthenticated, async (req, res) => {
  // Fetch the user's processed videos
  try {
    const videos = await Video.find({ user_id: req.user.id });
    // You can format or process the videos as needed here

    // Render the "Home" page with the videos
    res.render('filesupload', { user: req.user, videos });
  } catch (error) {
    console.error('Error retrieving videos:', error);
    res.status(500).send('Error retrieving videos');
  }
});


app.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/login');
});


// Route for processing video inputs
app.post('/process-video', upload.single('videoFile'), isAuthenticated, (req, res) => {
  const duration = req.body.duration || 15; // Default to 15 seconds
  const videoSource = req.file ? req.file.path : req.body.videoUrl;
  const userId = req.user.id; // Get the user's ID
  let message = '';
// Send an immediate response indicating that video processing has started
res.status(202).json({ message: 'Video processing started. Please wait...' });
  if (!videoSource) {
    return res.status(400).json({ error: 'No video source provided' });
  }

   // Check video duration and set the message
   if (duration < 90) {
    message = 'Video is too long. Using the first 90 seconds for processing.';
  }
  // Initialize a flag to track whether an error occurred
  let errorOccurred = false;

  // Spawn the Python script to process the video
  const pythonProcess = spawn('python', [
    'video_trim_script.py',
    '--input', videoSource,
    '--duration', duration,
    '--user-id', userId
  ]);

  
  // Handle the Python script's output and errors
  pythonProcess.stdout.on('data', (data) => {
    console.log(`Python script output: ${data}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`Python script error: ${data}`);
    errorOccurred = true; // Set the error flag
  });

  pythonProcess.on('close', (code) => {
    if (code === 0 && !errorOccurred) {
      console.log('Python script successfully completed');
      res.status(200).json({ message: 'Video processed and saved' });
    } else {
      console.error(`Python script exited with code ${code}`);
      if (!errorOccurred) {
        res.status(500).json({ error: 'Error processing video' });
      }
    }
  });
});


app.get('/video', isAuthenticated, async (req, res) => {
  try {
    const videos = await Video.find({ user_id: req.user.id });
    // Format the dates using moment and provide a default video URL
    videos.forEach((video) => {
      video.formattedExpiryTime = moment(video.expiry_time).format('YYYY-MM-DD HH:mm:ss');
      video.video_url = video.video_url || 'No video URL available';
    });

    console.log('Data passed to the template:', videos); // Log the data
    res.render('short-video', { videos, user: req.user });
  } catch (error) {
    console.error('Error retrieving videos:', error);
    res.status(500).send('Error retrieving videos');
  }
});


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
