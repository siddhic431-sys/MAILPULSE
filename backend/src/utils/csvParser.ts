import { parse } from 'csv-parse/sync';
import { ParsedLeadResult } from '../types';

// RFC 5322 compliant regex for practical email validation
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length > 254) return false;
  return EMAIL_REGEX.test(trimmed);
}

/**
 * Parses raw text or CSV content, extracting and validating email addresses,
 * removing duplicates, and cataloging invalid formats.
 */
export function parseLeads(rawContent: string): ParsedLeadResult {
  if (!rawContent || !rawContent.trim()) {
    return {
      validEmails: [],
      invalidEmails: [],
      duplicatesRemoved: 0,
      totalParsed: 0,
    };
  }

  const rawCandidates: string[] = [];

  // Attempt CSV parsing first
  try {
    const records: string[][] = parse(rawContent, {
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
    });

    for (const row of records) {
      for (const cell of row) {
        if (cell && typeof cell === 'string') {
          // Check if cell has commas, spaces, or semicolons
          const parts = cell.split(/[\s,;]+/);
          for (const part of parts) {
            const candidate = part.trim().replace(/^['"<]+|['">]+$/g, '');
            if (candidate && candidate.toLowerCase() !== 'email' && candidate.toLowerCase() !== 'emails') {
              rawCandidates.push(candidate);
            }
          }
        }
      }
    }
  } catch {
    // If CSV parse fails (e.g. malformed quotes), fallback to line/delimiter split
    const lines = rawContent.split(/\r?\n/);
    for (const line of lines) {
      const parts = line.split(/[\s,;]+/);
      for (const part of parts) {
        const candidate = part.trim().replace(/^['"<]+|['">]+$/g, '');
        if (candidate && candidate.toLowerCase() !== 'email' && candidate.toLowerCase() !== 'emails') {
          rawCandidates.push(candidate);
        }
      }
    }
  }

  const seen = new Set<string>();
  const validEmails: string[] = [];
  const invalidEmails: string[] = [];
  let duplicatesRemoved = 0;

  for (const candidate of rawCandidates) {
    if (isValidEmail(candidate)) {
      const normalized = candidate.toLowerCase();
      if (seen.has(normalized)) {
        duplicatesRemoved++;
      } else {
        seen.add(normalized);
        validEmails.push(normalized);
      }
    } else {
      if (!invalidEmails.includes(candidate)) {
        invalidEmails.push(candidate);
      }
    }
  }

  return {
    validEmails,
    invalidEmails,
    duplicatesRemoved,
    totalParsed: rawCandidates.length,
  };
}
