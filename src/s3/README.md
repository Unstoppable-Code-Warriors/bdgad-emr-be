# S3 File Download API

This module provides APIs for downloading files from S3-compatible storage (Cloudflare R2) using pre-signed URLs.

## Environment Variables

Make sure these environment variables are set:

```env
S3_ENDPOINT=https://d46919b3b31b61ac349836b18c9ac671.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=929d4a51f89677489407eaf007607fe9
S3_SECRET_ACCESS_KEY=3cf23d66c454bf340df3cc1c6d55282e136e05f93d390f6815b5ea167cc937ef
```

## API Endpoints

### POST /files/download

Generate a pre-signed download URL for a file stored in S3/R2.

**Request Body:**

```json
{
  "s3Url": "https://d46919b3b31b61ac349836b18c9ac671.r2.cloudflarestorage.com/bucket-name/path/to/file.pdf",
  "expiresIn": 3600
}
```

**Response:**

```json
{
  "downloadUrl": "https://presigned-url-for-download...",
  "expiresIn": 3600,
  "expiresAt": "2024-01-01T12:00:00.000Z"
}
```

**Parameters:**

- `s3Url` (required): The S3 URL of the file to download
- `expiresIn` (optional): URL expiration time in seconds (default: 3600, min: 60, max: 86400)

### POST /files/check

Check if a file exists in S3/R2.

**Request Body:**

```json
{
  "s3Url": "https://d46919b3b31b61ac349836b18c9ac671.r2.cloudflarestorage.com/bucket-name/path/to/file.pdf"
}
```

**Response:**

```json
{
  "exists": true
}
```

## Supported URL Formats

The service supports multiple S3 URL formats:

1. **Cloudflare R2 Format:**

   ```
   https://[account-id].r2.cloudflarestorage.com/[bucket]/[key]
   ```

2. **AWS S3 Path-style:**

   ```
   https://s3.region.amazonaws.com/bucket/key
   ```

3. **AWS S3 Virtual-hosted-style:**
   ```
   https://bucket.s3.region.amazonaws.com/key
   ```

## Error Handling

The API returns appropriate HTTP status codes and error messages:

- `400 Bad Request`: Invalid S3 URL format or parameters
- `404 Not Found`: File does not exist (for check endpoint)
- `500 Internal Server Error`: S3 service errors

## Usage Example

```typescript
// Generate download URL
const response = await fetch('/files/download', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    s3Url:
      'https://d46919b3b31b61ac349836b18c9ac671.r2.cloudflarestorage.com/results/patient-123/test-456.pdf',
    expiresIn: 1800, // 30 minutes
  }),
});

const { downloadUrl } = await response.json();

// Use the download URL
window.open(downloadUrl, '_blank');
```

## Integration with Patient API

The S3 service is designed to work with the `resultEtlUrl` field returned by patient APIs:

```typescript
// Get patient details
const patientDetails = await getPatientDetails(patientId);

// Get download URL for a test result
if (patientDetails.recentTests[0].resultEtlUrl) {
  const downloadResponse = await fetch('/files/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      s3Url: patientDetails.recentTests[0].resultEtlUrl,
    }),
  });

  const { downloadUrl } = await downloadResponse.json();
  // Use downloadUrl...
}
```
