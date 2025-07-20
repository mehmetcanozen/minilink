// Global test setup
import dotenv from 'dotenv';
import path from 'path';

// Load test environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to suppress logs during testing
  // log: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Set test timeout
jest.setTimeout(10000);

// Global test constants
export const TEST_CONSTANTS = {
  VALID_URLS: [
    'https://example.com',
    'http://google.com',
    'https://www.github.com/user/repo',
    'https://subdomain.domain.co.uk/path?query=value'
  ],
  INVALID_URLS: [
    '',
    'not-a-url',
    'ftp://invalid-protocol.com',
    'javascript:alert("xss")',
    'http://',
    'https://'.repeat(1000) // Too long
  ],
  VALID_SLUGS: [
    'abcd',
    'test123',
    'short-url',
    'MyCustom_Slug'
  ],
  INVALID_SLUGS: [
    '',
    'a',
    'ab',
    'abc',
    'toolongslugthatshouldnotbeaccepted',
    'invalid spaces',
    'special@chars',
    'api', // Reserved
    'admin' // Reserved
  ]
};

export default TEST_CONSTANTS; 