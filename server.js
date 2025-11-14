const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// Railway ke liye important
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check - Railway ke liye must hai
app.get('/health', (req, res) => {
  console.log('Health check passed');
  res.status(200).json({ 
    status: 'OK', 
    message: 'Pakistan Chat Server is healthy',
    timestamp: new Date().toISOString()
  });
});

// Main route
app.get('/', (req, res) => {
  console.log('Root route accessed');
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Pakistan Room 60</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: Arial, sans-serif;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: white;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            text-align: center;
        }
        .container {
            background: rgba(255,255,255,0.1);
            padding: 40px;
            border-radius: 15px;
            backdrop-filter: blur(10px);
        }
        h1 {
            margin-bottom: 20px;
            font-size: 2.5em;
        }
        p {
            font-size: 1.2em;
            margin: 10px 0;
        }
        .success {
            color: #4CAF50;
            font-weight: bold;
            font-size: 1.5em;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🟢 Pakistan Room 60</h1>
        <p class="success">✅ Chat Room Successfully Deployed!</p>
        <p>Server is running on Railway</p>
        <p>Your chat application is ready to use!</p>
        <p><strong>🎉 Congratulations! Deployment Successful</strong></p>
    </div>
</body>
</html>
  `);
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Server start with proper error handling
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Pakistan Chat Server started successfully!');
  console.log('📍 Port:', PORT);
  console.log('🕒 Started at:', new Date().toISOString());
  console.log('✅ Health check available at /health');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});
