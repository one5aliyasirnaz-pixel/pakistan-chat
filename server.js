const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is healthy' });
});

// Main route - SIMPLE HTML
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Pakistan Room 60</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    background: #1e3c72;
                    color: white;
                    text-align: center;
                    padding: 50px;
                    margin: 0;
                }
                .container {
                    background: rgba(255,255,255,0.1);
                    padding: 30px;
                    border-radius: 10px;
                    display: inline-block;
                }
                h1 {
                    margin-bottom: 20px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🟢 Pakistan Room 60</h1>
                <p>✅ Chat Server is WORKING!</p>
                <p>Deployment Successful! 🎉</p>
            </div>
        </body>
        </html>
    `);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('✅ Pakistan Chat Server running on port ' + PORT);
});
