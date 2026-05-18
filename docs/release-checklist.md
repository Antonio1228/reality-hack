# Release Checklist

## App Store Connect

- Create app with bundle ID `com.antonio911228.realityhack`
- Accept Paid Apps Agreement
- Add support URL
- Add privacy policy URL
- Fill App Privacy questionnaire
- Create screenshots for 6.7-inch iPhone
- Decide first release pricing model

## Supabase

- Deploy `generate-reality-mission`
- Set `OPENAI_API_KEY`
- Set `OPENAI_MODEL`
- Verify function JWT is enabled
- Test with real anon key

## OpenAI

- Use a production API key
- Set usage limits
- Monitor cost during TestFlight
- Keep the OpenAI key server-side only

## iOS QA

- Test mock AI mode
- Test real AI mode
- Test empty input validation
- Test copy result
- Test history persistence after app restart
- Test free generation limit
- Test Pro entitlement after IAP integration

## Monetization

- Create `realityhack_pro_monthly`
- Create `realityhack_pro_yearly`
- Optional: create `realityhack_lifetime`
- Add IAP integration before submitting a free app with locked digital features

## Apple Reference

- Keep top-level app flow aligned with `docs/apple-reference-architecture.md`
- Add restore purchases before paid release
- Add local history deletion before production privacy submission
- Add App Review notes explaining AI limitations and server-side key handling
