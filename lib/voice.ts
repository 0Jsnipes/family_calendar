import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { serverConfig } from "@/lib/config";
import type { VoiceEventDraft } from "@/types";

const VOICE_MODEL = "claude-haiku-4-5";

let anthropicClient: Anthropic | null = null;

export function isVoiceParsingConfigured() {
  return Boolean(serverConfig.anthropicApiKey);
}

export function isVoiceTranscriptionConfigured() {
  return Boolean(serverConfig.openaiApiKey);
}

function getAnthropicClient() {
  if (!serverConfig.anthropicApiKey) {
    throw new Error("anthropic-not-configured");
  }
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: serverConfig.anthropicApiKey });
  }
  return anthropicClient;
}

/** Transcribes a short voice recording via OpenAI's Whisper endpoint. Only
 * needed on devices without the browser Web Speech API (kiosk browsers,
 * embedded webviews) — everywhere else the transcript comes from the
 * browser directly and this is never called. */
export async function transcribeAudio(
  audioBase64: string,
  mimeType: string,
): Promise<string> {
  if (!serverConfig.openaiApiKey) {
    throw new Error("transcription-not-configured");
  }

  const audioBuffer = Buffer.from(audioBase64, "base64");
  const extension = mimeType.includes("webm")
    ? "webm"
    : mimeType.includes("mp4")
      ? "mp4"
      : mimeType.includes("ogg")
        ? "ogg"
        : "wav";

  const formData = new FormData();
  formData.append(
    "file",
    new Blob([new Uint8Array(audioBuffer)], { type: mimeType }),
    `voice-input.${extension}`,
  );
  formData.append("model", "whisper-1");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${serverConfig.openaiApiKey}` },
    body: formData,
  });

  if (!response.ok) {
    throw new Error("transcription-failed");
  }

  const payload = (await response.json()) as { text?: string };
  const transcript = payload.text?.trim();
  if (!transcript) {
    throw new Error("transcription-empty");
  }

  return transcript;
}

const VoiceEventSchema = z.object({
  title: z.string().describe("A short event title, e.g. 'Dentist appointment'."),
  allDay: z.boolean(),
  date: z
    .string()
    .nullable()
    .describe(
      "The event date as YYYY-MM-DD, resolved against the reference date. Null to keep the currently selected date.",
    ),
  startTime: z
    .string()
    .nullable()
    .describe("24-hour HH:MM start time. Null when allDay is true."),
  endTime: z
    .string()
    .nullable()
    .describe(
      "24-hour HH:MM end time. Null when allDay is true or not mentioned (defaults to one hour after start).",
    ),
  location: z.string().nullable().describe("Location, or null if not mentioned."),
});

/** Extracts calendar-event fields from a spoken sentence, e.g. "Soccer
 * practice tomorrow at 4 at the community field". Dates are resolved
 * relative to `referenceDate` (the day currently selected in the app). */
export async function parseVoiceEvent(input: {
  transcript: string;
  referenceDate: string;
  timezone: string;
}): Promise<VoiceEventDraft> {
  const client = getAnthropicClient();

  const response = await client.messages.parse({
    model: VOICE_MODEL,
    max_tokens: 512,
    system:
      "You extract calendar event details from a single spoken sentence for a family calendar app. " +
      `Today's date is ${input.referenceDate} in the ${input.timezone} timezone. ` +
      "Resolve relative dates like 'tomorrow' or 'next Tuesday' against that date. " +
      "If no date is mentioned, return null for date. If no end time is mentioned for a timed event, return null for endTime.",
    messages: [{ role: "user", content: input.transcript }],
    output_config: { format: zodOutputFormat(VoiceEventSchema) },
  });

  if (!response.parsed_output) {
    throw new Error("voice-parse-failed");
  }

  return response.parsed_output;
}

const VoiceTasksSchema = z.object({
  tasks: z
    .array(z.string())
    .describe("Short routine task titles extracted from the sentence."),
});

/** Extracts one or more routine-task titles from a spoken sentence, e.g.
 * "add milk, eggs, and take out the trash". */
export async function parseVoiceTasks(transcript: string): Promise<string[]> {
  const client = getAnthropicClient();

  const response = await client.messages.parse({
    model: VOICE_MODEL,
    max_tokens: 512,
    system:
      "You extract a list of short household task titles from a single spoken sentence for a " +
      "family routine checklist app. Split multiple tasks mentioned in one sentence into separate " +
      "items. Keep each title short and in title case where natural.",
    messages: [{ role: "user", content: transcript }],
    output_config: { format: zodOutputFormat(VoiceTasksSchema) },
  });

  if (!response.parsed_output) {
    throw new Error("voice-parse-failed");
  }

  return response.parsed_output.tasks.map((task) => task.trim()).filter(Boolean);
}
