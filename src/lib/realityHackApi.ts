import type { RealityMission, RealityMissionRequest } from "../types";

const FUNCTION_URL = process.env.EXPO_PUBLIC_SUPABASE_FUNCTION_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
const USE_MOCK_AI = process.env.EXPO_PUBLIC_USE_MOCK_AI === "true";
const REQUEST_TIMEOUT_MS = 60_000;

export async function generateRealityMission(input: RealityMissionRequest): Promise<RealityMission> {
  if (USE_MOCK_AI || !FUNCTION_URL || !SUPABASE_ANON_KEY) {
    return buildMockMission(input);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY
    },
    body: JSON.stringify(sanitizeRequestForNetwork(input)),
    signal: controller.signal
  }).finally(() => clearTimeout(timeoutId));

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error ?? "Mission generation failed. Please try again.");
  }

  return payload as RealityMission;
}

function sanitizeRequestForNetwork(input: RealityMissionRequest): RealityMissionRequest {
  return {
    ...input,
    systemContext: input.systemContext
      ? {
          ...input.systemContext,
          preciseLocation: null
        }
      : undefined
  };
}

function buildMockMission(input: RealityMissionRequest): RealityMission {
  if (input.language === "en") {
    return {
      title: "Signal 001: The Misplaced Pattern",
      signalMessage: `${input.alias || "Player"}, your routine has a weak seam. We found it near ${input.locationContext || "where you are"} at ${input.systemContext?.hour ?? "an unknown hour"}.`,
      missionType: "observe",
      objective: "Find one object nearby that looks slightly out of place and describe why it feels wrong.",
      steps: [
        "Stay somewhere safe and public.",
        "Look around slowly for 30 seconds.",
        "Pick one harmless detail that feels unusual.",
        "Write one sentence beginning with: It should not be here because..."
      ],
      completionCheck: "Return with the sentence you wrote. No photo is required.",
      safetyNote: "Do not enter private areas, cross roads suddenly, follow strangers, or do anything that feels unsafe.",
      storyFragment: "The system marks small inconsistencies before larger ones appear.",
      nextHook: "If your answer is specific enough, the next signal will choose a different sense."
    };
  }

  return {
    title: "訊號 001：錯位的圖案",
    signalMessage: `${input.alias || "玩家"}，你的日常出現了一條很細的裂縫。系統在 ${input.systemContext?.hour ?? "未知"} 點，於「${input.locationContext || "你所在的地方"}」附近偵測到它。`,
    missionType: "observe",
    objective: "找出附近一個看起來有點不對勁、但完全安全無害的物件，寫下它為什麼讓你覺得錯位。",
    steps: [
      "待在安全、公開、你熟悉的位置。",
      "慢慢觀察周圍 30 秒。",
      "選一個無害但有點突兀的小細節。",
      "寫下一句：它不該在這裡，因為..."
    ],
    completionCheck: "回報你寫下的那一句。不需要拍照。",
    safetyNote: "不要進入私人區域、不要突然穿越馬路、不要跟蹤陌生人、不要做任何讓你不舒服或不安全的事。",
    storyFragment: "系統通常會先標記小型不一致，然後才讓大型異常浮上來。",
    nextHook: "如果你的回報夠具體，下一個訊號會改用另一種感官測試你。"
  };
}
