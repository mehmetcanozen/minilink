import { UrlEntity } from '../../src/types';

export const mockUrls: UrlEntity[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    originalUrl: 'https://example.com/very-long-url-path',
    shortSlug: 'abc123',
    clickCount: 5,
    isActive: true,
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:00:00Z'),
    userId: undefined
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    originalUrl: 'https://github.com/user/repository',
    shortSlug: 'gh456',
    clickCount: 0,
    isActive: true,
    createdAt: new Date('2024-01-01T11:00:00Z'),
    updatedAt: new Date('2024-01-01T11:00:00Z'),
    userId: 'user123'
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    originalUrl: 'https://stackoverflow.com/questions/long-question-title',
    shortSlug: 'so789',
    clickCount: 15,
    isActive: true,
    createdAt: new Date('2024-01-01T12:00:00Z'),
    updatedAt: new Date('2024-01-01T12:30:00Z'),
    userId: undefined
  }
];

export const mockCreateUrlDto = {
  originalUrl: 'https://example.com/test-url'
};

export const mockCreateUrlResponseDto = {
  id: '550e8400-e29b-41d4-a716-446655440004',
  originalUrl: 'https://example.com/test-url',
  shortUrl: 'http://localhost:3000/test12',
  shortSlug: 'test12',
  clickCount: 0,
  createdAt: new Date('2024-01-01T13:00:00Z')
};

export const mockDatabaseRow = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  original_url: 'https://example.com/very-long-url-path',
  short_slug: 'abc123',
  click_count: '5',
  created_at: '2024-01-01T10:00:00Z',
  updated_at: '2024-01-01T10:00:00Z',
  user_id: null
}; 