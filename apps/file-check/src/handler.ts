import { createHmac } from "node:crypto";
import { GetObjectCommand, NoSuchKey, S3Client } from "@aws-sdk/client-s3";
import type { S3Event } from "aws-lambda";
import { fileTypeFromBuffer } from "file-type";
import { checkFileType } from "./check.js";

// file-type needs at most this many bytes to recognise a format.
const HEAD_BYTES = 4100;

const s3 = new S3Client({});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

/**
 * Triggered by S3 for every object created under uploads/. Reads the first bytes,
 * decides whether the content matches its declared type, and reports to the API.
 * Throwing makes Lambda retry the event (twice, for S3's asynchronous invocation).
 */
export async function handler(event: S3Event): Promise<void> {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    // S3 event keys are URL-encoded, with spaces as "+".
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    if (!key.startsWith("uploads/")) continue;
    await checkObject(bucket, key);
  }
}

async function checkObject(bucket: string, key: string): Promise<void> {
  let head: Uint8Array;
  let declaredType: string | undefined;
  try {
    const object = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: key, Range: `bytes=0-${HEAD_BYTES - 1}` }),
    );
    head = await object.Body!.transformToByteArray();
    declaredType = object.ContentType;
  } catch (error) {
    // Already gone (e.g. removed by the API's size check): nothing left to verify.
    if (error instanceof NoSuchKey) {
      console.log(JSON.stringify({ key, result: "skipped", reason: "object no longer exists" }));
      return;
    }
    throw error;
  }

  const detected = await fileTypeFromBuffer(head);
  const verdict = checkFileType(declaredType, detected);
  const result = {
    key,
    verdict: verdict.ok ? "clean" : "rejected",
    reason: verdict.ok ? undefined : verdict.reason,
    declaredType,
    detectedType: detected?.mime,
  };
  console.log(JSON.stringify(result));
  await report(result);
}

/** POSTs the result to the API, signed so only this function can report results. */
async function report(result: object): Promise<void> {
  const url = requireEnv("SCAN_RESULT_URL");
  const secret = requireEnv("SCAN_RESULT_SECRET");

  const body = JSON.stringify(result);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  // The timestamp is signed too, so a captured request can't be replayed later.
  const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-dropwave-timestamp": timestamp,
      "x-dropwave-signature": `sha256=${signature}`,
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`API answered ${response.status} for ${url}: ${await response.text()}`);
  }
}
