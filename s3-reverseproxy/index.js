import express from 'express';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { EC2Client, AuthorizeSecurityGroupIngressCommand } from '@aws-sdk/client-ec2';
import portfinder from 'portfinder';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();

// AWS Configuration
const REGION = process.env.AWS_DEFAULT_REGION || "ap-south-1";
const ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID; // Set in environment
const SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY; // Set in environment
const BUCKET_NAME = process.env.BUCKET_NAME || 'testdeploybucket-kunal';
const SECURITY_GROUP_ID = process.env.SECURITY_GROUP_ID; // Set your Security Group ID in environment
const BASE_DIR = "./"; // Base directory to store projects

const s3Client = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});

const ec2Client = new EC2Client({
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});

const serveProcesses = new Map();

// Function to add port to AWS Security Group
async function addPortToSecurityGroup(port) {
  try {
    const addPortRuleCommand = new AuthorizeSecurityGroupIngressCommand({
      GroupId: SECURITY_GROUP_ID,
      IpPermissions: [
        {
          IpProtocol: "tcp",
          FromPort: port,
          ToPort: port,
          IpRanges: [{ CidrIp: "0.0.0.0/0" }],
        },
      ],
    });

    await ec2Client.send(addPortRuleCommand);
    console.log(`Port ${port} added to Security Group ${SECURITY_GROUP_ID}`);
  } catch (err) {
    if (err.Code === "InvalidPermission.Duplicate") {
      console.log(`Port ${port} is already allowed in the Security Group.`);
    } else {
      throw err;
    }
  }
}

// Function to download files from S3
async function downloadFromS3(folder, localPath) {
  fs.mkdirSync(localPath, { recursive: true });

  const listCommand = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: `__outputs/${folder}/`,
  });

  const { Contents } = await s3Client.send(listCommand);

  if (!Contents || Contents.length === 0) {
    throw new Error(`No files found in S3 folder: ${folder}`);
  }

  console.log(`Downloading folder: ${folder}`);
  const downloadPromises = Contents.map(async (file) => {
    const fileKey = file.Key;
    const filePath = path.join(localPath, fileKey.replace(`__outputs/${folder}/`, ""));

    const fileDir = path.dirname(filePath);
    fs.mkdirSync(fileDir, { recursive: true });

    const getObjectCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
    });

    const fileStream = fs.createWriteStream(filePath);
    const s3Response = await s3Client.send(getObjectCommand);

    return new Promise((resolve, reject) => {
      s3Response.Body.pipe(fileStream)
        .on("finish", resolve)
        .on("error", reject);
    });
  });

  await Promise.all(downloadPromises);
  console.log(`Downloaded folder to ${localPath}`);
}

// Function to serve a project on a random port
async function serveProject(folder) {
  const projectPath = path.join(BASE_DIR, folder);
  if (!fs.existsSync(projectPath)) {
    throw new Error(`Project folder does not exist: ${projectPath}`);
  }

  const port = await portfinder.getPortPromise();
  console.log(`Using port: ${port} for serving project: ${folder}`);

  // Add the port to AWS Security Group
  await addPortToSecurityGroup(port);

  // Start the server
  const serveCommand = `npx serve -s ${projectPath} -l ${port}`;
  const serveProcess = exec(serveCommand, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error serving project: ${error.message}`);
    }
    if (stdout) {
      console.log(`Serve stdout: ${stdout}`);
    }
    if (stderr) {
      console.error(`Serve stderr: ${stderr}`);
    }
  });

  serveProcesses.set(port, serveProcess);
  console.log(`Serving project at http://localhost:${port}`);
  return port;
}

const projectProxies = new Map(); // Keep track of active proxies

app.post("/deploy/:project", async (req, res) => {
  const project = req.params.project;
  try {
    const localPath = path.join(BASE_DIR, project);
    await downloadFromS3(project, localPath);
    const port = await serveProject(project);

    const proxyUrl = `http://127.0.0.1:${port}`;
    if (!projectProxies.has(project)) {
      app.use(`/project/${project}`, createProxyMiddleware({ target: proxyUrl, changeOrigin: true }));
      projectProxies.set(project, port);
    }

    res.status(200).json({
      message: `Project served at port ${port}`,
      url: `http://deployfy/project/${project}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Start the Express server
const PORT = process.env.PORT || 9080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
