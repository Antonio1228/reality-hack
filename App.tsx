import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View
} from "react-native";
import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { generateRealityMission } from "./src/lib/realityHackApi";
import { deleteAllEvidence, deleteEvidencePhoto, persistEvidencePhoto } from "./src/lib/missionRecords";
import { loadPersistedState, savePersistedState } from "./src/lib/storage";
import {
  readSystemContext,
  requestImmersionPermissions,
  scheduleTestSignalNotification
} from "./src/lib/systemContext";
import type {
  MissionType,
  MissionRecord,
  PlayerModel,
  PlayerProfile,
  RealityMission,
  RealityMissionRequest,
  SavedGeneration,
  SafetyLevel,
  StoryMood,
  SystemContext
} from "./src/types";

type AppTab = "signal" | "mission" | "archive" | "control";
type MissionFeedback = NonNullable<RealityMissionRequest["lastFeedback"]>;

const FREE_MISSION_LIMIT = readFreeMissionLimit();
const IMAGE_MEDIA_TYPES: ImagePicker.MediaType[] = ["images"];

const defaultProfile: PlayerProfile = {
  alias: "A-17",
  safetyLevel: "low",
  storyMood: "glitch",
  language: "zh-TW",
  preferredMinutes: 3,
  locationHint: "日常活動範圍",
  onboardingComplete: false
};

const defaultPlayerModel: PlayerModel = {
  activeWindow: "evening",
  responseSpeed: "normal",
  completionRate: 0,
  preferredMissionType: "observe"
};

