import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./config";

export async function uploadPlayerImage(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop();
  const storageRef = ref(storage, `players/${userId}/profile.${ext}`);
  const snapshot = await uploadBytes(storageRef, file);
  return getDownloadURL(snapshot.ref);
}

export async function uploadTeamLogo(teamId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop();
  const storageRef = ref(storage, `teams/${teamId}/logo.${ext}`);
  const snapshot = await uploadBytes(storageRef, file);
  return getDownloadURL(snapshot.ref);
}
