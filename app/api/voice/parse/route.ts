import { NextResponse } from "next/server";
import { requireHubUser } from "@/lib/hubAuth";
import {
  isVoiceParsingConfigured,
  isVoiceTranscriptionConfigured,
  parseVoiceEvent,
  parseVoiceTasks,
  transcribeAudio,
} from "@/lib/voice";

type VoiceParseBody = {
  kind?: "event" | "task";
  transcript?: string;
  audio?: string;
  mimeType?: string;
  referenceDate?: string;
  timezone?: string;
};

export async function POST(request: Request) {
  try {
    await requireHubUser();

    if (!isVoiceParsingConfigured()) {
      return NextResponse.json(
        { error: "Voice commands are not configured." },
        { status: 500 },
      );
    }

    const body = (await request.json()) as VoiceParseBody;

    let transcript = body.transcript?.trim();

    if (!transcript && body.audio && body.mimeType) {
      if (!isVoiceTranscriptionConfigured()) {
        return NextResponse.json(
          { error: "Voice transcription is not configured on this server." },
          { status: 500 },
        );
      }
      transcript = await transcribeAudio(body.audio, body.mimeType);
    }

    if (!transcript) {
      return NextResponse.json({ error: "No speech was captured." }, { status: 400 });
    }

    if (body.kind === "task") {
      const tasks = await parseVoiceTasks(transcript);
      if (!tasks.length) {
        return NextResponse.json(
          { error: "Couldn't make out a task in that." },
          { status: 422 },
        );
      }
      return NextResponse.json({ transcript, tasks });
    }

    const referenceDate = body.referenceDate ?? new Date().toISOString().slice(0, 10);
    const timezone = body.timezone ?? "America/New_York";
    const event = await parseVoiceEvent({ transcript, referenceDate, timezone });

    return NextResponse.json({ transcript, event });
  } catch (error) {
    const message =
      error instanceof Error && error.message === "hub-membership-required"
        ? "Only active hub members can use voice commands."
        : error instanceof Error && error.message === "transcription-failed"
          ? "Couldn't transcribe that recording."
          : error instanceof Error && error.message === "transcription-empty"
            ? "Didn't catch any speech in that recording."
            : error instanceof Error && error.message === "voice-parse-failed"
              ? "Couldn't understand that request."
              : "Unable to process voice input.";

    const status =
      error instanceof Error && error.message === "hub-membership-required"
        ? 403
        : error instanceof Error &&
            (error.message === "transcription-failed" ||
              error.message === "transcription-empty" ||
              error.message === "voice-parse-failed")
          ? 422
          : 401;

    return NextResponse.json({ error: message }, { status });
  }
}