export default function App() {
  const colorScheme = useColorScheme();
  const [activeTab, setActiveTab] = useState<AppTab>("signal");
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [draftProfile, setDraftProfile] = useState<PlayerProfile>(defaultProfile);
  const [playerModel, setPlayerModel] = useState<PlayerModel>(defaultPlayerModel);
  const [history, setHistory] = useState<SavedGeneration[]>([]);
  const [generationsUsed, setGenerationsUsed] = useState(0);
  const [isPro, setIsPro] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeMission, setActiveMission] = useState<RealityMission | null>(null);
  const [activeGenerationId, setActiveGenerationId] = useState<string | null>(null);
  const [systemContext, setSystemContext] = useState<SystemContext | null>(null);
  const [systemContextUpdatedAt, setSystemContextUpdatedAt] = useState(0);
  const [lastFeedback, setLastFeedback] = useState<MissionFeedback | undefined>(undefined);
  const [hydrated, setHydrated] = useState(false);

  const missionsLeft = Math.max(FREE_MISSION_LIMIT - generationsUsed, 0);
  const isLocked = !isPro && missionsLeft <= 0;
  const completedCount = history.filter((item) => item.feedback === "completed" || item.completed).length;
  const completionRate = history.length === 0 ? 0 : completedCount / history.length;
  const usageLabel = useMemo(() => isPro ? "PRO" : `${missionsLeft}/${FREE_MISSION_LIMIT}`, [isPro, missionsLeft]);

  useEffect(() => {
    loadPersistedState()
      .then((state) => {
        setGenerationsUsed(state.generationsUsed);
        setIsPro(state.isPro);
        setHistory(state.history);
        setActiveMission(state.history[0]?.mission ?? null);
        setActiveGenerationId(state.history[0]?.id ?? null);
        setLastFeedback(state.history[0]?.feedback);
        setProfile(state.profile);
        if (state.profile) {
          setDraftProfile(state.profile);
        }
      })
      .finally(() => setHydrated(true));
  }, []);

  const refreshSystemContext = useCallback(() => {
    readSystemContext(colorScheme)
      .then((context) => {
        setSystemContext(context);
        setSystemContextUpdatedAt(Date.now());
        setPlayerModel((model) => ({ ...model, activeWindow: inferActiveWindow(context.hour) }));
      })
      .catch(() => setSystemContext(null));
  }, [colorScheme]);

  useEffect(() => {
    refreshSystemContext();
  }, [refreshSystemContext]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    savePersistedState({ generationsUsed, isPro, history, profile }).catch(() => undefined);
  }, [generationsUsed, history, hydrated, isPro, profile]);

  const enableImmersionSensors = useCallback(async () => {
    try {
      const context = await requestImmersionPermissions(colorScheme);
      setSystemContext(context);
      setSystemContextUpdatedAt(Date.now());
      setPlayerModel((model) => ({ ...model, activeWindow: inferActiveWindow(context.hour) }));
      return context;
    } catch (error) {
      Alert.alert("權限同步失敗", error instanceof Error ? error.message : "請稍後再試。");
      return null;
    }
  }, [colorScheme]);

  const completeOnboarding = useCallback(async () => {
    const context = await enableImmersionSensors();
    const nextProfile = {
      ...draftProfile,
      alias: draftProfile.alias.trim() || "A-17",
      locationHint: draftProfile.locationHint.trim() || "日常活動範圍",
      onboardingComplete: true
    };
    setProfile(nextProfile);
    setDraftProfile(nextProfile);
    if (context) {
      setPlayerModel((model) => ({ ...model, activeWindow: inferActiveWindow(context.hour) }));
    }
  }, [draftProfile, enableImmersionSensors]);

  const generateMission = useCallback(async () => {
    if (!profile?.onboardingComplete) {
      return;
    }
    if (isLocked) {
      setActiveTab("control");
      return;
    }

    setIsLoading(true);
    try {
      const context = systemContext && Date.now() - systemContextUpdatedAt < 30_000
        ? systemContext
        : await readSystemContext(colorScheme);
      setSystemContext(context);
      setSystemContextUpdatedAt(Date.now());
      const mission = await generateRealityMission({
        alias: profile.alias,
        locationContext: buildLocationContext(profile, context),
        currentFeeling: buildAutoFeeling(profile, context, lastFeedback),
        availableMinutes: profile.preferredMinutes,
        storyMood: profile.storyMood,
        safetyLevel: profile.safetyLevel,
        systemContext: context,
        playerModel: {
          ...playerModel,
          activeWindow: inferActiveWindow(context.hour),
          completionRate,
          preferredMissionType: inferPreferredMissionType(history)
        },
        previousMission: history[0]?.mission.title,
        lastFeedback,
        language: profile.language
      });
      const item: SavedGeneration = {
        id: `${Date.now()}`,
        createdAt: new Date().toISOString(),
        title: mission.title,
        mission,
        completed: false
      };
      setActiveMission(mission);
      setActiveGenerationId(item.id);
      setHistory((current) => pruneHistoryWithEvidence([item, ...current]));
      setActiveTab("mission");
      if (!isPro) {
        setGenerationsUsed((count) => count + 1);
      }
    } catch (error) {
      Alert.alert("訊號失敗", error instanceof Error ? error.message : "請稍後再試。");
    } finally {
      setIsLoading(false);
    }
  }, [colorScheme, completionRate, history, isLocked, isPro, lastFeedback, playerModel, profile, systemContext, systemContextUpdatedAt]);

  const markMissionFeedback = useCallback((feedback: MissionFeedback) => {
    if (!activeMission || !activeGenerationId) {
      return;
    }
    setLastFeedback(feedback);
    setHistory((current) =>
      current.map((item) =>
        item.id === activeGenerationId
          ? { ...item, completed: feedback === "completed", feedback }
          : item
      )
    );
    setPlayerModel((model) => ({
      ...model,
      responseSpeed: feedback === "completed" ? "fast" : feedback === "unsafe" ? "slow" : "normal",
      preferredMissionType: feedback === "unsafe" ? "observe" : activeMission.missionType
    }));
    Alert.alert("已記錄", feedback === "unsafe" ? "下一個訊號會降低強度。" : "下一個訊號會自動調整。");
  }, [activeGenerationId, activeMission]);

  const updateMissionNote = useCallback((note: string) => {
    if (!activeGenerationId) {
      return;
    }
    setHistory((current) =>
      current.map((item) =>
        item.id === activeGenerationId
          ? {
              ...item,
              record: {
                ...item.record,
                photoUris: item.record?.photoUris ?? [],
                note,
                updatedAt: new Date().toISOString()
              }
            }
          : item
      )
    );
  }, [activeGenerationId]);

  const addEvidencePhoto = useCallback(async (source: "camera" | "library") => {
    if (!activeGenerationId) {
      return;
    }

    try {
      const result = source === "camera"
        ? await ImagePicker.launchCameraAsync({ allowsEditing: false, mediaTypes: IMAGE_MEDIA_TYPES, quality: 0.82 })
        : await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, mediaTypes: IMAGE_MEDIA_TYPES, quality: 0.82 });

      if (result.canceled || !result.assets?.[0]?.uri) {
        return;
      }

      const savedUri = persistEvidencePhoto(result.assets[0].uri, activeGenerationId);
      setHistory((current) =>
        current.map((item) =>
          item.id === activeGenerationId
            ? {
                ...item,
                record: {
                  note: item.record?.note,
                  photoUris: [...(item.record?.photoUris ?? []), savedUri],
                  updatedAt: new Date().toISOString()
                }
              }
            : item
        )
      );
    } catch (error) {
      Alert.alert("照片失敗", error instanceof Error ? error.message : "無法保存照片。");
    }
  }, [activeGenerationId]);

  const deleteEvidenceFromActiveMission = useCallback((uri: string) => {
    if (!activeGenerationId) {
      return;
    }
    Alert.alert("刪除照片", "要從這個任務紀錄移除這張照片嗎？", [
      { text: "取消", style: "cancel" },
      {
        text: "刪除",
        style: "destructive",
        onPress: () => {
          try {
            deleteEvidencePhoto(uri);
          } catch {
            // If the file is already gone, still remove the reference from the archive.
          }
          setHistory((current) =>
            current.map((item) =>
              item.id === activeGenerationId
                ? {
                    ...item,
                    record: {
                      note: item.record?.note,
                      photoUris: (item.record?.photoUris ?? []).filter((photoUri) => photoUri !== uri),
                      updatedAt: new Date().toISOString()
                    }
                  }
                : item
            )
          );
        }
      }
    ]);
  }, [activeGenerationId]);

  const copyMission = useCallback(async () => {
    if (activeMission) {
      await Clipboard.setStringAsync(formatMission(activeMission));
    }
  }, [activeMission]);

  const scheduleProbeNotification = useCallback(async () => {
    try {
      await scheduleTestSignalNotification();
      Alert.alert("已排程", "60 秒後會收到測試通知。");
    } catch (error) {
      Alert.alert("通知失敗", error instanceof Error ? error.message : "請先允許通知。");
    }
  }, []);

  const resetOnboarding = useCallback(() => {
    setDraftProfile({ ...(profile ?? defaultProfile), onboardingComplete: false });
    setProfile(null);
    setActiveTab("signal");
  }, [profile]);

  const deleteAllLocalData = useCallback(() => {
    Alert.alert("刪除本機資料", "會刪除任務檔案、紀錄、照片與首次設定。", [
      { text: "取消", style: "cancel" },
      {
        text: "刪除",
        style: "destructive",
        onPress: () => {
          try {
            deleteAllEvidence();
          } catch {
            // Continue clearing metadata even if one local file cannot be removed.
          }
          setHistory([]);
          setActiveMission(null);
          setActiveGenerationId(null);
          setLastFeedback(undefined);
          setIsPro(false);
          setProfile(null);
          setDraftProfile(defaultProfile);
          setActiveTab("signal");
        }
      }
    ]);
  }, []);

  const activeHistoryItem = useMemo(
    () => history.find((item) => item.id === activeGenerationId) ?? null,
    [activeGenerationId, history]
  );

  if (!hydrated) {
    return <Shell><View style={styles.center}><ActivityIndicator color="#7cffc8" /></View></Shell>;
  }

  if (!profile?.onboardingComplete) {
    return (
      <Shell>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <OnboardingScreen
            completeOnboarding={completeOnboarding}
            draftProfile={draftProfile}
            setDraftProfile={setDraftProfile}
          />
        </ScrollView>
      </Shell>
    );
  }

  return (
    <Shell>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboard}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {activeTab === "signal" && (
            <SignalScreen
              generateMission={generateMission}
              isLoading={isLoading}
              isLocked={isLocked}
              profile={profile}
              systemContext={systemContext}
              usageLabel={usageLabel}
            />
          )}
          {activeTab === "mission" && (
            <MissionScreen
              activeMission={activeMission}
              activeRecord={activeHistoryItem?.record}
              addEvidencePhoto={addEvidencePhoto}
              copyMission={copyMission}
              deleteEvidencePhoto={deleteEvidenceFromActiveMission}
              goSignal={() => setActiveTab("signal")}
              markMissionFeedback={markMissionFeedback}
              updateMissionNote={updateMissionNote}
            />
          )}
          {activeTab === "archive" && <ArchiveScreen history={history} openItem={(item) => {
            setActiveMission(item.mission);
            setActiveGenerationId(item.id);
            setActiveTab("mission");
          }} />}
          {activeTab === "control" && (
            <ControlScreen
              completedCount={completedCount}
              enableImmersionSensors={enableImmersionSensors}
              historyCount={history.length}
              isPro={isPro}
              profile={profile}
              refreshSystemContext={refreshSystemContext}
              resetOnboarding={resetOnboarding}
              deleteAllLocalData={deleteAllLocalData}
              scheduleProbeNotification={scheduleProbeNotification}
              setProfile={setProfile}
              systemContext={systemContext}
              usageLabel={usageLabel}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <BottomTabs activeMission={activeMission} activeTab={activeTab} setActiveTab={setActiveTab} />
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        {children}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function OnboardingScreen({
  completeOnboarding,
  draftProfile,
  setDraftProfile
}: {
  completeOnboarding: () => void;
  draftProfile: PlayerProfile;
  setDraftProfile: (value: PlayerProfile) => void;
}) {
  return (
    <>
      <View style={styles.hero}>
        <Text style={styles.kicker}>REALITY HACK</Text>
        <Text style={styles.title}>初始化</Text>
        <Text style={styles.subtitle}>設定一次。之後直接接收訊號。</Text>
      </View>

      <View style={styles.card}>
        <Field label="代號">
          <TextInput
            value={draftProfile.alias}
            onChangeText={(alias) => setDraftProfile({ ...draftProfile, alias })}
            placeholder="A-17"
            placeholderTextColor="#66706f"
            style={styles.input}
          />
        </Field>
        <Field label="常出現的地方">
          <TextInput
            value={draftProfile.locationHint}
            onChangeText={(locationHint) => setDraftProfile({ ...draftProfile, locationHint })}
            placeholder="校園 / 宿舍 / 通勤"
            placeholderTextColor="#66706f"
            style={styles.input}
          />
        </Field>
        <Field label="任務時間">
          <View style={styles.segment}>
            {[1, 3, 5, 8].map((minutes) => (
              <SegmentButton
                key={minutes}
                active={draftProfile.preferredMinutes === minutes}
                label={`${minutes} 分`}
                onPress={() => setDraftProfile({ ...draftProfile, preferredMinutes: minutes })}
              />
            ))}
          </View>
        </Field>
        <Field label="風格">
          <View style={styles.segment}>
            <MoodButton label="Glitch" mood="glitch" profile={draftProfile} setProfile={setDraftProfile} />
            <MoodButton label="神秘" mood="mysterious" profile={draftProfile} setProfile={setDraftProfile} />
            <MoodButton label="校園" mood="campus" profile={draftProfile} setProfile={setDraftProfile} />
            <MoodButton label="冷靜" mood="calm" profile={draftProfile} setProfile={setDraftProfile} />
          </View>
        </Field>
        <Field label="強度">
          <View style={styles.segment}>
            <SafetyButton label="安全" profile={draftProfile} safetyLevel="low" setProfile={setDraftProfile} />
            <SafetyButton label="微不安" profile={draftProfile} safetyLevel="medium" setProfile={setDraftProfile} />
          </View>
        </Field>
        <Field label="語言">
          <View style={styles.segment}>
            <SegmentButton
              active={draftProfile.language === "zh-TW"}
              label="中文"
              onPress={() => setDraftProfile({ ...draftProfile, language: "zh-TW" })}
            />
            <SegmentButton
              active={draftProfile.language === "en"}
              label="English"
              onPress={() => setDraftProfile({ ...draftProfile, language: "en" })}
            />
          </View>
        </Field>
        <Pressable onPress={completeOnboarding} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>開始</Text>
        </Pressable>
      </View>
    </>
  );
}

function SignalScreen({
  generateMission,
  isLoading,
  isLocked,
  profile,
  systemContext,
  usageLabel
}: {
  generateMission: () => void;
  isLoading: boolean;
  isLocked: boolean;
  profile: PlayerProfile;
  systemContext: SystemContext | null;
  usageLabel: string;
}) {
  return (
    <>
      <View style={styles.hero}>
        <Text style={styles.kicker}>SIGNAL</Text>
        <Text style={styles.title}>{profile.alias}</Text>
        <Text style={styles.subtitle}>{compactContext(systemContext)}</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusPill}>{usageLabel}</Text>
          <Text style={styles.statusPill}>{profile.storyMood}</Text>
        </View>
      </View>
      <View style={styles.card}>
        <Pressable disabled={isLoading} onPress={generateMission} style={[styles.primaryButton, (isLoading || isLocked) && styles.primaryButtonMuted]}>
          {isLoading ? <ActivityIndicator color="#061010" /> : <Text style={styles.primaryButtonText}>{isLocked ? "已鎖定" : "接收訊號"}</Text>}
        </Pressable>
      </View>
    </>
  );
}

function MissionScreen({
  activeMission,
  activeRecord,
  addEvidencePhoto,
  copyMission,
  deleteEvidencePhoto,
  goSignal,
  markMissionFeedback,
  updateMissionNote
}: {
  activeMission: RealityMission | null;
  activeRecord?: MissionRecord;
  addEvidencePhoto: (source: "camera" | "library") => void;
  copyMission: () => void;
  deleteEvidencePhoto: (uri: string) => void;
  goSignal: () => void;
  markMissionFeedback: (feedback: MissionFeedback) => void;
  updateMissionNote: (note: string) => void;
}) {
  if (!activeMission) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>沒有訊號</Text>
        <Pressable onPress={goSignal} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>返回</Text></Pressable>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.sectionTitle}>任務</Text>
        <Pressable onPress={copyMission} style={styles.ghostButton}><Text style={styles.ghostButtonText}>複製</Text></Pressable>
      </View>
      <Text style={styles.missionTitle}>{activeMission.title}</Text>
      <MessageBubble text={activeMission.signalMessage} />
      <ResultBlock title="目標" body={activeMission.objective} />
      <ResultList title="步驟" items={activeMission.steps} />
      <ResultBlock title="完成" body={activeMission.completionCheck} />
      <ResultBlock title="安全" body={activeMission.safetyNote} />
      <Text style={styles.fragmentText}>{activeMission.storyFragment}</Text>
      <View style={styles.recordCard}>
        <Text style={styles.recordTitle}>紀錄</Text>
        <TextInput
          value={activeRecord?.note ?? ""}
          onChangeText={updateMissionNote}
          placeholder="任務需要時，留一句紀錄"
          placeholderTextColor="#66706f"
          style={styles.noteInput}
          multiline
        />
        <View style={styles.actionRow}>
          <Pressable onPress={() => addEvidencePhoto("camera")} style={styles.secondaryButtonSmall}>
            <Text style={styles.secondaryButtonText}>拍照</Text>
          </Pressable>
          <Pressable onPress={() => addEvidencePhoto("library")} style={styles.secondaryButtonSmall}>
            <Text style={styles.secondaryButtonText}>相簿</Text>
          </Pressable>
        </View>
        {(activeRecord?.photoUris ?? []).length > 0 && (
          <View style={styles.photoGrid}>
            {activeRecord?.photoUris.map((uri) => (
              <Pressable key={uri} onLongPress={() => deleteEvidencePhoto(uri)}>
                <Image source={{ uri }} style={styles.evidenceImage} />
              </Pressable>
            ))}
          </View>
        )}
      </View>
      <View style={styles.actionRow}>
        <Pressable onPress={() => markMissionFeedback("completed")} style={styles.primaryButtonSmall}><Text style={styles.primaryButtonText}>完成</Text></Pressable>
        <Pressable onPress={() => markMissionFeedback("skipped")} style={styles.secondaryButtonSmall}><Text style={styles.secondaryButtonText}>略過</Text></Pressable>
      </View>
      <Pressable onPress={() => markMissionFeedback("unsafe")} style={styles.dangerButton}>
        <Text style={styles.dangerButtonText}>太危險</Text>
      </Pressable>
    </View>
  );
}

