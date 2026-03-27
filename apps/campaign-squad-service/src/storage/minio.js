const {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand
} = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

let cachedClient = null;
let bucketEnsured = false;
let bucketPolicyEnsured = false;

function getEnvConfig() {
  const endpoint = (process.env.MINIO_ENDPOINT || '').trim();
  const accessKeyId = (process.env.MINIO_ACCESS_KEY || '').trim();
  const secretAccessKey = (process.env.MINIO_SECRET_KEY || '').trim();
  const bucket = (process.env.MINIO_BUCKET || '').trim();
  const region = (process.env.MINIO_REGION || 'us-east-1').trim();
  const useSsl = (process.env.MINIO_USE_SSL || '').trim().toLowerCase() === 'true';
  const publicBaseUrl = (process.env.MINIO_PUBLIC_BASE_URL || '').trim().replace(/\/$/, '');
  const bucketPublicRead = (process.env.MINIO_BUCKET_PUBLIC_READ || '').trim().toLowerCase() === 'true';

  return {
    endpoint,
    accessKeyId,
    secretAccessKey,
    bucket,
    region,
    useSsl,
    publicBaseUrl,
    bucketPublicRead
  };
}

function ensureConfig(config) {
  if (!config.endpoint || !config.accessKeyId || !config.secretAccessKey || !config.bucket) {
    throw new Error('MinIO is not fully configured. Required: MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET.');
  }
}

function getClient() {
  if (cachedClient) return cachedClient;

  const config = getEnvConfig();
  ensureConfig(config);

  cachedClient = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    },
    tls: config.useSsl
  });

  return cachedClient;
}

async function ensureBucketExists(client, bucket) {
  if (bucketEnsured) return;

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    bucketEnsured = true;
    return;
  } catch (_error) {
    // try create below
  }

  await client.send(new CreateBucketCommand({ Bucket: bucket }));
  bucketEnsured = true;
}

async function ensureBucketPolicy(client, bucket, bucketPublicRead) {
  if (!bucketPublicRead || bucketPolicyEnsured) return;

  const policy = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${bucket}/*`]
      }
    ]
  };

  await client.send(new PutBucketPolicyCommand({
    Bucket: bucket,
    Policy: JSON.stringify(policy)
  }));
  bucketPolicyEnsured = true;
}

function normalizeFileName(fileName) {
  if (!fileName) return 'creative.bin';
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'creative.bin';
}

function parseDataUrl(input) {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(input || '');
  if (!match) {
    throw new Error('Invalid dataUrl payload.');
  }
  const mimeType = match[1] || 'application/octet-stream';
  const base64Payload = match[2] || '';
  const buffer = Buffer.from(base64Payload, 'base64');
  return { buffer, mimeType };
}

function buildObjectKey({ organizationId, clientId, fileName }) {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const normalizedFile = normalizeFileName(fileName);
  return `ready-creatives/${organizationId || 'default'}/${clientId || 'general'}/${y}/${m}/${d}/${uuidv4()}-${normalizedFile}`;
}

async function uploadReadyCreative({ organizationId, clientId, fileName, mimeType, dataUrl }) {
  const config = getEnvConfig();
  ensureConfig(config);

  if (!dataUrl || typeof dataUrl !== 'string') {
    throw new Error('dataUrl is required for MinIO upload.');
  }

  const { buffer, mimeType: parsedMimeType } = parseDataUrl(dataUrl);
  const contentType = mimeType || parsedMimeType || 'application/octet-stream';
  const key = buildObjectKey({ organizationId, clientId, fileName });

  const client = getClient();
  await ensureBucketExists(client, config.bucket);
  await ensureBucketPolicy(client, config.bucket, config.bucketPublicRead);

  await client.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType
  }));

  const s3Url = `s3://${config.bucket}/${key}`;
  const publicUrl = config.publicBaseUrl
    ? `${config.publicBaseUrl}/${config.bucket}/${key}`
    : null;

  return {
    bucket: config.bucket,
    key,
    storageUrl: s3Url,
    publicUrl,
    contentType,
    size: buffer.length
  };
}

module.exports = {
  uploadReadyCreative
};
