<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Handles uploading and deleting media files on AWS S3.
 *
 * The disk used ("s3") is configured in config/filesystems.php and driven by the
 * AWS_* variables in your .env file. Keeping all S3 logic here means controllers
 * never talk to S3 directly — they just call upload()/delete().
 */
class ImageUploadService
{
    /**
     * Name of the filesystem disk to use (see config/filesystems.php).
     */
    private string $disk = 's3';

    /**
     * Upload a single image to S3 and return its public URL.
     *
     * @param  UploadedFile  $file    The uploaded file (e.g. from $request->file('images.0')).
     * @param  string        $folder  Sub-folder/prefix inside the bucket, e.g. "listings".
     * @return string                 The public URL of the stored object.
     *
     * @throws RuntimeException        If the file fails to store.
     */
    public function upload(UploadedFile $file, string $folder = 'listings'): string
    {
        // Build a collision-proof filename: a random UUID + the original extension.
        // We never trust the user's original filename (it can contain unsafe chars).
        $extension = $file->getClientOriginalExtension() ?: $file->guessExtension() ?: 'bin';
        $filename = Str::uuid()->toString() . '.' . $extension;

        // putFileAs() streams the file straight to S3 (memory-friendly for large
        // images) and marks it "public" so it can be served via the bucket/CDN.
        // It returns the stored path (e.g. "listings/uuid.jpg") or false on failure.
        $path = Storage::disk($this->disk)->putFileAs($folder, $file, $filename, 'public');

        if ($path === false) {
            throw new RuntimeException('Failed to upload image to S3.');
        }

        // Turn the stored path into a fully-qualified URL. If AWS_URL (a CloudFront
        // domain) is set, Laravel uses it automatically; otherwise it builds the
        // default S3 URL.
        return Storage::disk($this->disk)->url($path);
    }

    /**
     * Delete an object from S3 given its public URL.
     *
     * @param  string  $url  The public URL previously returned by upload().
     * @return bool          True if an object was deleted, false otherwise.
     */
    public function delete(string $url): bool
    {
        $path = $this->urlToPath($url);

        if ($path === null || $path === '') {
            return false;
        }

        $disk = Storage::disk($this->disk);

        // Only attempt deletion if the object actually exists, so a stale/bad URL
        // does not blow up the request.
        if ($disk->exists($path)) {
            return $disk->delete($path);
        }

        return false;
    }

    /**
     * Convert a public URL back into the S3 object key/path.
     *
     * Handles both styles of URL:
     *   - "https://bucket.s3.region.amazonaws.com/listings/uuid.jpg"
     *   - a custom AWS_URL / CloudFront domain "https://cdn.example.com/listings/uuid.jpg"
     */
    private function urlToPath(string $url): ?string
    {
        // The base URL Laravel uses for this disk (respects AWS_URL if configured).
        $base = rtrim(Storage::disk($this->disk)->url(''), '/');

        // Fast path: strip the known base prefix to get the object key.
        if ($base !== '' && str_starts_with($url, $base)) {
            return ltrim(substr($url, strlen($base)), '/');
        }

        // Fallback: take the path component of the URL (everything after the host).
        $path = parse_url($url, PHP_URL_PATH);

        return $path !== false && $path !== null ? ltrim($path, '/') : null;
    }
}
