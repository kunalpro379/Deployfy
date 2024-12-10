const express = require('express');
const { spawn } = require('child_process');

const app = express();
const port = 7000; // The server's port to handle requests

// Route for '/kunal'
app.get('/kunal', (req, res) => {
  const serveKunal = spawn('serve', ['-s', 'kunal', '-l', '44433']);

  serveKunal.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
  });

  serveKunal.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
  });

  serveKunal.on('close', (code) => {
    console.log(`serve process exited with code ${code}`);
  });

  res.send('Serving kunal at port 44433');
});

// Route for '/cookmom'
app.get('/cookmom', (req, res) => {
  const serveCookmom = spawn('serve', ['-s', 'cookmom', '-l', '4422']);
  console.log(serveCookmom);


  serveCookmom.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
  });

  serveCookmom.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
  });

  serveCookmom.on('close', (code) => {
    console.log(`serve process exited with code ${code}`);
  });

  res.send('Serving cookmom at port 4432');
});

// Start the main server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
const express = require('express');
const { exec } = require('child_process');

const app = express();
const port = 7000; // The server's port to handle requests

// Route for '/kunal'
app.get('/kunal', (req, res) => {
  exec('serve -s kunal -l 44433', (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return res.status(500).send(`Error: ${error.message}`);
    }

    if (stderr) {
      console.error(`stderr: ${stderr}`);
    }

    console.log(`stdout: ${stdout}`);
    res.send(stdout); // Send stdout response to the client
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
