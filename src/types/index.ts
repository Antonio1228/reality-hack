export type MissionType = "observe" | "action" | "mind" | "time";
export type SafetyLevel = "low" | "medium";
export type StoryMood = "mysterious" | "glitch" | "calm" | "campus";

export type PlayerModel = {
  activeWindow: "morning" | "afternoon" | "evening" | "late";
  responseSpeed: "fast" | "normal" | "slow";
  completionRate: number;
  preferredMissionType: MissionType;
};

export type PlayerProfile = {
  alias: string;
  safetyLevel: SafetyLevel;
  storyMood: StoryMood;
  language: "zh-TW" | "en";
  preferredMinutes: number;
  locationHint: string;
  onboardingComplete: boolean;
};

export type PermissionState = "unknown" | "undetermined" | "granted" | "denied" | "limited";

export type RealityLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  heading: number | null;
  speed: number | null;
  city: string | null;
  region: string | null;
  country: string | null;
};

export type SystemContext = {
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
  colorScheme: "light" | "dark" | "unknown";
  batteryLevel: number | null;
  lowPowerMode: boolean | null;
  networkType: string | null;
  isInternetReachable: boolean | null;
  permissions: {
    location: PermissionState;
    notifications: PermissionState;
    camera: PermissionState;
    microphone: PermissionState;
    photos: PermissionState;
    mediaLibrary: PermissionState;
    motion: PermissionState;
  };
  preciseLocation: RealityLocation | null;
  mediaLibraryAssetCount: number | null;
  motionAvailable: boolean | null;
};

export type RealityMissionRequest = {
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

export type RealityMission = {
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

export type MissionRecord = {
  note?: string;
  photoUris: string[];
  updatedAt: string;
};

export type SavedGeneration = {
  id: string;
  createdAt: string;
  title: string;
  mission: RealityMission;
  completed: boolean;
  feedback?: "completed" | "skipped" | "unsafe";
  record?: MissionRecord;
};
