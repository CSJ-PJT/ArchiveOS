import { useEffect, useState } from "react";
import { AppShell } from "./app/AppShell";

export default function App() {
  const [releaseMismatch, setReleaseMismatch] = useState<{ installed: string; current: string } | null>(null);

  useEffect(() => {
    if (!isInstalledApp()) return;
    const current = currentRelease();
    const installed = window.localStorage.getItem("archiveos.app.release");
    if (!installed) {
      if (new URLSearchParams(window.location.search).get("pwa-install") === "1") {
        window.localStorage.setItem("archiveos.app.release", current);
      } else {
        setReleaseMismatch({ installed: "legacy", current });
      }
      return;
    }
    if (installed !== current) setReleaseMismatch({ installed, current });
  }, []);

  if (releaseMismatch) {
    return <main className="app-release-gate">
      <section>
        <span>ARCHIVEOS APP UPDATE</span>
        <h1>운영 배포 버전이 변경되었습니다</h1>
        <p>로그인과 패스키를 최신 운영 계약에 맞추기 위해 설치 앱을 업데이트해야 합니다.</p>
        <button type="button" onClick={() => void prepareAppUpdate(releaseMismatch.current)}>앱 다시 설치 준비</button>
        <small>적용 후 앱이 다시 열립니다. 아이콘이 갱신되지 않으면 기존 앱을 제거한 뒤 Chrome에서 다시 설치하세요.</small>
      </section>
    </main>;
  }
  return <AppShell />;
}

function currentRelease() {
  return `${__ARCHIVEOS_FRONTEND_VERSION__ || "0"}:${__ARCHIVEOS_COMMIT_SHA__ || __ARCHIVEOS_BUILD_TIME__}`;
}

function isInstalledApp() {
  const standaloneNavigator = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || standaloneNavigator.standalone === true;
}

async function prepareAppUpdate(release: string) {
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("archiveos-")).map((key) => caches.delete(key)));
  }
  window.localStorage.setItem("archiveos.app.release", release);
  window.sessionStorage.removeItem("archiveos.sw.reloaded");
  window.location.replace(`${import.meta.env.BASE_URL}?pwa-install=1&app-update=${encodeURIComponent(release)}#/settings`);
}
