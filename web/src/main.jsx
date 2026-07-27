import React from "react";
import ReactDOM from "react-dom/client";
import WeddingList from "./wedding-list.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(<WeddingList />);

// PWA: 서비스워커 등록 (홈화면 설치 · 오프라인 앱 셸)
// 새 배포가 감지되면 자동으로 최신 버전으로 새로고침한다(오프라인 설치본의 업데이트 지연 방지).
if ("serviceWorker" in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + "sw.js").then((reg) => {
      // 이미 대기 중인 새 워커가 있으면 즉시 활성화
      if (reg.waiting) reg.waiting.postMessage("skipWaiting");
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            nw.postMessage("skipWaiting"); // 새 버전 준비됨 → 활성화 → controllerchange → reload
          }
        });
      });
      // 주기적으로 업데이트 확인 (앱이 오래 켜져 있어도 새 배포를 잡도록)
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    }).catch(() => {});
  });
}
