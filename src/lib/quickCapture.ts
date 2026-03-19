/**
 * Quick Capture — content type detection and clipboard utilities.
 *
 * Detects the most likely CloudType for captured text, used to
 * pre-populate the cloud selector in QuickCaptureModal.
 */

import type { CloudType } from '../types/engram';

// ── URL detection ─────────────────────────────────────────────────────────────

const URL_RE = /^https?:\/\/[^\s]+$/i;

export function looksLikeUrl(text: string): boolean {
  return URL_RE.test(text.trim());
}

// ── Code detection ────────────────────────────────────────────────────────────

// Heuristic: presence of common programming constructs
const CODE_PATTERNS = [
  /^\s*(import |from |export |const |let |var |function |class |def |#include|package )/m,
  /[{};]\s*$/m,
  /\b(if|else|for|while|return|=>|->)\b.*[{;]/,
  /^\s*(\/\/|#|--|\/\*|\*\/)/m,
];

export function looksLikeCode(text: string): boolean {
  const lines = text.split('\n');
  if (lines.length < 2) return false;
  return CODE_PATTERNS.some((re) => re.test(text));
}

// ── Personal / reflection detection ─────────────────────────────────────────

const PERSONAL_PATTERNS = [
  /\b(I feel|I think|I believe|I remember|I wish|I want|I need|I am|I was|I have)\b/i,
  /\b(my |mine |myself)\b/i,
  /\b(today|yesterday|tomorrow|last week|this morning)\b/i,
];

export function looksPersonal(text: string): boolean {
  return PERSONAL_PATTERNS.some((re) => re.test(text));
}

// ── Knowledge / factual detection ────────────────────────────────────────────

const KNOWLEDGE_PATTERNS = [
  /\b(according to|research shows|studies indicate|defined as|means that|is a|are a)\b/i,
  /\b(note:|tip:|fact:|definition:)\b/i,
];

export function looksLikeKnowledge(text: string): boolean {
  return KNOWLEDGE_PATTERNS.some((re) => re.test(text));
}

// ── Goal detection ───────────────────────────────────────────────────────────

const GOAL_PATTERNS = [
  /\b(goal|objective|plan|target|milestone|deadline|by \w+ \d+)\b/i,
  /^\s*[-*•]\s+.+$/m, // bullet list (often tasks/goals)
  /\b(TODO|FIXME|task:)\b/i,
];

export function looksLikeGoal(text: string): boolean {
  return GOAL_PATTERNS.some((re) => re.test(text));
}

// ── Main detection ────────────────────────────────────────────────────────────

/**
 * Detect the most appropriate CloudType for a piece of captured text.
 *
 * Priority order:
 *   URL text        -> 'knowledge'  (world-wide info)
 *   Code            -> 'skill'      (technical knowledge)
 *   Goal language   -> 'goal'
 *   Personal text   -> 'memory'     (Experience cloud)
 *   Factual text    -> 'knowledge'
 *   Fallback        -> 'memory'
 */
export function detectContentType(text: string): CloudType {
  const trimmed = text.trim();
  if (!trimmed) return 'memory';

  if (looksLikeUrl(trimmed)) return 'knowledge';
  if (looksLikeCode(trimmed)) return 'skill';
  if (looksLikeGoal(trimmed)) return 'goal';
  if (looksPersonal(trimmed)) return 'memory';
  if (looksLikeKnowledge(trimmed)) return 'knowledge';

  return 'memory';
}

/** Read clipboard text. Returns empty string if unavailable. */
export async function readClipboard(): Promise<string> {
  try {
    return await navigator.clipboard.readText();
  } catch {
    return '';
  }
}

/** Generate a short title from content (first line, max 60 chars). */
export function titleFromContent(content: string): string {
  const firstLine = content.split('\n')[0].trim();
  if (firstLine.length <= 60) return firstLine;
  return firstLine.slice(0, 57) + '…';
}
