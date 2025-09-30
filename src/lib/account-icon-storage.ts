import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const EXT_BY_TYPE: Record<string, string> = {
  "image/svg+xml": ".svg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
};

type Env = {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBase?: string;
};

let cachedEnv: Env | null = null;
let s3Client: S3Client | null = null;

const readEnv = (): Env => {
  if (cachedEnv) {
    return cachedEnv;
  }

  const bucket = process.env.NEXT_PUBLIC_AWS_S3_BUCKET;
  const region = process.env.NEXT_PUBLIC_AWS_S3_REGION;
  const accessKeyId = process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY;
  const publicBase = process.env.NEXT_PUBLIC_AWS_S3_PUBLIC_URL?.replace(/\/$/, "");

  if (!bucket) {
    throw new Error("Missing NEXT_PUBLIC_AWS_S3_BUCKET environment variable");
  }
  if (!region) {
    throw new Error("Missing NEXT_PUBLIC_AWS_S3_REGION environment variable");
  }
  if (!accessKeyId) {
    throw new Error("Missing NEXT_PUBLIC_AWS_ACCESS_KEY_ID environment variable");
  }
  if (!secretAccessKey) {
    throw new Error("Missing NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY environment variable");
  }

  cachedEnv = { bucket, region, accessKeyId, secretAccessKey, publicBase };
  return cachedEnv;
};

const getClient = () => {
  const env = readEnv();
  if (!s3Client) {
    s3Client = new S3Client({
      region: env.region,
      credentials: {
        accessKeyId: env.accessKeyId,
        secretAccessKey: env.secretAccessKey,
      },
    });
  }
  return { client: s3Client, env };
};

const resolveExt = (file: File) => {
  const byType = file.type ? EXT_BY_TYPE[file.type] : undefined;
  if (byType) return byType;
  const match = /\.([a-zA-Z0-9]+)$/.exec(file.name || "");
  return match ? `.${match[1].toLowerCase()}` : "";
};

export const buildAccountIconKey = (ownerUid: string, accountId: string, ext: string) =>
  `icons/${ownerUid}/${accountId}${ext}`;

const buildPublicUrl = (env: Env, key: string) => {
  if (env.publicBase) {
    return `${env.publicBase}/${key}`;
  }
  const regionSuffix = env.region === "us-east-1" ? "" : `.${env.region}`;
  return `https://${env.bucket}.s3${regionSuffix}.amazonaws.com/${key}`;
};

const maybeExtractKeyFromUrl = (env: Env, url: string): string | null => {
  if (!url) return null;
  if (env.publicBase && url.startsWith(`${env.publicBase}/`)) {
    return url.slice(env.publicBase.length + 1);
  }
  try {
    const parsed = new URL(url);
    return parsed.pathname.replace(/^\//, "");
  } catch {
    return url.replace(/^\//, "") || null;
  }
};

export async function uploadAccountIcon(ownerUid: string, accountId: string, file: File) {
  const { client, env } = getClient();
  const ext = resolveExt(file);
  const key = buildAccountIconKey(ownerUid, accountId, ext);

  // Normalize Body to a byte array to avoid ReadableStream incompatibilities
  const bytes = new Uint8Array(await file.arrayBuffer());

  await client.send(
    new PutObjectCommand({
      Bucket: env.bucket,
      Key: key,
      Body: bytes,
      CacheControl: "public,max-age=31536000,immutable",
      ContentType: file.type || undefined,
    })
  );

  const url = buildPublicUrl(env, key);
  return { key, url };
}

export async function deleteAccountIcon(input: { key?: string; url?: string }) {
  const { client, env } = getClient();
  const key = input.key || (input.url ? maybeExtractKeyFromUrl(env, input.url) : null);
  if (!key) {
    throw new Error("Missing S3 key for icon deletion");
  }

  await client.send(
    new DeleteObjectCommand({
      Bucket: env.bucket,
      Key: key,
    })
  );

  return { key };
}
