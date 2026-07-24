import React from "react";
import ReactDOM from "react-dom/client";
import WeddingList from "./wedding-list.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(<WeddingList />);

// PWA: 서비스워커 등록 (홈화면 설치 · 오프라인 앱 셸)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + "sw.js").catch(() => {});
  });
}
