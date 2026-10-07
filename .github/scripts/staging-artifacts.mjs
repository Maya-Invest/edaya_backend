import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.env.RELEASE_ROOT || "..");
const mobile = resolve(root, "edaya_mobile");
const mode = process.argv[2];
if (mode === "signing") {
  let bundle;
  try { bundle = JSON.parse(process.env.ANDROID_SIGNING_BUNDLE || "null"); }
  catch { throw new Error("Invalid Android signing bundle JSON; credential contents are omitted"); }
  if (!bundle?.keystore || !bundle.apps?.guardian || !bundle.apps?.teacher) throw new Error("Missing existing Android signing bundle");
  const signingDir = resolve(mobile, "android-signing");
  mkdirSync(signingDir, { recursive: true, mode: 0o700 });
  writeFileSync(resolve(signingDir, "edaya-upload.jks"), Buffer.from(bundle.keystore, "base64"), { mode: 0o600 });
  for (const app of ["guardian", "teacher"]) {
    const data = bundle.apps[app];
    for (const key of ["keyAlias", "keyPassword", "storePassword"]) {
      if (typeof data[key] !== "string" || !data[key] || /[\r\n\\]/.test(data[key])) throw new Error("Invalid signing configuration");
    }
    const expectedId = app === "guardian" ? "ca.mayainvest.edaya.guardian" : "ca.mayainvest.edaya.staff";
    if (!data.firebase?.client?.some(client => client.client_info?.android_client_info?.package_name === expectedId)) throw new Error("Firebase application ID does not match the existing Android app");
    const android = resolve(mobile, `apps/${app}/android`);
    writeFileSync(resolve(android, "key.properties"), `storeFile=../../../android-signing/edaya-upload.jks\nkeyAlias=${data.keyAlias}\nkeyPassword=${data.keyPassword}\nstorePassword=${data.storePassword}\n`, { mode: 0o600 });
    writeFileSync(resolve(android, "app/google-services.json"), JSON.stringify(data.firebase), { mode: 0o600 });
  }
  console.log("Restored existing Android signing and Firebase configurations");
} else if (mode === "cleanup") {
  for (const app of ["guardian", "teacher"]) {
    rmSync(resolve(mobile, `apps/${app}/android/key.properties`), { force: true });
    rmSync(resolve(mobile, `apps/${app}/android/app/google-services.json`), { force: true });
  }
  rmSync(resolve(mobile, "android-signing/edaya-upload.jks"), { force: true });
  rmSync(resolve(root, ".release-private"), { recursive: true, force: true });
} else {
  throw new Error("Expected signing or cleanup");
}