function ArchiveScreen({
  history,
  openItem
}: {
  history: SavedGeneration[];
  openItem: (item: SavedGeneration) => void;
}) {
  if (history.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>尚無檔案</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>檔案</Text>
      {history.map((item) => (
        <Pressable key={item.id} onPress={() => openItem(item)} style={styles.archiveItem}>
          <Text style={styles.archiveTitle}>{feedbackLabel(item)} / {item.title}</Text>
          <Text style={styles.archiveTime}>
            {new Date(item.createdAt).toLocaleString()} / 照片 {item.record?.photoUris.length ?? 0}
          </Text>
          {!!item.record?.note && <Text style={styles.archiveNote}>{item.record.note}</Text>}
        </Pressable>
      ))}
    </View>
  );
}

function ControlScreen({
  completedCount,
  enableImmersionSensors,
  historyCount,
  isPro,
  profile,
  refreshSystemContext,
  resetOnboarding,
  deleteAllLocalData,
  scheduleProbeNotification,
  setProfile,
  systemContext,
  usageLabel
}: {
  completedCount: number;
  enableImmersionSensors: () => void;
  historyCount: number;
  isPro: boolean;
  profile: PlayerProfile;
  refreshSystemContext: () => void;
  resetOnboarding: () => void;
  deleteAllLocalData: () => void;
  scheduleProbeNotification: () => void;
  setProfile: (profile: PlayerProfile) => void;
  systemContext: SystemContext | null;
  usageLabel: string;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>控制</Text>
      <View style={styles.metricGrid}>
        <Metric label="訊號" value={String(historyCount)} />
        <Metric label="完成" value={String(completedCount)} />
        <Metric label="方案" value={usageLabel} />
      </View>
      <Field label="風格">
        <View style={styles.segment}>
          <MoodButton label="Glitch" mood="glitch" profile={profile} setProfile={setProfile} />
          <MoodButton label="神秘" mood="mysterious" profile={profile} setProfile={setProfile} />
          <MoodButton label="校園" mood="campus" profile={profile} setProfile={setProfile} />
          <MoodButton label="冷靜" mood="calm" profile={profile} setProfile={setProfile} />
        </View>
      </Field>
      <View style={styles.actionRow}>
        <Pressable onPress={enableImmersionSensors} style={styles.primaryButtonSmall}><Text style={styles.primaryButtonText}>權限</Text></Pressable>
        <Pressable onPress={scheduleProbeNotification} style={styles.secondaryButtonSmall}><Text style={styles.secondaryButtonText}>通知</Text></Pressable>
      </View>
      <Pressable onPress={refreshSystemContext} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>刷新狀態</Text></Pressable>
      <SystemSignalList systemContext={systemContext} />
      <Pressable onPress={resetOnboarding} style={styles.dangerButton}><Text style={styles.dangerButtonText}>重設</Text></Pressable>
      <Pressable onPress={deleteAllLocalData} style={styles.dangerButton}><Text style={styles.dangerButtonText}>刪除本機資料</Text></Pressable>
    </View>
  );
}

