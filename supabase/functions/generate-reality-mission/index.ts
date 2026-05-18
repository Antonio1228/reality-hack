import OpenAI from "npm:openai@^6.0.0";
import { createClient } from "npm:@supabase/supabase-js@^2.100.0";

type MissionType = "observe" | "action" | "mind" | "time";
type SafetyLevel = "low" | "medium";
type StoryMood = "mysterious" | "glitch" | "calm" | "campus";

type PlayerModel = {
  activeWindow: "morning" | "afternoon" | "evening" | "late";
  responseSpeed: "fast" | "normal" | "slow";
  completionRate: number;
  preferredMissionType: MissionType;
};

type SystemContext = {
  platform: string;
  deviceName: string | null;
  deviceType: string;
  modelName: string | null;
  osName: string | null;
  osVersion: string | null;
  locale: string | null;
  timezone: string | null;
  hour: number;
  weekday: string;
  colorScheme: string;
  batteryLevel: number | null;
  lowPowerMode: boolean | null;
  networkType: string | null;
  isInternetReachable: boolean | null;
  permissions?: Record<string, string>;
  preciseLocation?: {
    city: string | null;
    region: string | null;
    country: string | null;
  } | null;
  mediaLibraryAssetCount?: number | null;
  motionAvailable?: boolean | null;
};

type RealityMissionRequest = {
  alias: string;
  locationContext: string;
  currentFeeling: string;
  availableMinutes: number;
  storyMood: StoryMood;
  safetyLevel: SafetyLevel;
  playerModel: PlayerModel;
  systemContext?: SystemContext;
  previousMission?: string;
  lastFeedback?: "completed" | "skipped" | "unsafe";
  language: "zh-TW" | "en";
};

type RealityMission = {
  title: string;
  signalMessage: string;
  missionType: MissionType;
  objective: string;
  steps: string[];
  completionCheck: string;
  safetyNote: string;
  storyFragment: string;
  nextHook: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400"
};

let openAIClient: OpenAI | null = null;

function getOpenAIClient() {
  if (!openAIClient) {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      throw new Error("Missing OPENAI_API_KEY");
    }
    openAIClient = new OpenAI({ apiKey });
  }
  return openAIClient;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false }
    })
  : null;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let input: RealityMissionRequest | null = null;

  try {
    input = await request.json() as RealityMissionRequest;
    validateInput(input);
    const safeInput = sanitizeMissionRequest(input);
    await enforceRateLimit(request);

    const userId = await getAuthenticatedUserId(request);
    const { mission, outputChars } = await generateSafeMission(safeInput);
    await logGeneration(request, safeInput, "success", outputChars, undefined, userId);
    return json(mission, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected generation error.";
    const userId = await getAuthenticatedUserId(request);
    await logGeneration(request, input ? sanitizeMissionRequest(input) : null, "error", 0, message, userId);
    return json({ error: publicErrorMessage(message) }, 400);
  }
});

function validateInput(input: RealityMissionRequest) {
  if ((input.alias?.length ?? 0) > 120) {
    throw new Error("Alias is too long.");
  }
  if ((input.locationContext?.length ?? 0) > 500) {
    throw new Error("Location context is too long.");
  }
  if (!input.currentFeeling || input.currentFeeling.trim().length < 4) {
    throw new Error("Current feeling is too short.");
  }
  if (input.currentFeeling.length > 2000) {
    throw new Error("Current feeling is too long.");
  }
  if ((input.previousMission?.length ?? 0) > 300) {
    throw new Error("Previous mission is too long.");
  }
  if ((input.availableMinutes ?? 0) < 1 || input.availableMinutes > 10) {
    throw new Error("Mission time must be between 1 and 10 minutes.");
  }
  const inputLength =
    (input.alias?.length ?? 0) +
    (input.locationContext?.length ?? 0) +
    input.currentFeeling.length +
    (input.previousMission?.length ?? 0);
  if (inputLength > 5000) {
    throw new Error("Input is too long. Please shorten it.");
  }
}

function sanitizeMissionRequest(input: RealityMissionRequest): RealityMissionRequest {
  return {
    ...input,
    alias: input.alias?.slice(0, 120) ?? "",
    locationContext: input.locationContext?.slice(0, 500) ?? "",
    currentFeeling: input.currentFeeling?.slice(0, 2000) ?? "",
    previousMission: input.previousMission?.slice(0, 300),
    systemContext: sanitizeSystemContext(input.systemContext)
  };
}

