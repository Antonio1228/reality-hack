import { ColorSchemeName, Platform } from "react-native";
import * as Battery from "expo-battery";
import { Camera } from "expo-camera";
import * as Device from "expo-device";
import * as ImagePicker from "expo-image-picker";
import * as Localization from "expo-localization";
import * as Location from "expo-location";
import * as MediaLibrary from "expo-media-library";
import * as Network from "expo-network";
import * as Notifications from "expo-notifications";
import { DeviceMotion } from "expo-sensors";

import type { PermissionState, RealityLocation, SystemContext } from "../types";

export async function readSystemContext(colorScheme: ColorSchemeName): Promise<SystemContext> {
  const now = new Date();
  const [
    batteryLevelResult,
    lowPowerResult,
    networkResult,
    permissionsResult,
    locationResult,
    assetCountResult,
    motionAvailableResult,
    deviceTypeResult
  ] = await Promise.allSettled([
    Battery.getBatteryLevelAsync(),
    Battery.isLowPowerModeEnabledAsync(),
    Network.getNetworkStateAsync(),
    readPermissionSnapshot(),
    readPreciseLocationIfAllowed(),
    readMediaLibraryAssetCountIfAllowed(),
    DeviceMotion.isAvailableAsync(),
    resolveDeviceType()
  ]);

  const locales = Localization.getLocales();
  const calendars = Localization.getCalendars();
  const primaryLocale = locales[0];
  const primaryCalendar = calendars[0];

  return {
    platform: Platform.OS,
    deviceName: Device.deviceName ?? null,
    deviceType: deviceTypeResult.status === "fulfilled" ? deviceTypeResult.value : "unknown",
    modelName: Device.modelName ?? null,
    osName: Device.osName ?? null,
    osVersion: Device.osVersion ?? null,
    locale: primaryLocale?.languageTag ?? null,
    timezone: primaryCalendar?.timeZone ?? null,
    hour: now.getHours(),
    weekday: now.toLocaleDateString("en-US", { weekday: "long" }),
    colorScheme: colorScheme === "light" || colorScheme === "dark" ? colorScheme : "unknown",
    batteryLevel:
      batteryLevelResult.status === "fulfilled"
        ? Math.round(Math.max(0, batteryLevelResult.value) * 100)
        : null,
    lowPowerMode:
      lowPowerResult.status === "fulfilled"
        ? lowPowerResult.value
        : null,
    networkType:
      networkResult.status === "fulfilled"
        ? networkResult.value.type ?? null
        : null,
    isInternetReachable:
      networkResult.status === "fulfilled"
        ? networkResult.value.isInternetReachable ?? null
        : null,
    permissions:
      permissionsResult.status === "fulfilled"
        ? permissionsResult.value
        : emptyPermissionSnapshot(),
    preciseLocation:
      locationResult.status === "fulfilled"
        ? locationResult.value
        : null,
    mediaLibraryAssetCount:
      assetCountResult.status === "fulfilled"
        ? assetCountResult.value
        : null,
    motionAvailable:
      motionAvailableResult.status === "fulfilled"
        ? motionAvailableResult.value
        : null
  };
}

export async function requestImmersionPermissions(colorScheme: ColorSchemeName): Promise<SystemContext> {
  const permissionResults = await Promise.allSettled([
    Location.requestForegroundPermissionsAsync(),
    Notifications.requestPermissionsAsync(),
    Camera.requestCameraPermissionsAsync(),
    Camera.requestMicrophonePermissionsAsync(),
    ImagePicker.requestMediaLibraryPermissionsAsync(),
    MediaLibrary.requestPermissionsAsync(false),
    requestMotionPermissionIfAvailable()
  ]);

  if (permissionResults.every((result) => result.status === "rejected")) {
    throw new Error("Unable to request sensor permissions.");
  }

  return readSystemContext(colorScheme);
}

