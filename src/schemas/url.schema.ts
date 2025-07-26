import { z } from 'zod';

/**
 * Schema for creating a new URL
 */
export const createUrlSchema = z.object({
  originalUrl: z
    .string()
    .min(1, 'originalUrl cannot be empty')
    .url('originalUrl must be a valid URL')
    .trim()
    .transform((val: string) => val.toLowerCase()), // Normalize URLs
  expiresAt: z
    .union([
      z.string().datetime('expiresAt must be a valid ISO date string'),
      z.date(),
    ])
    .optional()
    .transform((val: string | Date | undefined) => {
      if (typeof val === 'string') {
        const date = new Date(val);
        if (isNaN(date.getTime())) {
          throw new Error('expiresAt must be a valid date');
        }
        return date;
      }
      return val;
    }),
  userId: z
    .string()
    .uuid('userId must be a valid UUID')
    .optional(),
  customSlug: z
    .string()
    .min(1, 'customSlug cannot be empty')
    .max(20, 'customSlug cannot exceed 20 characters')
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      'customSlug can only contain alphanumeric characters, hyphens, underscores, and dots'
    )
    .optional(),
});

/**
 * Schema for URL slug validation
 */
export const slugSchema = z
  .string()
  .min(1, 'Slug cannot be empty')
  .max(20, 'Slug cannot exceed 20 characters')
  .regex(
    /^[a-zA-Z0-9._-]+$/,
    'Slug can only contain alphanumeric characters, hyphens, underscores, and dots'
  )
  .trim();

/**
 * Schema for bulk URL creation
 */
export const bulkCreateUrlSchema = z.object({
  urls: z
    .array(createUrlSchema)
    .min(1, 'At least one URL is required')
    .max(100, 'Cannot create more than 100 URLs at once'),
  options: z.object({
    skipDuplicates: z.boolean().optional(),
    generateCustomSlugs: z.boolean().optional(),
  }).optional(),
});

/**
 * Schema for URL query parameters
 */
export const urlQuerySchema = z.object({
  limit: z
    .string()
    .regex(/^\d+$/, 'Limit must be a positive integer')
    .transform((val: string) => parseInt(val, 10))
    .refine((val: number) => val > 0 && val <= 100, 'Limit must be between 1 and 100')
    .optional()
    .default(() => 10),
  offset: z
    .string()
    .regex(/^\d+$/, 'Offset must be a non-negative integer')
    .transform((val: string) => parseInt(val, 10))
    .refine((val: number) => val >= 0, 'Offset must be non-negative')
    .optional()
    .default(() => 0),
  userId: z
    .string()
    .uuid('userId must be a valid UUID')
    .optional(),
});

/**
 * Schema for pagination parameters
 */
export const paginationSchema = z.object({
  page: z
    .string()
    .regex(/^\d+$/, 'Page must be a positive integer')
    .transform((val: string) => parseInt(val, 10))
    .refine((val: number) => val > 0, 'Page must be greater than 0')
    .optional()
    .default(() => 1),
  limit: z
    .string()
    .regex(/^\d+$/, 'Limit must be a positive integer')
    .transform((val: string) => parseInt(val, 10))
    .refine((val: number) => val > 0 && val <= 100, 'Limit must be between 1 and 100')
    .optional()
    .default(() => 10),
});

/**
 * Schema for URL deletion
 */
export const deleteUrlSchema = z.object({
  slug: slugSchema,
  userId: z
    .string()
    .uuid('userId must be a valid UUID')
    .optional(),
});

/**
 * Schema for URL stats retrieval
 */
export const urlStatsSchema = z.object({
  slug: slugSchema,
});

/**
 * Schema for system stats query parameters
 */
export const systemStatsSchema = z.object({
  includeCache: z
    .string()
    .transform((val: string) => val === 'true')
    .optional()
    .default(() => false),
  includeQueue: z
    .string()
    .transform((val: string) => val === 'true')
    .optional()
    .default(() => false),
});

// Type exports for use in controllers
export type CreateUrlDto = z.infer<typeof createUrlSchema>;
export type BulkCreateUrlDto = z.infer<typeof bulkCreateUrlSchema>;
export type UrlQueryDto = z.infer<typeof urlQuerySchema>;
export type PaginationDto = z.infer<typeof paginationSchema>;
export type DeleteUrlDto = z.infer<typeof deleteUrlSchema>;
export type UrlStatsDto = z.infer<typeof urlStatsSchema>;
export type SystemStatsDto = z.infer<typeof systemStatsSchema>; 