function sanitizeSystemContext(context?: SystemContext): SystemContext | undefined {
  if (!context) {
    return undefined;
  }

  return {
    platform: context.platform,
    deviceName: null,
    deviceType: context.deviceType,
    modelName: null,
    osName: context.osName,
    osVersion: null,
    locale: context.locale,
    timezone: context.timezone,
    hour: context.hour,
    weekday: context.weekday,
    colorScheme: context.colorScheme,
    batteryLevel: context.batteryLevel,
    lowPowerMode: context.lowPowerMode,
    networkType: context.networkType,
    isInternetReachable: context.isInternetReachable,
    permissions: context.permissions,
    preciseLocation: context.preciseLocation
      ? {
          city: context.preciseLocation.city,
          region: context.preciseLocation.region,
          country: context.preciseLocation.country
        }
      : null,
    mediaLibraryAssetCount: context.mediaLibraryAssetCount,
    motionAvailable: context.motionAvailable
  };
}

function buildInstructions(language: RealityMissionRequest["language"]) {
  const outputLanguage = language === "en" ? "English" : "Traditional Chinese";

  return [
    "You are Reality Hack, a mysterious but safety-first AI game master for an alternate reality game.",
    "Generate one immersive real-world micro mission that can be completed safely in 1 to 10 minutes.",
    "The experience should feel like a strange signal crossing into reality, but it must not be genuinely frightening or unsafe.",
    "Never ask the player to trespass, travel far, go outside late at night, follow people, confront strangers, upload photos, reveal private data, break rules, damage property, or do dangerous dares.",
    "You may ask for an optional local evidence photo only when it is safe, harmless, and does not include people, addresses, private screens, documents, or sensitive information.",
    "Never generate self-harm, violence, harassment, sexual, humiliating, illegal, medical, legal, or financial advice content.",
    "If the input suggests crisis or danger, keep the mission indoors and grounding-focused, and include a safety note to seek trusted help or local emergency support if needed.",
    `Write all user-facing content in ${outputLanguage}.`,
    "Return only valid minified JSON. Do not wrap it in markdown.",
    "The JSON object must match this TypeScript shape exactly:",
    `{
      "title": "string",
      "signalMessage": "string",
      "missionType": "observe|action|mind|time",
      "objective": "string",
      "steps": ["string"],
      "completionCheck": "string",
      "safetyNote": "string",
      "storyFragment": "string",
      "nextHook": "string"
    }`,
    "Create 3 to 5 steps.",
    "completionCheck should prefer a tap/button style completion check. It may ask the player to save a local note or local photo evidence inside the app when useful.",
    "If a photo is suggested, say it is saved only in the app evidence archive. Avoid the words upload or send for photos.",
    "safetyNote must explicitly say the player can skip the mission.",
    "Make the mission specific to alias, locationContext, currentFeeling, availableMinutes, storyMood, safetyLevel, playerModel, and previousMission.",
    "Use lastFeedback to adapt the next mission: completed can slightly deepen immersion, skipped should make the mission shorter, unsafe must lower intensity and keep it calm and indoors.",
    "If systemContext is available, subtly use safe signals like hour, weekday, locale, color scheme, battery level, low power mode, device type, and network type for immersion.",
    "Do not imply access to exact GPS, camera, microphone, contacts, photos, messages, or private files.",
    "Use light unease, mystery, and glitch language, not horror."
  ].join("\n");
}

async function generateSafeMission(input: RealityMissionRequest) {
  let lastError = "Generated mission failed safety validation. Please retry.";
  const modelCandidates = getModelCandidates();

  for (const model of modelCandidates) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await getOpenAIClient().responses.create({
          model,
          max_output_tokens: getMaxOutputTokens(),
          instructions: buildInstructions(input.language),
          input: JSON.stringify({
            ...input,
            safetyRetry: attempt > 0,
            safetyRetryInstruction: attempt > 0
              ? "Previous output was empty, invalid JSON, or tripped the safety validator. Return one valid minified JSON object only. Keep the mission indoors or in-place, avoid travel, avoid strangers, and if using photos only say local evidence archive."
              : undefined
          })
        });

        const text = response.output_text?.trim() ?? "";
        if (!text) {
          throw new Error(`AI returned empty mission output from ${model}.`);
        }

        const mission = parseJsonMission(text);
        await validateMissionSafety(mission);
        return { mission, outputChars: text.length };
      } catch (error) {
        lastError = error instanceof Error ? error.message : lastError;
      }
    }
  }

  throw new Error(lastError);
}

function getModelCandidates() {
  const configuredModel = Deno.env.get("OPENAI_MODEL")?.trim();
  const fallbackModel = "gpt-4.1-mini";
  return [...new Set([configuredModel, fallbackModel].filter(Boolean))] as string[];
}

