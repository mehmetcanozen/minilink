import { customAlphabet, nanoid } from 'nanoid';
import { nanoidConfig } from '../config';
import { SlugGenerationError } from '../types';

// Create a custom nanoid generator with our alphabet and length
const generateId = customAlphabet(nanoidConfig.alphabet, nanoidConfig.length);

// Interface for slug generation options
interface SlugGenerationOptions {
  maxRetries?: number;
  existingSlugChecker?: (slug: string) => Promise<boolean>;
}

/**
 * Generate a unique short slug using NanoID
 * @param options Configuration options for slug generation
 * @returns Promise<string> A unique slug
 */
export async function generateUniqueSlug(options: SlugGenerationOptions = {}): Promise<string> {
  const { maxRetries = 5, existingSlugChecker } = options;
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      const slug = generateId();
      
      // Validate the generated slug
      if (!isValidSlug(slug)) {
        attempts++;
        continue;
      }

      // If we have a checker function, verify the slug doesn't exist
      if (existingSlugChecker) {
        const exists = await existingSlugChecker(slug);
        if (!exists) {
          return slug;
        }
        // Slug exists, try again
        attempts++;
        continue;
      }

      // No checker function, return the slug
      return slug;
    } catch (error) {
      attempts++;
      console.error(`Slug generation attempt ${attempts} failed:`, error);
    }
  }

  throw new SlugGenerationError(
    `Failed to generate unique slug after ${maxRetries} attempts. This may indicate configuration issues or high collision rates.`
  );
}

/**
 * Generate a simple slug without uniqueness checking
 * Useful for batch operations or when uniqueness is handled elsewhere
 * @returns string A new slug
 */
export function generateSlug(): string {
  const slug = generateId();
  
  if (!isValidSlug(slug)) {
    // This should rarely happen with proper configuration, but handle it gracefully
    throw new SlugGenerationError('Generated slug failed validation');
  }

  return slug;
}

/**
 * Generate multiple slugs at once
 * @param count Number of slugs to generate
 * @returns string[] Array of generated slugs
 */
export function generateSlugs(count: number): string[] {
  if (count <= 0) {
    return [];
  }

  if (count > 1000) {
    throw new SlugGenerationError('Cannot generate more than 1000 slugs at once');
  }

  const slugs: string[] = [];
  
  for (let i = 0; i < count; i++) {
    try {
      const slug = generateSlug();
      slugs.push(slug);
    } catch (error) {
      throw new SlugGenerationError(`Failed to generate slug ${i + 1} of ${count}: ${error}`);
    }
  }

  return slugs;
}

/**
 * Validate if a slug meets our criteria
 * @param slug The slug to validate
 * @returns boolean Whether the slug is valid
 */
export function isValidSlug(slug: string): boolean {
  if (!slug || typeof slug !== 'string') {
    return false;
  }

  // Check length
  if (slug.length < 4 || slug.length > 20) {
    return false;
  }

  // Check if it contains only allowed characters
  const allowedChars = new Set(nanoidConfig.alphabet);
  for (const char of slug) {
    if (!allowedChars.has(char)) {
      return false;
    }
  }

  // Check for reserved words (should not start with these)
  const reservedPrefixes = ['api', 'admin', 'www', 'app'];
  const lowerSlug = slug.toLowerCase();
  
  for (const prefix of reservedPrefixes) {
    if (lowerSlug.startsWith(prefix)) {
      return false;
    }
  }

  return true;
}

/**
 * Estimate collision probability based on current configuration
 * This is useful for monitoring and alerting
 * @param existingCount Number of existing slugs
 * @returns number Collision probability (0-1)
 */
export function estimateCollisionProbability(existingCount: number): number {
  const alphabetSize = nanoidConfig.alphabet.length;
  const slugLength = nanoidConfig.length;
  const totalPossibleSlugs = Math.pow(alphabetSize, slugLength);
  
  // Using birthday paradox approximation
  // P(collision) ≈ 1 - e^(-n²/2N) where n = existing count, N = total possible
  const probability = 1 - Math.exp(-Math.pow(existingCount, 2) / (2 * totalPossibleSlugs));
  
  return Math.min(probability, 1); // Cap at 1
}

/**
 * Get information about current slug configuration
 * @returns object Configuration information and statistics
 */
export function getSlugConfig() {
  const alphabetSize = nanoidConfig.alphabet.length;
  const slugLength = nanoidConfig.length;
  const totalPossibleSlugs = Math.pow(alphabetSize, slugLength);
  
  return {
    alphabet: nanoidConfig.alphabet,
    alphabetSize,
    slugLength,
    totalPossibleSlugs,
    // At 50% probability, we can safely generate this many slugs
    safeGenerationLimit: Math.floor(Math.sqrt(totalPossibleSlugs * Math.log(2))),
  };
}

/**
 * Create a custom slug checker function for use with generateUniqueSlug
 * This integrates with the repository to check for existing slugs
 * @param repository Object with a method to check if slug exists
 * @returns Function that checks if a slug exists
 */
export function createSlugChecker(repository: { findBySlug: (slug: string) => Promise<any> }) {
  return async (slug: string): Promise<boolean> => {
    try {
      const existing = await repository.findBySlug(slug);
      return existing !== null;
    } catch (error) {
      console.error('Error checking slug existence:', error);
      // In case of error, assume it exists to be safe
      return true;
    }
  };
}

/**
 * Generate a human-readable slug from a URL (for future custom slug feature)
 * This is not used in the current implementation but prepared for future enhancement
 * @param url The original URL
 * @returns string A human-readable slug suggestion
 */
export function generateReadableSlug(url: string): string {
  try {
    const parsedUrl = new URL(url);
    let slug = parsedUrl.hostname.replace(/^www\./, '');
    
    // Add pathname if meaningful
    if (parsedUrl.pathname && parsedUrl.pathname !== '/') {
      const pathParts = parsedUrl.pathname.split('/').filter(part => part.length > 0);
      if (pathParts.length > 0) {
        slug += '-' + pathParts.join('-');
      }
    }
    
    // Clean up the slug
    slug = slug
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')  // Replace non-alphanumeric with hyphens
      .replace(/-+/g, '-')          // Replace multiple hyphens with single
      .replace(/^-|-$/g, '');       // Remove leading/trailing hyphens
    
    // Limit length
    if (slug.length > 20) {
      slug = slug.substring(0, 20);
    }
    
    // Ensure minimum length
    if (slug.length < 4) {
      slug = generateSlug(); // Fallback to random slug
    }
    
    return slug;
  } catch (error) {
    // If URL parsing fails, generate a random slug
    return generateSlug();
  }
} 