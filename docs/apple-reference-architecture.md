# Apple Reference Architecture

Reality Hack should stay aligned with Apple guidance for iOS app structure, in-app purchases, privacy, safety, and App Store review.

## Product Flow

Primary app areas:

1. Signal
2. Mission
3. Archive
4. Control

Rationale:

- A small tab-style primary navigation keeps the core destinations visible.
- Signal is the main entry point for AI-generated events.
- Mission presents the current safe real-world task.
- Archive stores local mission history.
- Control exposes Pro state and commercial functionality for App Review.
- Control also shows which low-risk system signals are visible to the game.

## In-App Purchase

Paid access to unlimited AI missions and premium story lines is a digital feature. Before App Store submission:

- Create products in App Store Connect.
- Use StoreKit or RevenueCat to fetch localized product information.
- Unlock Pro from verified entitlement state, not a local flag.
- Include Restore Purchases.
- Test purchases in sandbox/TestFlight.

Product IDs:

- `realityhack_pro_monthly`
- `realityhack_pro_yearly`
- `realityhack_lifetime`

## Safety

Apple review may be sensitive to real-world tasks. The app should enforce:

- No trespassing or private areas
- No following strangers
- No unsafe nighttime travel
- No self-harm, violence, illegal acts, harassment, humiliation, or dangerous dares
- No required photo upload for MVP
- Every mission can be skipped
- Location, notification, camera, photos, microphone, media library, and motion permissions are optional and user-initiated
- No contacts, calendar, health, SMS, phone call, or private message access

## Privacy

Player inputs may contain personal context. Before submission:

- Host a public privacy policy URL.
- Complete App Store Connect App Privacy details.
- Disclose that player context is sent to Supabase and OpenAI for generation.
- Avoid storing full user input server-side unless retention is explicitly added and disclosed.
- Add an in-app local history deletion action before production.

## Review Notes

App Review should be told:

- Reality Hack is an entertainment ARG that generates short, safe micro missions.
- It can optionally request location, notification, camera, photos, microphone, media library, and motion permissions for immersive missions.
- It uses low-risk system context such as time, locale, appearance, battery, network type, and device model even before optional permissions are enabled.
- It does not provide medical, legal, financial, or mental health advice.
- OpenAI API keys are stored server-side only through Supabase secrets.
- IAP products unlock generation limits once StoreKit integration is complete.

## Source References

- App Store Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- In-App Purchase: https://developer.apple.com/in-app-purchase/
- Human Interface Guidelines, Tab bars: https://developer.apple.com/design/human-interface-guidelines/tab-bars
- App privacy details: https://developer.apple.com/help/app-store-connect/manage-app-privacy/app-privacy-details
