import { Directory, File, Paths } from "expo-file-system";

const evidenceRoot = new Directory(Paths.document, "reality-hack-evidence");

export function persistEvidencePhoto(sourceUri: string, missionId: string) {
  evidenceRoot.create({ idempotent: true, intermediates: true });

  const missionDirectory = new Directory(evidenceRoot, missionId);
  missionDirectory.create({ idempotent: true, intermediates: true });

  const extension = extensionFromUri(sourceUri);
  const suffix = Math.random().toString(36).slice(2, 8);
  const destination = new File(missionDirectory, `${Date.now()}-${suffix}.${extension}`);
  new File(sourceUri).copy(destination);

  return destination.uri;
}

export function deleteEvidencePhoto(uri: string) {
  const file = new File(uri);
  if (file.exists) {
    file.delete();
  }
}

export function deleteAllEvidence() {
  if (evidenceRoot.exists) {
    evidenceRoot.delete();
  }
}

function extensionFromUri(uri: string) {
  const cleanUri = uri.split("?")[0];
  const match = cleanUri.match(/\.([a-zA-Z0-9]+)$/);
  return match?.[1]?.toLowerCase() ?? "jpg";
}
