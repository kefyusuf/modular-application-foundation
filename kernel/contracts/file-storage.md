# Kernel Contract: File Storage

## Purpose

Stores and retrieves files through a stable capability instead of provider-specific APIs.

## Responsibility

File storage hides local disk, object storage, virus scanning, metadata, and signed URL behavior behind a module-safe contract.

## Inputs

- File stream or bytes.
- File metadata.
- Storage key or object ID.
- Access policy.
- Correlation context.

## Outputs

- Stored file descriptor.
- Read stream.
- Signed URL or download token.
- Delete result.

## Pseudocode

```txt
interface FileStorage {
  put(key, stream, metadata): StoredFile
  get(key): FileStream
  delete(key): void
  signedUrl(key, policy): Url
}
```

## Rules

- Modules store file metadata they own; storage adapter stores bytes.
- File keys must not expose sensitive business data.
- Access to files must be policy protected.
- Uploads should support content-type, size, and malware checks where needed.

## Common Adapters

- Local filesystem adapter.
- S3-compatible object storage.
- Database-backed storage for small controlled files.
- CDN/signed URL adapter.

## Failure Modes

- File too large.
- Unsupported content type.
- Malware scan failed.
- Missing object.
- Signed URL exposes broader access than intended.

## Verification Checklist

- [ ] Is metadata ownership separate from byte storage?
- [ ] Are file reads policy protected?
- [ ] Are upload limits defined?
- [ ] Are sensitive names excluded from storage keys?
- [ ] Are provider errors mapped to stable errors?
