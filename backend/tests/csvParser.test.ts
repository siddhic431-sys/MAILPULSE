import { parseLeads, isValidEmail } from '../src/utils/csvParser';

describe('CSV and TXT Lead Parser', () => {
  it('should validate RFC-compliant email formats', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('user.name+tag@sub.domain.org')).toBe(true);
    expect(isValidEmail('invalid-email')).toBe(false);
    expect(isValidEmail('@nodomain.com')).toBe(false);
    expect(isValidEmail('noatsign.com')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });

  it('should parse standard CSV format with headers and quotes', () => {
    const csvData = `email
"alice@example.com"
"bob@example.com"
"charlie@example.com"`;

    const result = parseLeads(csvData);
    expect(result.validEmails).toEqual([
      'alice@example.com',
      'bob@example.com',
      'charlie@example.com',
    ]);
    expect(result.invalidEmails).toHaveLength(0);
    expect(result.duplicatesRemoved).toBe(0);
  });

  it('should parse plain newline-separated TXT files', () => {
    const txtData = `alice@domain.io
bob@domain.io
david@domain.io`;

    const result = parseLeads(txtData);
    expect(result.validEmails).toHaveLength(3);
    expect(result.validEmails).toContain('alice@domain.io');
    expect(result.validEmails).toContain('bob@domain.io');
    expect(result.validEmails).toContain('david@domain.io');
  });

  it('should automatically remove duplicate email addresses (case-insensitively)', () => {
    const raw = `test@domain.com
TEST@DOMAIN.COM
test@domain.com
another@domain.com`;

    const result = parseLeads(raw);
    expect(result.validEmails).toEqual(['test@domain.com', 'another@domain.com']);
    expect(result.duplicatesRemoved).toBe(2);
  });

  it('should separate invalid email addresses into invalidEmails list', () => {
    const mixed = `valid@mailpulse.io
not-an-email
also-invalid@
valid2@mailpulse.io`;

    const result = parseLeads(mixed);
    expect(result.validEmails).toEqual(['valid@mailpulse.io', 'valid2@mailpulse.io']);
    expect(result.invalidEmails).toContain('not-an-email');
    expect(result.invalidEmails).toContain('also-invalid@');
  });

  it('should handle empty or whitespace-only inputs gracefully', () => {
    const emptyResult = parseLeads('');
    expect(emptyResult.validEmails).toEqual([]);
    expect(emptyResult.invalidEmails).toEqual([]);
    expect(emptyResult.duplicatesRemoved).toBe(0);
  });
});
