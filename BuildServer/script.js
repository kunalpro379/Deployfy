import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import mime from 'mime-types';

// Correct S3 client initialization
const s3Client = new S3Client({
  region: 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const project_id = process.env.PROJECT_ID;

// Workaround for __dirname in ES modules
const __dirname = path.dirname(new URL(import.meta.url).pathname);

async function init() {
  console.log('Executing script.js');
  const outDirPath = path.join(__dirname, 'output');
  
  const p = exec(`cd ${outDirPath} && npm install && npm run build`);
  p.stdout.on('data', function(data) {
    console.log(data.toString());
  });
  p.stdout.on('error', function(data) {
    console.error(data.toString());
  });

  p.on('close', async function() {
    console.log('Build completed...');
    console.log(fs.readdirSync(outDirPath));

    const buildFolderPath = path.join(__dirname, 'output', 'build'); // Use 'build' instead of 'dist'
    
    // Check if the build folder exists
    if (!fs.existsSync(buildFolderPath)) {
      console.error('Error: build directory does not exist.');
      return;
    }
  
    const buildFolderContents = fs.readdirSync(buildFolderPath, { recursive: true });
  
    for (const file of buildFolderContents) {
      const filePath = path.join(buildFolderPath, file);
      if (fs.lstatSync(filePath).isDirectory()) continue;
  
      const command = new PutObjectCommand({
        Bucket: 'testdeploybucket-kunal',
        Key: `__outputs/${project_id}/${file}`,
        Body: fs.createReadStream(filePath),
        ContentType: mime.lookup(filePath),
      });
  
      try {
        await s3Client.send(command);
        console.log(`Uploaded: ${file}`);
      } catch (err) {
        console.error(`Error uploading ${file}: ${err}`);
      }
    }
  });
  
}

init();
