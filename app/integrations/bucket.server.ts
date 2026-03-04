import { PutObjectCommand, PutObjectCommandOutput, S3Client } from "@aws-sdk/client-s3";

import { SERVER_CONFIG } from "~/config.server";
import { createLogger } from "~/integrations/logger.server";

const logger = createLogger("BucketStorageClient");

class BucketStorageClient {
  private s3Client: S3Client;

  constructor() {
    this.s3Client = new S3Client({
      region: "auto",
      endpoint: process.env.R2_BUCKET_URL,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }

  async uploadFile({ key, file }: { key: string; file: Buffer }) {
    if (SERVER_CONFIG.isDev) {
      logger.info("Dev mode - skipping file upload to bucket", { key });
      return undefined as unknown as PutObjectCommandOutput;
    }
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: file,
    });

    return this.s3Client.send(command);
  }
}

export const Bucket = new BucketStorageClient();