export async function scheduleTestSignalNotification() {
  await Notifications.scheduleNotificationAsync({
    identifier: "reality-hack-test-signal",
    content: {
      title: "Reality Hack",
      body: "異常訊號已排程。60 秒後觀察你的環境。",
      sound: true
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 60
    }
  });
}

async function resolveDeviceType() {
  try {
    const type = await Device.getDeviceTypeAsync();
    switch (type) {
      case Device.DeviceType.PHONE:
        return "phone";
      case Device.DeviceType.TABLET:
        return "tablet";
      case Device.DeviceType.DESKTOP:
        return "desktop";
      case Device.DeviceType.TV:
        return "tv";
      default:
        return "unknown";
    }
  } catch {
    return "unknown";
  }
}

async function readPermissionSnapshot() {
  const [location, notifications, camera, microphone, photos, mediaLibrary, motion] =
    await Promise.allSettled([
      Location.getForegroundPermissionsAsync(),
      Notifications.getPermissionsAsync(),
      Camera.getCameraPermissionsAsync(),
      Camera.getMicrophonePermissionsAsync(),
      ImagePicker.getMediaLibraryPermissionsAsync(),
      MediaLibrary.getPermissionsAsync(false),
      readMotionPermissionIfAvailable()
    ]);

  return {
    location: permissionFromResult(location),
    notifications: permissionFromResult(notifications),
    camera: permissionFromResult(camera),
    microphone: permissionFromResult(microphone),
    photos: permissionFromResult(photos),
    mediaLibrary: permissionFromResult(mediaLibrary),
    motion: permissionFromResult(motion)
  };
}

function emptyPermissionSnapshot() {
  return {
    location: "unknown" as PermissionState,
    notifications: "unknown" as PermissionState,
    camera: "unknown" as PermissionState,
    microphone: "unknown" as PermissionState,
    photos: "unknown" as PermissionState,
    mediaLibrary: "unknown" as PermissionState,
    motion: "unknown" as PermissionState
  };
}

function permissionFromResult(result: PromiseSettledResult<unknown>): PermissionState {
  if (result.status !== "fulfilled") {
    return "unknown";
  }

  const value = result.value as { status?: string; granted?: boolean; accessPrivileges?: string };
  if (value.accessPrivileges === "limited") {
    return "limited";
  }
  if (value.granted === true || value.status === "granted") {
    return "granted";
  }
  if (value.status === "denied") {
    return "denied";
  }
  if (value.status === "undetermined") {
    return "undetermined";
  }
  return "unknown";
}

async function readPreciseLocationIfAllowed(): Promise<RealityLocation | null> {
  const permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) {
    return null;
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced
  });

  const geocode = await Location.reverseGeocodeAsync({
    latitude: position.coords.latitude,
    longitude: position.coords.longitude
  }).catch(() => []);
  const place = geocode[0];

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy ?? null,
    altitude: position.coords.altitude ?? null,
    heading: position.coords.heading ?? null,
    speed: position.coords.speed ?? null,
    city: place?.city ?? null,
    region: place?.region ?? null,
    country: place?.country ?? null
  };
}

async function readMediaLibraryAssetCountIfAllowed(): Promise<number | null> {
  const permission = await MediaLibrary.getPermissionsAsync(false);
  if (!permission.granted && permission.accessPrivileges !== "limited") {
    return null;
  }

  const assets = await MediaLibrary.getAssetsAsync({ first: 1 });
  return assets.totalCount ?? null;
}

async function readMotionPermissionIfAvailable() {
  const motion = DeviceMotion as unknown as {
    getPermissionsAsync?: () => Promise<unknown>;
  };
  if (!motion.getPermissionsAsync) {
    return { status: "unknown" };
  }
  return motion.getPermissionsAsync();
}

async function requestMotionPermissionIfAvailable() {
  const motion = DeviceMotion as unknown as {
    requestPermissionsAsync?: () => Promise<unknown>;
  };
  if (!motion.requestPermissionsAsync) {
    return { status: "unknown" };
  }
  return motion.requestPermissionsAsync();
}
