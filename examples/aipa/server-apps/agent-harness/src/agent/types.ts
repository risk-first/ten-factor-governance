/**
 * Adapted from OpenBB Agent Rita (MIT) protocol types — AIPA subset.
 * Copyright (c) 2026 OpenBB — see agent-rita LICENSE.
 */

export type ChatMessage = {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  toolCallId?: string;
  toolName?: string;
};

export type Citation = {
  id: string;
  source: string;
  title?: string;
  url?: string;
  appInstanceId?: string;
  fileId?: string;
};

export type Artifact = {
  type: string;
  uuid: string;
  name: string;
  content?: string;
  [key: string]: unknown;
};

export type StagedFile = {
  id: string;
  name: string;
  format: 'pdf' | 'docx' | 'txt' | 'md' | 'html';
  bytes: Uint8Array;
  /** Extracted text when available (txt/md/html; pdf/docx may be stub). */
  text?: string;
};

export type ToolCallRequest = {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
};

export type ToolResultPayload = {
  toolCallId: string;
  toolName: string;
  result: unknown;
  isError?: boolean;
};
