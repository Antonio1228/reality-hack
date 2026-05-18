# Reality Hack

Reality Hack is an AI-assisted mobile ARG prototype built with Expo and Supabase Edge Functions. Players receive short, safe, real-world micro-missions, while the backend keeps AI keys off the device and logs generation metadata for cost monitoring.

## Portfolio highlights

- Demonstrates an AI product architecture where the mobile app calls a Supabase Edge Function instead of shipping the OpenAI key in the client.
- Treats safety as a product requirement: missions avoid dangerous places, private areas, stalking behavior, late-night escalation, sensitive uploads, and psychological harm.
- Uses device context progressively: low-risk system context first, explicit permissions only when the player enables immersive sensors.
- Includes monetization planning, Pro gating, and release-oriented build commands.

## MVP features

- Player alias, local context, current feeling, and available-time input.
- AI-generated 1 to 5 minute micro-missions.
- Mission types: observation, action, psychological reflection, and time-triggered tasks.
- Story moods: glitch, mystery, campus, calm.
- Safety levels: low stimulation and light unease.
- Local player model for active window, response speed, completion rate, and preferred mission type.
- Local mission archive.
- Free signal quota with planned Pro upgrade path.

## Safety design

Reality Hack does not ask players to:

- Enter dangerous or private areas.
- Follow strangers.
- Go outside late at night.
- Upload sensitive photos or personal information.
- Perform illegal, humiliating, unsafe, or psychologically harmful tasks.

Every mission can be skipped.

## Context strategy

The app can use low-risk context without prompting for permissions:

- Device type and model.
- OS name and version.
- Locale and timezone.
- Current hour and weekday.
- Light/dark appearance.
- Battery level and low-power mode.
- Network type and reachability.

Immersive sensors are opt-in and requested only after the player enables them:

- Location.
- Camera and photo library.
- Microphone.
- Notifications.
- Motion sensors.
- Media library read permission.

Contacts, calendar, health data, SMS, and call records are intentionally out of scope.

## Tech stack

- Expo 54 + React Native 0.81
- TypeScript
- AsyncStorage
- Supabase Edge Functions
- OpenAI Responses API

## Local setup

```bash
git clone https://github.com/Antonio1228/reality-hack.git
cd reality-hack
npm install
npm run start
```

## Environment

Create a local `.env` file from these placeholders:

```env
EXPO_PUBLIC_SUPABASE_FUNCTION_URL=https://your-project.supabase.co/functions/v1/generate-reality-mission
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_publishable_key
EXPO_PUBLIC_USE_MOCK_AI=false
```

OpenAI credentials must be stored in Supabase Secrets, never in the Expo client.

```bash
npx supabase login
npx supabase secrets set OPENAI_API_KEY=your_openai_key
```

Deploy the Edge Function with the project deployment script:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-supabase.ps1
```

## Data and logging

Generation metadata is recorded in `generation_logs` for status and cost monitoring. Full mission inputs and full AI outputs should not be stored unless the privacy policy and retention model are updated.

## Monetization plan

- Free download.
- 5 free generated signals.
- Monthly Pro subscription.
- Yearly Pro subscription.
- Lifetime unlock.

StoreKit or RevenueCat should be added before production release.

## iOS build

```bash
npx eas build --profile production --platform ios
npx eas submit --platform ios --profile production
```
