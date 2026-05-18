# Reality Hack Privacy Policy Draft

Last updated: 2026-04-13

Reality Hack is an AI-driven alternate reality game that generates short, safe real-world missions.

## Data Strategy

Reality Hack uses a local-first data model.

- Mission history is stored on the device by default.
- Mission notes are stored on the device by default.
- Evidence photos are stored on the device by default.
- Cloud sync is off by default and should require an explicit user action.
- Evidence photos should only be uploaded for users who enable cloud sync or Pro backup.
- Exact location history, raw microphone recordings, contacts, calendar data, health data, SMS, and phone call data should not be stored.

## Data Processed for AI Generation

The app may send a short mission-generation summary to a Supabase Edge Function, which calls the OpenAI API. This summary may include:

- Player alias
- Broad location hint
- Mission time preference
- Story mood and safety level
- Previous mission title
- Last mission feedback
- Low-risk system context such as hour, weekday, color scheme, battery level, network type, locale, and permission state

The app should not send raw photos, full photo libraries, raw microphone recordings, contacts, private documents, or precise location history to the AI service.

OpenAI states that API Platform inputs and outputs are not used to train models by default. See OpenAI Enterprise Privacy: https://openai.com/enterprise-privacy/

## Local Mission Records

Users can save a short note and optional local evidence photos for a mission. These records are intended to make the in-app archive useful.

Photos should be limited to safe objects or environments and should not include:

- People who have not consented
- Private addresses
- Screens with private information
- Documents
- Government IDs
- Passwords
- Financial or medical information

## Cloud Sync

If cloud sync is added, Supabase should store:

- User profile settings
- Mission JSON
- Mission feedback
- Mission note records
- Private Storage paths for evidence photos
- Push notification installation tokens
- App Store entitlement records

Evidence photos must use a private Supabase Storage bucket and signed URLs. Supabase documents Storage access control through Postgres policies on `storage.objects`: https://supabase.com/docs/guides/storage/security/access-control

Supabase RLS must be enabled for all user-owned tables. Policies should restrict each user to rows where `auth.uid() = user_id` or `auth.uid() = id`. Supabase RLS documentation: https://supabase.com/docs/guides/database/postgres/row-level-security

## Backend Logging

Generation logs should be summary-only and should avoid storing full user notes, full mission text, raw photos, or exact location history.

Recommended retention:

- Successful generation logs: 90 days
- Error logs: 30 to 90 days
- User-requested deletion: delete associated user logs where possible

## User Controls

The app should provide:

- Delete local mission archive
- Delete local evidence photos
- Delete cloud data, when signed in
- Disable cloud sync
- Revoke permissions through iOS Settings

## App Store Privacy Notes

Apple requires developers to understand and disclose the data collected by the app and third-party partners in App Store Connect. Apple App Privacy Details: https://developer.apple.com/app-store/app-privacy-details/

If Reality Hack keeps photos and notes only on device, those records should not be treated as collected by the developer. If cloud sync uploads them to Supabase, they become collected user content and must be disclosed.

Likely App Privacy categories when cloud sync is enabled:

- User Content: mission notes and evidence photos
- Identifiers: Supabase Auth user ID and push tokens
- Location: only if location is uploaded or linked to cloud mission records
- Diagnostics: generation error metadata, if collected

## Safety

Reality Hack should never require dangerous, illegal, humiliating, or privacy-invasive actions. Any mission can be skipped.

## Third-Party Services

- Supabase, for Edge Functions, optional cloud sync, private Storage, and generation logs
- OpenAI, for AI text generation
- Apple, for App Store distribution, in-app purchases, and platform permissions

## Contact

Contact: TODO