function getMaxOutputTokens() {
  const parsed = Number(Deno.env.get("OPENAI_MAX_OUTPUT_TOKENS") ?? 1600);
  if (!Number.isFinite(parsed)) {
    return 1600;
  }
  return Math.min(Math.max(Math.trunc(parsed), 800), 2400);
}

async function getAuthenticatedUserId(request: Request) {
  if (!supabase) {
    return null;
  }

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }
  return data.user.id;
}

function publicErrorMessage(message: string) {
  if (message.startsWith("Too many mission requests")) {
    return message;
  }
  if (
    message === "Alias is too long." ||
    message === "Location context is too long." ||
    message === "Current feeling is too short." ||
    message === "Current feeling is too long." ||
    message === "Previous mission is too long." ||
    message === "Mission time must be between 1 and 10 minutes." ||
    message === "Input is too long. Please shorten it."
  ) {
    return message;
  }
  return "Mission generation failed. Please try again.";
}

function parseJsonMission(text: string): RealityMission {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned) as RealityMission;

  if (
    typeof parsed.title !== "string" ||
    typeof parsed.signalMessage !== "string" ||
    typeof parsed.objective !== "string" ||
    typeof parsed.completionCheck !== "string" ||
    typeof parsed.safetyNote !== "string" ||
    typeof parsed.storyFragment !== "string" ||
    typeof parsed.nextHook !== "string" ||
    !Array.isArray(parsed.steps)
  ) {
    throw new Error("AI returned an invalid response shape.");
  }

  if (!["observe", "action", "mind", "time"].includes(parsed.missionType)) {
    parsed.missionType = "observe";
  }

  return parsed;
}

async function validateMissionSafety(mission: RealityMission) {
  const text = JSON.stringify(mission).toLowerCase();
  const blocked = [
    "follow a stranger",
    "跟蹤",
    "stranger home",
    "private property",
    "trespass",
    "闖入",
    "穿越馬路",
    "cross the road suddenly",
    "深夜外出",
    "go outside late",
    "harm yourself",
    "self-harm"
  ];

  if (blocked.some((term) => text.includes(term))) {
    throw new Error("Generated mission failed safety validation. Please retry.");
  }

  const moderation = await getOpenAIClient().moderations.create({
    model: "omni-moderation-latest",
    input: JSON.stringify(mission)
  });

  if (moderation.results[0]?.flagged) {
    throw new Error("Generated mission failed safety validation. Please retry.");
  }
}

async function enforceRateLimit(request: Request) {
  if (!supabase) {
    return;
  }

  const clientIp = getClientIp(request);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from("generation_logs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", oneHourAgo)
    .filter("metadata->>clientIp", "eq", clientIp);

  if (error) {
    console.error("Rate limit check failed", error.message);
    return;
  }

  if ((count ?? 0) >= 30) {
    throw new Error("Too many mission requests. Please wait and try again later.");
  }
}

function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  return forwarded.split(",")[0]?.trim() || request.headers.get("cf-connecting-ip") || "unknown";
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

async function logGeneration(
  request: Request,
  input: RealityMissionRequest | null,
  status: "success" | "error",
  outputChars: number,
  errorMessage?: string,
  userId?: string | null
) {
  if (!supabase || !input) {
    return;
  }

  const inputChars =
    (input.alias?.length ?? 0) +
    (input.locationContext?.length ?? 0) +
    (input.currentFeeling?.length ?? 0) +
    (input.previousMission?.length ?? 0);

  const { error } = await supabase.from("generation_logs").insert({
    user_id: userId ?? null,
    app_name: "reality_hack",
    event_type: "mission_generation",
    context_label: input.storyMood?.slice(0, 80) ?? null,
    language: input.language ?? "zh-TW",
    tone: input.safetyLevel ?? "low",
    status,
    mission_type: input.playerModel?.preferredMissionType ?? null,
    safety_level: input.safetyLevel ?? null,
    story_mood: input.storyMood ?? null,
    available_minutes: input.availableMinutes ?? null,
    redaction_level: "summary_only",
    metadata: {
      activeWindow: input.playerModel?.activeWindow ?? null,
      responseSpeed: input.playerModel?.responseSpeed ?? null,
      completionRate: input.playerModel?.completionRate ?? null,
      hasPreviousMission: Boolean(input.previousMission),
      lastFeedback: input.lastFeedback ?? null,
      clientIp: getClientIp(request),
      systemContext: input.systemContext ?? null
    },
    error_message: errorMessage?.slice(0, 1000) ?? null,
    input_chars: inputChars,
    output_chars: outputChars
  });

  if (error) {
    console.error("Failed to write generation log", error.message);
  }
}
