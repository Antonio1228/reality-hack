# Reality Hack Production Data Plan

## Recommended Model

Reality Hack should ship as local-first.

Default behavior:

- Store mission archive locally.
- Store notes locally.
- Store evidence photos locally.
- Send only short text summaries to the AI generation function.
- Do not upload evidence photos unless the user enables cloud sync.

Paid or signed-in behavior:

- Sync missions, notes, and selected photos to Supabase.
- Use private Supabase Storage for evidence photos.
- Use signed URLs for temporary access.
- Keep RLS enabled on every user-owned table.

## Supabase Migration

Use:

```text
supabase/migrations/202604130001_reality_hack_production_data.sql
```

This migration creates:

- `profiles`
- `missions`
- `mission_records`
- `evidence_files`
- `device_installations`
- `entitlements`
- private Storage bucket `mission-evidence`
- user-owned RLS policies
- `delete_my_reality_hack_data()`

## What Not To Store

Do not store:

- continuous precise location history
- contacts
- calendars
- health data
- raw microphone recordings
- full photo library inventory
- passwords
- government IDs
- private addresses
- financial or medical data

## Evidence Photo Rules

Allowed:

- safe objects
- safe public or personal environment details
- abstract visual clues

Not allowed:

- people without consent
- IDs or documents
- screens
- addresses
- license plates when avoidable
- anything embarrassing, illegal, or private

## Retention

Suggested defaults:

- Local records: until user deletes them.
- Cloud mission records: until user deletes account or archive.
- Evidence photos: until user deletes them.
- Generation logs: 90 days.
- Error logs: 30 to 90 days.

## Deletion

The app should support:

- deleting one evidence photo
- deleting all local data
- deleting all cloud data through `delete_my_reality_hack_data()`

## Sources

- Apple App Privacy Details: https://developer.apple.com/app-store/app-privacy-details/
- Apple User Privacy and Data Use: https://developer.apple.com/app-store/user-privacy-and-data-use/
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Storage Access Control: https://supabase.com/docs/guides/storage/security/access-control
- Supabase signed URLs: https://supabase.com/docs/reference/javascript/storage-from-createsignedurl
- OpenAI Enterprise Privacy: https://openai.com/enterprise-privacy/
