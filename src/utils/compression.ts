import { gunzipSync } from 'zlib';

/**
 * Utility functions for handling compressed data in Cursor storage
 * Many Cursor records store data as gzip+base64, especially keys ending in ':compressed'
 */

/**
 * Attempt to decode a value that might be gzip compressed and/or base64 encoded
 * @param value The raw value from the database
 * @returns The decoded string, or the original value if decoding fails
 */
export function maybeDecode(value: Buffer | string): string {
  try {
    // Convert to Buffer if it's a string
    const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value, 'base64');
    
    // Check for gzip magic bytes (0x1f 0x8b)
    if (buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
      console.log('Compression: Detected gzip compressed data, decompressing...');
      const decompressed = gunzipSync(buffer);
      return decompressed.toString('utf8');
    }
    
    // Try to decode as UTF-8
    try {
      const decoded = buffer.toString('utf8');
      // Quick validation - if it starts with { or [ it's likely JSON
      if (decoded.trim().match(/^[\{\[]/) && decoded.trim().match(/[\}\]]$/)) {
        return decoded;
      }
    } catch {
      // Not valid UTF-8
    }
    
    // If the original value was a string and looks like base64, try decoding it
    if (typeof value === 'string' && /^[A-Za-z0-9+/]+=*$/.test(value) && value.length % 4 === 0) {
      try {
        const decoded = Buffer.from(value, 'base64').toString('utf8');
        // Validate it's valid JSON-like content
        if (decoded.trim().match(/^[\{\[]/) && decoded.trim().match(/[\}\]]$/)) {
          console.log('Compression: Decoded base64 data successfully');
          return decoded;
        }
      } catch {
        // Not valid base64 or resulting string is not UTF-8
      }
    }
    
    // Return original value as string
    return typeof value === 'string' ? value : value.toString('utf8');
    
  } catch (error) {
    console.error('Compression: Error decoding value:', error);
    // Return original value as fallback
    return typeof value === 'string' ? value : value.toString();
  }
}

/**
 * Check if a key indicates compressed data
 * @param key The storage key
 * @returns True if the key likely contains compressed data
 */
export function isCompressedKey(key: string): boolean {
  return key.endsWith(':compressed') || 
         key.includes('.compressed.') ||
         key.includes('_gzip') ||
         key.includes('_compressed');
}

/**
 * Decompress and parse JSON data
 * @param value The potentially compressed value
 * @returns Parsed JSON object or null if parsing fails
 */
export function decompressAndParse(value: Buffer | string): any | null {
  try {
    const decoded = maybeDecode(value);
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Compression: Failed to decompress and parse:', error);
    return null;
  }
} 