function MoodButton({
  label,
  mood,
  profile,
  setProfile
}: {
  label: string;
  mood: StoryMood;
  profile: PlayerProfile;
  setProfile: (profile: PlayerProfile) => void;
}) {
  return (
    <SegmentButton
      active={profile.storyMood === mood}
      label={label}
      onPress={() => setProfile({ ...profile, storyMood: mood })}
    />
  );
}

function SafetyButton({
  label,
  profile,
  safetyLevel,
  setProfile
}: {
  label: string;
  profile: PlayerProfile;
  safetyLevel: SafetyLevel;
  setProfile: (profile: PlayerProfile) => void;
}) {
  return (
    <SegmentButton
      active={profile.safetyLevel === safetyLevel}
      label={label}
      onPress={() => setProfile({ ...profile, safetyLevel })}
    />
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function SegmentButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.segmentButton, active && styles.segmentButtonActive]}>
      <Text style={[styles.segmentButtonText, active && styles.segmentButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

function MessageBubble({ text }: { text: string }) {
  return (
    <View style={styles.messageBubble}>
      <Text style={styles.messageText}>{text}</Text>
    </View>
  );
}

function ResultBlock({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.resultBlock}>
      <Text style={styles.resultTitle}>{title}</Text>
      <Text style={styles.resultBody}>{body}</Text>
    </View>
  );
}

function ResultList({ title, items }: { title: string; items: string[] }) {
  return (
    <View style={styles.resultBlock}>
      <Text style={styles.resultTitle}>{title}</Text>
      {items.map((item, index) => (
        <Text key={`${item}-${index}`} style={styles.bullet}>{index + 1}. {item}</Text>
      ))}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function SystemSignalList({ systemContext }: { systemContext: SystemContext | null }) {
  if (!systemContext) {
    return <Text style={styles.mutedText}>尚未同步</Text>;
  }
  const permissionCount = Object.values(systemContext.permissions).filter((value) => value === "granted" || value === "limited").length;
  const place = systemContext.preciseLocation
    ? [systemContext.preciseLocation.city, systemContext.preciseLocation.region].filter(Boolean).join(" / ")
    : "未提供";
  return (
    <View style={styles.signalList}>
      <Text style={styles.mutedText}>時間：{systemContext.hour}:00</Text>
      <Text style={styles.mutedText}>地點：{place || "未提供"}</Text>
      <Text style={styles.mutedText}>電量：{systemContext.batteryLevel ?? "--"}%</Text>
      <Text style={styles.mutedText}>權限：{permissionCount}/7</Text>
    </View>
  );
}

function BottomTabs({
  activeMission,
  activeTab,
  setActiveTab
}: {
  activeMission: RealityMission | null;
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
}) {
  const insets = useSafeAreaInsets();
  const tabs: Array<{ id: AppTab; label: string; disabled?: boolean }> = [
    { id: "signal", label: "訊號" },
    { id: "mission", label: "任務", disabled: !activeMission },
    { id: "archive", label: "檔案" },
    { id: "control", label: "控制" }
  ];
  return (
    <View style={[styles.tabBar, { bottom: Math.max(insets.bottom + 4, 12) }]}>
      {tabs.map((tab) => (
        <Pressable
          key={tab.id}
          disabled={tab.disabled}
          onPress={() => setActiveTab(tab.id)}
          style={[styles.tabItem, activeTab === tab.id && styles.tabItemActive, tab.disabled && styles.tabItemDisabled]}
        >
          <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function inferPreferredMissionType(history: SavedGeneration[]): MissionType {
  if (history[0]?.feedback === "unsafe") {
    return "observe";
  }
  const counts = history.reduce<Record<MissionType, number>>(
    (accumulator, item) => {
      if (item.feedback === "completed" || item.completed) {
        accumulator[item.mission.missionType] += 1;
      }
      return accumulator;
    },
    { observe: 0, action: 0, mind: 0, time: 0 }
  );
  return (Object.entries(counts) as Array<[MissionType, number]>)
    .sort((first, second) => second[1] - first[1])[0]?.[0] ?? "observe";
}

function inferActiveWindow(hour: number): PlayerModel["activeWindow"] {
  if (hour >= 5 && hour < 12) {
    return "morning";
  }
  if (hour >= 12 && hour < 17) {
    return "afternoon";
  }
  if (hour >= 17 && hour < 23) {
    return "evening";
  }
  return "late";
}

function buildLocationContext(profile: PlayerProfile, context: SystemContext | null) {
  const place = context?.preciseLocation
    ? [context.preciseLocation.city, context.preciseLocation.region, context.preciseLocation.country].filter(Boolean).join(" / ")
    : "";
  return [profile.locationHint.trim(), place].filter(Boolean).join("；") || "目前所在的安全環境";
}

function buildAutoFeeling(profile: PlayerProfile, context: SystemContext | null, lastFeedback?: MissionFeedback) {
  if (!context) {
    return `自動摘要：${profile.preferredMinutes} 分鐘，${profile.storyMood}，${profile.safetyLevel}。`;
  }
  const permissionCount = Object.values(context.permissions).filter((value) => value === "granted" || value === "limited").length;
  const feedback = lastFeedback ? `上次：${lastFeedback}` : "上次：無";
  return `自動摘要：${context.weekday} ${context.hour}:00，${context.colorScheme}，電量 ${context.batteryLevel ?? "未知"}%，網路 ${context.networkType ?? "未知"}，權限 ${permissionCount}/7，${feedback}。偏好 ${profile.preferredMinutes} 分鐘 ${profile.storyMood}。`;
}

function compactContext(context: SystemContext | null) {
  if (!context) {
    return "正在同步...";
  }
  return `${context.hour}:00 / ${context.colorScheme} / ${context.batteryLevel ?? "--"}%`;
}

function feedbackLabel(item: SavedGeneration) {
  if (item.feedback === "completed" || item.completed) {
    return "完成";
  }
  if (item.feedback === "unsafe") {
    return "不安全";
  }
  if (item.feedback === "skipped") {
    return "略過";
  }
  return "開啟";
}

function readFreeMissionLimit() {
  const value = Constants.expoConfig?.extra?.freeGenerations;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 3;
}

function pruneHistoryWithEvidence(items: SavedGeneration[]) {
  const kept = items.slice(0, 30);
  const dropped = items.slice(30);

  for (const item of dropped) {
    for (const uri of item.record?.photoUris ?? []) {
      try {
        deleteEvidencePhoto(uri);
      } catch {
        // Ignore stale local file references while pruning archive overflow.
      }
    }
  }

  return kept;
}

function formatMission(mission: RealityMission) {
  return [
    mission.title,
    "",
    mission.signalMessage,
    "",
    mission.objective,
    "",
    ...mission.steps.map((item, index) => `${index + 1}. ${item}`),
    "",
    mission.completionCheck,
    "",
    mission.safetyNote
  ].join("\n");
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#07090b" },
  keyboard: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 18, paddingBottom: 112, gap: 16 },
  hero: {
    backgroundColor: "#10151c",
    borderColor: "#26313f",
    borderWidth: 1,
    borderRadius: 28,
    padding: 22,
    gap: 12
  },
  kicker: { color: "#7cffc8", fontSize: 12, fontWeight: "900", letterSpacing: 3 },
  title: { color: "#f4f7ff", fontSize: 34, lineHeight: 40, fontWeight: "900" },
  subtitle: { color: "#aeb8c8", fontSize: 15, lineHeight: 22 },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusPill: {
    color: "#7cffc8",
    backgroundColor: "#13251f",
    borderColor: "#235542",
    borderWidth: 1,
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 7,
    fontSize: 12,
    fontWeight: "900"
  },
  card: {
    backgroundColor: "#0d1117",
    borderColor: "#252c38",
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 14
  },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sectionTitle: { color: "#f4f7ff", fontSize: 21, fontWeight: "900" },
  field: { gap: 8 },
  label: { color: "#9aa6b6", fontSize: 13, fontWeight: "900" },
  input: {
    backgroundColor: "#07090b",
    borderColor: "#2b3442",
    borderWidth: 1,
    borderRadius: 16,
    color: "#f4f7ff",
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  segment: { flexDirection: "row", flexWrap: "wrap", backgroundColor: "#07090b", borderRadius: 16, padding: 4, gap: 4 },
  segmentButton: { flexGrow: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 8, alignItems: "center" },
  segmentButtonActive: { backgroundColor: "#7cffc8" },
  segmentButtonText: { color: "#9aa6b6", fontWeight: "900", fontSize: 12 },
  segmentButtonTextActive: { color: "#06100c" },
  primaryButton: { backgroundColor: "#7cffc8", borderRadius: 18, paddingVertical: 16, alignItems: "center" },
  primaryButtonMuted: { backgroundColor: "#56615f" },
  primaryButtonSmall: { flex: 1, backgroundColor: "#7cffc8", borderRadius: 16, paddingVertical: 13, alignItems: "center" },
  primaryButtonText: { color: "#06100c", fontSize: 16, fontWeight: "900" },
  secondaryButton: { backgroundColor: "#1b2330", borderRadius: 16, paddingVertical: 13, alignItems: "center", paddingHorizontal: 16 },
  secondaryButtonSmall: { flex: 1, backgroundColor: "#1b2330", borderRadius: 16, paddingVertical: 13, alignItems: "center" },
  secondaryButtonText: { color: "#d9e4f5", fontWeight: "900" },
  dangerButton: {
    backgroundColor: "#2a1717",
    borderColor: "#5f2828",
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: "center"
  },
  dangerButtonText: { color: "#ffb8b8", fontWeight: "900" },
  ghostButton: { backgroundColor: "#1b2330", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  ghostButtonText: { color: "#7cffc8", fontWeight: "900" },
  missionTitle: { color: "#f4f7ff", fontSize: 25, lineHeight: 31, fontWeight: "900" },
  messageBubble: { backgroundColor: "#071d18", borderColor: "#1b604a", borderWidth: 1, borderRadius: 22, padding: 16 },
  messageText: { color: "#dfffee", fontSize: 16, lineHeight: 24 },
  resultBlock: { gap: 7 },
  resultTitle: { color: "#f4f7ff", fontSize: 16, fontWeight: "900" },
  resultBody: { color: "#c7d0dc", fontSize: 15, lineHeight: 23 },
  bullet: { color: "#c7d0dc", fontSize: 15, lineHeight: 24 },
  fragmentText: { color: "#ead8ff", backgroundColor: "#17111e", borderRadius: 18, padding: 14, fontSize: 15, lineHeight: 23 },
  recordCard: { backgroundColor: "#101720", borderRadius: 18, padding: 14, gap: 10 },
  recordTitle: { color: "#f4f7ff", fontSize: 16, fontWeight: "900" },
  noteInput: {
    minHeight: 72,
    backgroundColor: "#07090b",
    borderColor: "#2b3442",
    borderWidth: 1,
    borderRadius: 14,
    color: "#f4f7ff",
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  evidenceImage: { width: 92, height: 92, borderRadius: 14, backgroundColor: "#07090b" },
  actionRow: { flexDirection: "row", gap: 10 },
  emptyCard: {
    backgroundColor: "#0d1117",
    borderStyle: "dashed",
    borderColor: "#2b3442",
    borderWidth: 1,
    borderRadius: 24,
    padding: 22,
    alignItems: "center",
    gap: 10
  },
  emptyTitle: { color: "#f4f7ff", fontSize: 18, fontWeight: "900" },
  archiveItem: { backgroundColor: "#121924", borderRadius: 16, padding: 14, gap: 5 },
  archiveTitle: { color: "#f4f7ff", fontWeight: "900" },
  archiveTime: { color: "#7f8a9b", fontSize: 12 },
  archiveNote: { color: "#aeb8c8", fontSize: 13, lineHeight: 19 },
  metricGrid: { flexDirection: "row", gap: 10 },
  metricCard: { flex: 1, backgroundColor: "#121924", borderRadius: 16, padding: 14, alignItems: "center" },
  metricValue: { color: "#7cffc8", fontSize: 22, fontWeight: "900" },
  metricLabel: { color: "#9aa6b6", fontSize: 12, fontWeight: "800" },
  signalList: { backgroundColor: "#121924", borderRadius: 16, padding: 14, gap: 6 },
  mutedText: { color: "#aeb8c8", fontSize: 14, lineHeight: 20 },
  tabBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    backgroundColor: "#121924",
    borderColor: "#283241",
    borderWidth: 1,
    borderRadius: 24,
    padding: 6,
    gap: 4
  },
  tabItem: { flex: 1, borderRadius: 18, paddingVertical: 12, alignItems: "center" },
  tabItemActive: { backgroundColor: "#7cffc8" },
  tabItemDisabled: { opacity: 0.4 },
  tabText: { color: "#aeb8c8", fontSize: 13, fontWeight: "900" },
  tabTextActive: { color: "#06100c" }
});
