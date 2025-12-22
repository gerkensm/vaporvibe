/**
 * Image Re-encoding Utilities for Export
 *
 * Re-encodes images for smaller file size:
 * - Non-alpha images: Convert to JPEG at quality targeting <200KB
 * - Alpha images: Keep as PNG (optionally compress)
 */

import sharp from "sharp";
import type { GeneratedImage } from "../types.js";
import { logger } from "../logger.js";

/** Maximum target size for JPEG images (200KB) */
const MAX_JPEG_SIZE = 200 * 1024;

/** Minimum JPEG quality to maintain acceptable visuals */
const MIN_JPEG_QUALITY = 40;

/** Default starting JPEG quality */
const DEFAULT_JPEG_QUALITY = 85;

/**
 * Result of re-encoding an image
 */
export interface ReencodedImage {
    base64: string;
    mimeType: string;
    originalSize: number;
    newSize: number;
    wasCompressed: boolean;
}

/**
 * Checks if a PNG image has an alpha channel with actual transparency
 */
async function hasAlphaChannel(buffer: Buffer): Promise<boolean> {
    try {
        const metadata = await sharp(buffer).metadata();

        // Only PNG/WebP can have meaningful alpha
        if (metadata.format !== "png" && metadata.format !== "webp") {
            return false;
        }

        // Check if the image has an alpha channel
        if (!metadata.hasAlpha) {
            return false;
        }

        // For images with alpha channel, check if alpha is actually used
        // (some PNGs have alpha channel but it's all opaque)
        const stats = await sharp(buffer).stats();

        // If alpha channel exists and has variance or min < 255, it's used
        if (stats.channels.length >= 4) {
            const alphaChannel = stats.channels[3];
            // If min alpha is less than 255, there's actual transparency
            return alphaChannel.min < 255;
        }

        return false;
    } catch (error) {
        logger.warn({ error }, "Failed to check alpha channel, assuming no alpha");
        return false;
    }
}

/**
 * Encodes an image to JPEG at a quality that targets the size limit
 */
async function encodeToJpeg(
    buffer: Buffer,
    targetSize: number = MAX_JPEG_SIZE
): Promise<{ buffer: Buffer; quality: number }> {
    let quality = DEFAULT_JPEG_QUALITY;
    let result = await sharp(buffer).jpeg({ quality }).toBuffer();

    // If already under target, we're done
    if (result.length <= targetSize) {
        return { buffer: result, quality };
    }

    // Estimate quality needed based on current size
    const ratio = targetSize / result.length;
    quality = Math.max(MIN_JPEG_QUALITY, Math.floor(quality * ratio * 0.9)); // 0.9 for safety margin

    result = await sharp(buffer).jpeg({ quality }).toBuffer();

    // If still over, try one more time at lower quality
    if (result.length > targetSize && quality > MIN_JPEG_QUALITY) {
        const ratio2 = targetSize / result.length;
        quality = Math.max(MIN_JPEG_QUALITY, Math.floor(quality * ratio2 * 0.85));
        result = await sharp(buffer).jpeg({ quality }).toBuffer();
    }

    return { buffer: result, quality };
}

/**
 * Re-encodes a single image for export
 */
export async function reencodeImage(
    base64: string,
    mimeType: string
): Promise<ReencodedImage> {
    const originalBuffer = Buffer.from(base64, "base64");
    const originalSize = originalBuffer.length;

    try {
        // Check if image has alpha transparency
        const hasAlpha = await hasAlphaChannel(originalBuffer);

        if (hasAlpha) {
            // Keep as PNG but optionally compress
            const compressed = await sharp(originalBuffer)
                .png({ compressionLevel: 9 })
                .toBuffer();

            // Only use compressed if it's actually smaller
            if (compressed.length < originalSize) {
                return {
                    base64: compressed.toString("base64"),
                    mimeType: "image/png",
                    originalSize,
                    newSize: compressed.length,
                    wasCompressed: true,
                };
            }

            // Keep original
            return {
                base64,
                mimeType,
                originalSize,
                newSize: originalSize,
                wasCompressed: false,
            };
        }

        // No alpha - convert to JPEG
        const { buffer: jpegBuffer, quality } = await encodeToJpeg(originalBuffer);

        // Only use JPEG if it's smaller than original
        if (jpegBuffer.length < originalSize) {
            logger.debug(
                { originalSize, newSize: jpegBuffer.length, quality },
                "Converted image to JPEG"
            );
            return {
                base64: jpegBuffer.toString("base64"),
                mimeType: "image/jpeg",
                originalSize,
                newSize: jpegBuffer.length,
                wasCompressed: true,
            };
        }

        // Original was smaller, keep it
        return {
            base64,
            mimeType,
            originalSize,
            newSize: originalSize,
            wasCompressed: false,
        };
    } catch (error) {
        logger.warn({ error, mimeType }, "Failed to re-encode image, keeping original");
        return {
            base64,
            mimeType,
            originalSize,
            newSize: originalSize,
            wasCompressed: false,
        };
    }
}

/**
 * Re-encodes all images for export, returning new GeneratedImage array with compressed base64
 */
export async function reencodeImagesForExport(
    images: GeneratedImage[]
): Promise<GeneratedImage[]> {
    const result: GeneratedImage[] = [];
    let totalOriginal = 0;
    let totalNew = 0;

    for (const image of images) {
        if (!image.base64) {
            result.push(image);
            continue;
        }

        const reencoded = await reencodeImage(image.base64, image.mimeType);
        totalOriginal += reencoded.originalSize;
        totalNew += reencoded.newSize;

        result.push({
            ...image,
            base64: reencoded.base64,
            mimeType: reencoded.mimeType,
        });
    }

    if (totalOriginal > 0) {
        const savedKB = Math.round((totalOriginal - totalNew) / 1024);
        const savedPercent = Math.round((1 - totalNew / totalOriginal) * 100);
        logger.info(
            { originalKB: Math.round(totalOriginal / 1024), newKB: Math.round(totalNew / 1024), savedKB, savedPercent },
            `Re-encoded ${images.length} images, saved ${savedKB}KB (${savedPercent}%)`
        );
    }

    return result;
}
