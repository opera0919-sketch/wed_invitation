/* =============================================================================
 *  청첩장 명단 — 2인 공동 관리 웹앱
 *  - 원본 단일 HTML 앱을 React + Supabase 로 이식 (yoriwaegil 구조 참고).
 *  - 데이터는 Supabase("private-job" 프로젝트, wed_ 접두사 테이블)에 저장되고
 *    두 관리자의 기기 사이에서 실시간 동기화된다.
 *  - 접근은 허용 목록(wed_managers)에 있는 관리자만 (사적 정보 보호).
 *  - 로컬 캐시로 오프라인에서도 마지막 데이터를 보여준다.
 * ========================================================================== */
import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Check, Plus, X, Users, Calendar, Wallet, Settings as Gear, Search,
  Trash2, Download, ChevronRight, Copy, Link as LinkIcon, LogOut,
  Pencil, UserPlus, Mail, RefreshCw, ShieldCheck,
} from "lucide-react";

/* ================= Supabase ================= */
const SUPABASE_URL = "https://kialuqypzhtiazpfamvs.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpYWx1cXlwemh0aWF6cGZhbXZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNDkxMTAsImV4cCI6MjA5NjgyNTExMH0.ZZGFoA3AuJ9stLBccFAHIfmJdUL4_MR13lLDhJuC5xo";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ================= 상수 ================= */
const SIDES = ["신부", "신랑", "공동"];
const METHODS = ["대면", "모바일"];
const ATTEND = ["미정", "참석", "불참"];
const DELIVERER = ["신부", "신랑", "함께"];
const PRESETS = [["점심", "식대"], ["저녁(1차)", "식대"], ["저녁(2차)", "식대"], ["기타", "기타"]];
const EMOJIS = ["💍", "🤵", "👰", "💐", "🥂", "💌", "🌸", "🕊️", "✨", "💗", "🎀", "🌷", "🍰", "🎉", "🌿", "🪷"];
const USER_COLORS = ["#9B4F63", "#3D5A80", "#B08B3F", "#6F7A52", "#8A6D8B", "#4A6C7A", "#A4543F", "#5B7161"];
const DEFAULT_SETTINGS = {
  weddingDate: "", budgetB: "", budgetG: "", paperTotal: "",
  link: "https://salondeletter.com/w/w0kzkei6m8",
  msg: "(멘트는 나중에 채워 넣으세요)", skips: [],
};
const CACHE_KEY = "wed_invite_cache_v1";

/* ================= 도구 ================= */
function col(s) { return s === "신부" ? "var(--bride)" : s === "신랑" ? "var(--groom)" : "var(--both)"; }
function uid() { return (crypto?.randomUUID ? crypto.randomUUID() : "x" + Math.random().toString(36).slice(2) + Date.now().toString(36)); }
function won(n) { return (Number(n) || 0).toLocaleString("ko-KR"); }
function today() { return new Date().toISOString().slice(0, 10); }
function hashStr(s) { let h = 0; for (let i = 0; i < (s || "").length; i++) h = (h << 5) - h + s.charCodeAt(i) | 0; return h; }
function loadCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch { return null; } }
function saveCache(o) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(o)); } catch {} }

/* row <-> object 매핑 */
const guestToRow = (g) => ({
  id: g.id, name: g.name, side: g.side, relation: g.relation || "",
  delivered: !!g.delivered, method: g.method || "대면", deliverer: g.deliverer || "함께",
  attending: g.attending || "미정", memo: g.memo || "", delivered_at: g.deliveredAt || "",
  created_by: g.createdBy || "", updated_by: g.updatedBy || "",
});
const guestFromRow = (r) => ({
  id: r.id, name: r.name, side: r.side, relation: r.relation || "",
  delivered: !!r.delivered, method: r.method || "대면", deliverer: r.deliverer || "함께",
  attending: r.attending || "미정", memo: r.memo || "", deliveredAt: r.delivered_at || "",
  createdBy: r.created_by || "", updatedBy: r.updated_by || "",
});
const meetingToRow = (m) => ({
  id: m.id, date: m.date || "", place: m.place || "", type: m.type || "공동",
  status: m.status || "", attendee_ids: m.attendeeIds || [], expenses: m.expenses || [],
  created_by: m.createdBy || "", updated_by: m.updatedBy || "",
});
const meetingFromRow = (r) => ({
  id: r.id, date: r.date || "", place: r.place || "", type: r.type || "공동",
  status: r.status || "", attendeeIds: r.attendee_ids || [], expenses: r.expenses || [],
  createdBy: r.created_by || "", updatedBy: r.updated_by || "",
});
const settingsToRow = (s) => ({
  id: 1, wedding_date: s.weddingDate || "", budget_b: s.budgetB || "", budget_g: s.budgetG || "",
  paper_total: s.paperTotal || "", link: s.link || "", msg: s.msg || "", skips: s.skips || [],
  updated_at: new Date().toISOString(),
});
const settingsFromRow = (r) => ({
  weddingDate: r.wedding_date || "", budgetB: r.budget_b || "", budgetG: r.budget_g || "",
  paperTotal: r.paper_total || "", link: r.link || DEFAULT_SETTINGS.link,
  msg: r.msg || "", skips: r.skips || [],
});

/* ================= 스타일 ================= */
const CSS = `
:root{
  --paper:#F7F4EE; --card:#FFF; --ink:#22201E; --mute:#8A8078;
  --line:#E5DED3; --bride:#9B4F63; --groom:#3D5A80; --both:#B08B3F;
  --safe-b:env(safe-area-inset-bottom,0px);
}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
.wl{background:var(--paper);color:var(--ink);min-height:100vh;
  font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;
  font-size:16px;line-height:1.5;-webkit-text-size-adjust:100%}
.wl .serif{font-family:"Nanum Myeongjo",Georgia,serif}
.wl button,.wl input,.wl select,.wl textarea{font-family:inherit;font-size:16px}
.wl button{border:0;background:none;color:inherit;cursor:pointer}
.wl input,.wl select,.wl textarea{
  width:100%;padding:13px 14px;border:1px solid var(--line);border-radius:12px;
  background:var(--paper);color:var(--ink);outline:none;appearance:none}
.wl input:focus,.wl select:focus,.wl textarea:focus{border-color:var(--ink)}
.wl .hide{display:none!important}
.wl header{padding:22px 20px 12px}
.wl .hrow{display:flex;align-items:flex-end;justify-content:space-between;gap:12px}
.wl h1{margin:0;font-size:22px;font-weight:400;letter-spacing:-.01em}
.wl .dday{font-size:15px;color:var(--bride);white-space:nowrap}
.wl .sub{margin:8px 0 0;font-size:14px;color:var(--mute)}
.wl .copyrow{display:flex;gap:8px;margin-top:12px}
.wl .copyrow button{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:11px 0;border:1px solid var(--line);border-radius:12px;background:var(--card);font-size:13.5px;color:var(--ink)}
.wl .copyrow button:active{background:var(--paper)}
.wl main{padding:0 20px calc(120px + var(--safe-b))}
.wl .card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:20px;margin-bottom:16px}
.wl .bar{height:8px;border-radius:99px;background:var(--line);overflow:hidden;margin:12px 0}
.wl .bar>i{display:block;height:100%;border-radius:99px;background:var(--bride);transition:width .4s}
.wl .big{font-size:26px}
.wl .small{font-size:15px;color:var(--mute)}
.wl .chips{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;margin-bottom:14px;scrollbar-width:none}
.wl .chips::-webkit-scrollbar{display:none}
.wl .chip{flex:0 0 auto;padding:9px 15px;border-radius:99px;border:1px solid var(--line);color:var(--mute);font-size:14px;white-space:nowrap}
.wl .chip.on{background:var(--ink);border-color:var(--ink);color:#fff}
.wl .search{position:relative;margin-bottom:12px}
.wl .search input{padding-left:42px}
.wl .search .si{position:absolute;left:14px;top:13px;color:var(--mute)}
.wl .row{display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px;margin-bottom:8px}
.wl .tick{flex:0 0 auto;width:42px;height:42px;border-radius:99px;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;transition:.15s}
.wl .tick.on{border-color:transparent}
.wl .rowbody{flex:1;min-width:0;text-align:left}
.wl .rowtop{display:flex;align-items:center;gap:7px}
.wl .nm{font-size:17px}
.wl .tag{font-size:11px;padding:2px 8px;border-radius:99px}
.wl .rowsub{font-size:13.5px;color:var(--mute);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wl nav{position:fixed;left:0;right:0;bottom:0;display:flex;background:var(--card);border-top:1px solid var(--line);padding-bottom:var(--safe-b);z-index:20}
.wl nav button{flex:1;padding:9px 0 7px;display:flex;flex-direction:column;align-items:center;gap:3px;color:var(--mute);font-size:11px}
.wl nav button.on{color:var(--ink)}
.wl .fab{position:fixed;right:20px;bottom:calc(84px + var(--safe-b));width:56px;height:56px;border-radius:99px;background:var(--ink);display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(34,32,30,.28);z-index:21;color:#fff}
.wl .veil{position:fixed;inset:0;background:rgba(34,32,30,.45);z-index:40;display:flex;align-items:flex-end}
.wl .sheet{width:100%;background:var(--card);border-radius:24px 24px 0 0;max-height:92vh;display:flex;flex-direction:column;animation:wlup .22s ease-out}
@keyframes wlup{from{transform:translateY(14px);opacity:.6}to{transform:none;opacity:1}}
.wl .shead{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--line);flex:0 0 auto}
.wl .shead h2{margin:0;font-size:18px;font-weight:400}
.wl .sbody{padding:18px 20px calc(20px + var(--safe-b));overflow-y:auto;-webkit-overflow-scrolling:touch}
.wl label.f{display:block;margin-bottom:16px}
.wl label.f>span{display:block;margin-bottom:7px;font-size:13.5px;color:var(--mute)}
.wl .seg{display:flex;gap:8px}
.wl .seg button{flex:1;padding:13px 0;border:1px solid var(--line);border-radius:12px;color:var(--mute);font-size:14px;transition:.12s}
.wl .seg button.on{color:#fff}
.wl .btn{width:100%;padding:16px;border-radius:16px;background:var(--ink);color:#fff;font-size:16px;margin-top:4px;display:flex;align-items:center;justify-content:center;gap:8px}
.wl .btn.ghost{background:none;border:1px solid var(--line);color:var(--ink)}
.wl .btn.warn{background:none;color:var(--bride);font-size:14px;padding:14px}
.wl .btn:disabled{opacity:.45}
.wl .more{width:100%;padding:13px;border:1px dashed var(--line);border-radius:12px;color:var(--mute);font-size:14px;margin-bottom:16px}
.wl .modal{position:fixed;inset:0;background:rgba(34,32,30,.55);z-index:60;display:flex;align-items:center;justify-content:center;padding:28px}
.wl .box{background:var(--card);border-radius:22px;padding:24px;max-width:360px;width:100%}
.wl .box h3{margin:0 0 10px;font-size:19px;font-weight:400}
.wl .box p{margin:0 0 20px;font-size:14px;color:var(--mute);line-height:1.6}
.wl .toast{position:fixed;left:0;right:0;bottom:calc(96px + var(--safe-b));display:flex;justify-content:center;z-index:70;pointer-events:none}
.wl .toast>span{background:var(--ink);color:#fff;padding:11px 20px;border-radius:99px;font-size:14px}
.wl .empty{text-align:center;padding:60px 20px;font-size:14px;color:var(--mute);line-height:1.7}
.wl .exp{display:flex;align-items:center;justify-content:space-between;padding:13px 15px;border-radius:12px;background:var(--paper);margin-bottom:8px}
.wl .money{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:11px;font-size:14px}
.wl .mini{background:var(--paper);border-radius:12px;padding:14px}
.wl .mini b{display:block;font-size:12px;color:var(--mute);font-weight:400;margin-bottom:4px}
.wl .att{display:flex;gap:8px;margin-top:14px;padding-top:14px;border-top:1px solid var(--line)}
.wl .att>div{flex:1;text-align:center}
.wl .att .n{font-size:19px}
.wl .att .l{font-size:12px;color:var(--mute)}
.wl .center{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:28px}
.wl .authcard{width:100%;max-width:380px}
.wl .authcard .logo{text-align:center;font-size:40px;margin-bottom:10px}
.wl .authcard h2{margin:0 0 6px;font-weight:400;font-size:22px;text-align:center}
.wl .authcard p.lead{margin:0 0 22px;text-align:center;color:var(--mute);font-size:14px;line-height:1.6}
.wl .autherr{color:var(--bride);font-size:13px;margin:2px 0 12px;line-height:1.5}
.wl .avatar{border-radius:99px;background:var(--paper);display:flex;align-items:center;justify-content:center;flex:0 0 auto}
.wl .mgr{display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid var(--line)}
.wl .mgr:last-child{border-bottom:0}
.wl .link-btn{color:var(--mute);font-size:13px;text-decoration:underline;background:none;width:auto;padding:6px}
.wl .emoji-grid{display:grid;grid-template-columns:repeat(8,1fr);gap:6px;margin-top:8px}
.wl .emoji-btn{width:100%;aspect-ratio:1;border:1px solid var(--line);border-radius:10px;font-size:19px;display:flex;align-items:center;justify-content:center}
.wl .emoji-btn.on{border-color:var(--ink);background:var(--paper)}
@media(prefers-reduced-motion:reduce){.wl *{animation:none!important;transition:none!important}}
`;

/* ================= 아바타 ================= */
function Avatar({ user, size = 28 }) {
  const emoji = user?.emoji || "💍";
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.55, boxShadow: user?.color ? `inset 0 0 0 2px ${user.color}` : "none" }}>
      {emoji}
    </div>
  );
}

/* ================= 분절 버튼 ================= */
function Seg({ opts, cur, onPick, colored }) {
  return (
    <div className="seg">
      {opts.map((o) => {
        const on = cur === o, bg = colored ? col(o) : "var(--ink)";
        return (
          <button key={o} className={on ? "on" : ""}
            style={on ? { background: bg, borderColor: bg } : undefined}
            onClick={() => onPick(o)}>{o}</button>
        );
      })}
    </div>
  );
}

/* =============================================================================
 *  로그인 화면
 * ========================================================================== */
function AuthGate({ onToast }) {
  const [mode, setMode] = useState("in"); // in | up
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    const em = email.trim().toLowerCase();
    if (!em || !pw) { setErr("이메일과 비밀번호를 넣어 주세요."); return; }
    if (mode === "up" && pw.length < 6) { setErr("비밀번호는 6자 이상으로 정해 주세요."); return; }
    setBusy(true);
    try {
      if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({ email: em, password: pw });
        if (error) throw error;
        if (!data.session) {
          onToast("가입되었습니다. 이제 로그인해 주세요");
          setMode("in");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: em, password: pw });
        if (error) throw error;
      }
    } catch (e) {
      const m = String(e?.message || e);
      if (/Invalid login/i.test(m)) setErr("이메일 또는 비밀번호가 맞지 않습니다.");
      else if (/already registered/i.test(m)) { setErr("이미 가입된 이메일입니다. 로그인해 주세요."); setMode("in"); }
      else if (/Email not confirmed/i.test(m)) setErr("이메일 인증이 필요합니다. 관리자에게 문의해 주세요.");
      else setErr(m);
    } finally { setBusy(false); }
  };

  return (
    <div className="center">
      <div className="authcard">
        <div className="logo">💌</div>
        <h2 className="serif">청첩장 명단</h2>
        <p className="lead">두 사람이 함께 관리하는 하객 명단입니다.<br />허락된 분만 들어올 수 있어요.</p>
        <label className="f"><span>이메일</span>
          <input type="email" inputMode="email" autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>
        <label className="f"><span>비밀번호</span>
          <input type="password" autoComplete={mode === "up" ? "new-password" : "current-password"} value={pw}
            onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="6자 이상" /></label>
        {err && <div className="autherr">{err}</div>}
        <button className="btn" disabled={busy} onClick={submit}>
          {busy ? "잠시만요…" : mode === "up" ? "가입하기" : "로그인"}
        </button>
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <button className="link-btn" onClick={() => { setErr(""); setMode(mode === "in" ? "up" : "in"); }}>
            {mode === "in" ? "처음이신가요? 가입하기" : "이미 계정이 있어요 · 로그인"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =============================================================================
 *  접근 권한 없음 화면
 * ========================================================================== */
function NoAccess({ email, onSignOut }) {
  return (
    <div className="center">
      <div className="authcard" style={{ textAlign: "center" }}>
        <div className="logo">🔒</div>
        <h2 className="serif">아직 초대되지 않았어요</h2>
        <p className="lead">
          <b style={{ color: "var(--ink)" }}>{email}</b> 계정은 아직 이 명단의 공동 관리자가 아닙니다.<br />
          이미 등록된 관리자에게 이 이메일을 <b>공동 관리자로 추가</b>해 달라고 요청해 주세요.
        </p>
        <button className="btn ghost" onClick={onSignOut}><LogOut size={15} /> 다른 계정으로 로그인</button>
      </div>
    </div>
  );
}

/* =============================================================================
 *  메인
 * ========================================================================== */
export default function WeddingList() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [access, setAccess] = useState("unknown"); // unknown | yes | no
  const [managers, setManagers] = useState([]);
  const [users, setUsers] = useState([]);
  const [guests, setGuests] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  const [tab, setTab] = useState("guests");
  const [q, setQ] = useState("");
  const [filt, setFilt] = useState("전체");
  const [undel, setUndel] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  // 시트/모달 상태 (드래프트는 부모가 보유 — 겹지인 모달 흐름 때문)
  const [gDraft, setGDraft] = useState(null);
  const [gMore, setGMore] = useState(false);
  const [mDraft, setMDraft] = useState(null);
  const [exDraft, setExDraft] = useState({ label: "", amount: "", payer: "신부", category: "식대" });
  const [overlap, setOverlap] = useState(null); // {existing, again}
  const [wipeAsk, setWipeAsk] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [needProfile, setNeedProfile] = useState(false);

  const email = session?.user?.email || "";
  const uidMe = session?.user?.id || null;
  const me = users.find((u) => u.id === uidMe) || { id: uidMe, name: email.split("@")[0] || "나", emoji: "💍" };

  const toastTimer = React.useRef();
  const toast = (m) => { setToastMsg(m); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToastMsg(""), 1900); };

  /* ── 세션 ── */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  /* ── 로그인 후: 권한 확인 + 데이터 로드 ── */
  useEffect(() => {
    if (!session?.user) { setAccess("unknown"); setLoaded(false); return; }
    let cancelled = false;
    (async () => {
      // 관리자 목록 (RLS: 관리자만 행을 볼 수 있음 → 비어 있으면 권한 없음)
      const { data: mgrs, error: mErr } = await supabase.from("wed_managers").select("*");
      if (cancelled) return;
      const amManager = !mErr && (mgrs || []).some((m) => (m.email || "").toLowerCase() === email.toLowerCase());
      if (!amManager) { setAccess("no"); return; }
      setAccess("yes");
      setManagers(mgrs || []);

      // 내 프로필 보장
      await ensureProfile(session.user);

      // 데이터 로드 (실패 시 캐시 복원)
      try {
        const [u, g, mt, st] = await Promise.all([
          supabase.from("wed_users").select("*"),
          supabase.from("wed_guests").select("*"),
          supabase.from("wed_meetings").select("*"),
          supabase.from("wed_settings").select("*").eq("id", 1).maybeSingle(),
        ]);
        if (cancelled) return;
        if (u.error || g.error || mt.error) throw new Error((u.error || g.error || mt.error).message);
        const gs = (g.data || []).map(guestFromRow);
        const ms = (mt.data || []).map(meetingFromRow);
        const ss = st.data ? settingsFromRow(st.data) : DEFAULT_SETTINGS;
        setUsers(u.data || []);
        setGuests(gs); setMeetings(ms); setSettings(ss);
        saveCache({ guests: gs, meetings: ms, settings: ss, users: u.data || [] });
      } catch (e) {
        if (cancelled) return;
        const c = loadCache();
        if (c) { setGuests(c.guests || []); setMeetings(c.meetings || []); setSettings(c.settings || DEFAULT_SETTINGS); setUsers(c.users || []); toast("오프라인 — 마지막 데이터를 보여드려요"); }
        else toast("데이터를 불러오지 못했어요");
      } finally { if (!cancelled) setLoaded(true); }
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  async function ensureProfile(u) {
    const { data } = await supabase.from("wed_users").select("*").eq("id", u.id);
    let row = data && data[0];
    if (!row) {
      row = {
        id: u.id, email: u.email || "",
        name: (u.email || "").split("@")[0] || "나", emoji: "💍",
        color: USER_COLORS[Math.abs(hashStr(u.id)) % USER_COLORS.length], profile_set: false,
      };
      await supabase.from("wed_users").insert(row);
    }
    setUsers((list) => list.some((x) => x.id === u.id) ? list.map((x) => x.id === u.id ? row : x) : [...list, row]);
    if (!row.profile_set) setNeedProfile(true);
  }

  /* ── 실시간 동기화 ── */
  useEffect(() => {
    if (access !== "yes") return;
    const ch = supabase.channel("wed-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "wed_guests" }, (p) => {
        if (p.eventType === "DELETE") setGuests((r) => r.filter((x) => x.id !== p.old.id));
        else setGuests((r) => { const g = guestFromRow(p.new); return r.some((x) => x.id === g.id) ? r.map((x) => x.id === g.id ? g : x) : [...r, g]; });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "wed_meetings" }, (p) => {
        if (p.eventType === "DELETE") setMeetings((r) => r.filter((x) => x.id !== p.old.id));
        else setMeetings((r) => { const m = meetingFromRow(p.new); return r.some((x) => x.id === m.id) ? r.map((x) => x.id === m.id ? m : x) : [...r, m]; });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "wed_settings" }, (p) => {
        if (p.new) setSettings(settingsFromRow(p.new));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "wed_users" }, (p) => {
        if (p.eventType === "DELETE") setUsers((u) => u.filter((x) => x.id !== p.old.id));
        else setUsers((u) => u.some((x) => x.id === p.new.id) ? u.map((x) => x.id === p.new.id ? p.new : x) : [...u, p.new]);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "wed_managers" }, (p) => {
        if (p.eventType === "DELETE") setManagers((u) => u.filter((x) => x.email !== p.old.email));
        else setManagers((u) => u.some((x) => x.email === p.new.email) ? u : [...u, p.new]);
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [access]);

  /* 캐시 갱신 */
  useEffect(() => { if (loaded && access === "yes") saveCache({ guests, meetings, settings, users }); }, [guests, meetings, settings, users, loaded, access]);

  /* ── 계산 ── */
  const stats = useMemo(() => {
    const pool = filt === "전체" ? guests : guests.filter((g) => g.side === filt);
    const t = pool.length, d = pool.filter((g) => g.delivered).length;
    const att = { 참석: 0, 미정: 0, 불참: 0 };
    pool.forEach((g) => { att[g.attending || "미정"] = (att[g.attending || "미정"] || 0) + 1; });
    return { total: t, done: d, left: t - d, pct: t ? Math.round(d / t * 100) : 0, scope: filt, att, both: guests.filter((g) => g.side === "공동").length };
  }, [guests, filt]);

  const paper = useMemo(() => {
    const tot = Number(settings.paperTotal) || 0;
    const used = guests.filter((g) => g.delivered && g.method === "대면").length;
    return { total: tot, used, left: tot - used };
  }, [guests, settings.paperTotal]);

  const dday = useMemo(() => {
    if (!settings.weddingDate) return null;
    const t = new Date(settings.weddingDate + "T00:00:00"), n = new Date(); n.setHours(0, 0, 0, 0);
    return Math.round((t - n) / 864e5);
  }, [settings.weddingDate]);

  const relations = useMemo(() => {
    const seen = {}, out = [];
    guests.forEach((g) => { if (g.relation && !seen[g.relation]) { seen[g.relation] = 1; out.push(g.relation); } });
    return out.slice(0, 8);
  }, [guests]);

  const mstatus = (m) => m.status ? m.status : !m.date ? "예정" : m.date < today() ? "완료" : m.date > today() ? "예정" : "";
  const sidesIn = (m) => {
    const s = {};
    (m.attendeeIds || []).forEach((id) => { const g = guests.find((x) => x.id === id); if (!g) return; if (g.side === "공동") { s["신부"] = 1; s["신랑"] = 1; } else s[g.side] = 1; });
    const out = Object.keys(s); return out.length ? out : ["신부", "신랑"];
  };
  const skipped = (a, b) => settings.skips.indexOf([a, b].sort().join("|")) >= 0;

  const calc = useMemo(() => {
    let total = 0; const spend = { 신부: 0, 신랑: 0 }, byGuest = { 신부: 0, 신랑: 0, 공동: 0 }, cnt = { 신부: 0, 신랑: 0, 공동: 0 };
    const per = meetings.map((m) => {
      const s = (m.expenses || []).reduce((a, e) => a + (Number(e.amount) || 0), 0); total += s;
      (m.expenses || []).forEach((e) => { spend[e.payer === "신랑" ? "신랑" : "신부"] += Number(e.amount) || 0; });
      const ids = m.attendeeIds || [], n = ids.length;
      if (n) { const grp = { 신부: 0, 신랑: 0, 공동: 0 }; ids.forEach((id) => { const g = guests.find((x) => x.id === id); if (g) grp[g.side]++; }); SIDES.forEach((k) => { byGuest[k] += s * grp[k] / n; cnt[k] += grp[k]; }); }
      return { id: m.id, place: m.place, sum: s, date: m.date };
    }).sort((a, b) => b.sum - a.sum);
    return { total, spend, byGuest, cnt, per };
  }, [meetings, guests]);

  /* ── 데이터 변경 (낙관적 + 서버 반영) ── */
  const persistGuest = async (g) => {
    const { error } = await supabase.from("wed_guests").upsert(guestToRow(g));
    if (error) { toast("저장에 실패했어요"); return false; }
    return true;
  };
  const tick = async (id) => {
    let next;
    setGuests((r) => r.map((x) => { if (x.id !== id) return x; next = x.delivered ? { ...x, delivered: false, deliveredAt: "", updatedBy: uidMe } : { ...x, delivered: true, deliveredAt: x.deliveredAt || today(), updatedBy: uidMe }; return next; }));
    if (next) await persistGuest(next);
  };

  const patchSettings = async (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    const { error } = await supabase.from("wed_settings").upsert(settingsToRow(next));
    if (error) toast("설정 저장에 실패했어요");
  };

  /* ── 관리자 추가/삭제 ── */
  const addManager = async (raw) => {
    const em = (raw || "").trim().toLowerCase();
    if (!em || !/.+@.+\..+/.test(em)) { toast("올바른 이메일을 넣어 주세요"); return; }
    if (managers.some((m) => m.email.toLowerCase() === em)) { toast("이미 등록된 관리자예요"); return; }
    const row = { email: em, added_by: email };
    setManagers((l) => [...l, row]);
    const { error } = await supabase.from("wed_managers").insert(row);
    if (error) { setManagers((l) => l.filter((m) => m.email !== em)); toast("추가에 실패했어요"); return; }
    toast("공동 관리자를 추가했어요");
  };
  const removeManager = async (em) => {
    if (em.toLowerCase() === email.toLowerCase()) { toast("본인은 스스로 뺄 수 없어요"); return; }
    setManagers((l) => l.filter((m) => m.email !== em));
    const { error } = await supabase.from("wed_managers").delete().eq("email", em);
    if (error) toast("삭제에 실패했어요");
  };

  /* ── 프로필 저장 ── */
  const saveProfile = async (patch) => {
    const full = { ...patch, profile_set: true };
    setUsers((l) => l.some((x) => x.id === uidMe) ? l.map((x) => x.id === uidMe ? { ...x, ...full } : x) : [...l, { id: uidMe, ...full }]);
    const { error } = await supabase.from("wed_users").update(full).eq("id", uidMe);
    if (error) { toast("프로필 저장에 실패했어요"); return; }
    setNeedProfile(false); setAccountOpen(false); toast("프로필을 저장했어요");
  };
  const signOut = async () => { await supabase.auth.signOut(); setAccountOpen(false); setGuests([]); setMeetings([]); setUsers([]); setManagers([]); toast("로그아웃했어요"); };

  /* ── 하객 시트 열기 ── */
  const openGuest = (id) => {
    const g = id ? { ...guests.find((x) => x.id === id) }
      : { id: uid(), name: "", side: "신부", relation: "", delivered: false, method: "대면", deliverer: "함께", attending: "미정", memo: "", createdBy: uidMe, updatedBy: uidMe };
    setGDraft(g); setGMore(!!id);
  };
  const openMeeting = (id) => {
    const m = id ? { ...meetings.find((x) => x.id === id) }
      : { id: uid(), date: today(), place: "", type: "공동", status: "", attendeeIds: [], expenses: [], createdBy: uidMe, updatedBy: uidMe };
    setExDraft({ label: "", amount: "", payer: "신부", category: "식대" });
    setMDraft(m);
  };
  const addNew = () => { if (tab === "guests") openGuest(null); else openMeeting(null); };

  /* ── 하객 저장 (겹지인 확인 포함) ── */
  const attemptSaveGuest = (again) => {
    const g = gDraft;
    if (!g.name.trim()) { toast("이름을 넣어 주세요"); return; }
    const clash = guests.find((x) => x.name.trim() === g.name.trim() && x.id !== g.id && x.side !== g.side && !skipped(x.id, g.id));
    if (clash) { setOverlap({ existing: clash, again: !!again }); return; }
    commitGuest(!!again);
  };
  const commitGuest = async (again) => {
    const g = { ...gDraft, updatedBy: uidMe };
    const exists = guests.some((x) => x.id === g.id);
    setGuests((r) => exists ? r.map((x) => x.id === g.id ? g : x) : [...r, g]);
    await persistGuest(g);
    if (again) {
      const nd = { id: uid(), name: "", side: g.side, relation: g.relation, delivered: false, method: "대면", deliverer: "함께", attending: "미정", memo: "", createdBy: uidMe, updatedBy: uidMe };
      setGDraft(nd); setGMore(false); toast("넣었습니다. 다음 분을 이어서 넣으세요");
      setTimeout(() => document.getElementById("gname")?.focus(), 60);
    } else { setGDraft(null); toast(exists ? "수정했습니다" : "명단에 넣었습니다"); }
  };
  const delGuest = async () => {
    const id = gDraft.id; setGuests((r) => r.filter((x) => x.id !== id)); setGDraft(null);
    const { error } = await supabase.from("wed_guests").delete().eq("id", id);
    if (error) toast("삭제에 실패했어요"); else toast("명단에서 뺐습니다");
  };
  const mergeBoth = async () => {
    const e = overlap.existing, again = overlap.again, g = gDraft;
    const merged = { ...e, ...g, id: e.id, side: "공동", deliverer: "함께", relation: g.relation || e.relation, memo: [e.memo, g.memo].filter(Boolean).join(" / "), delivered: e.delivered || g.delivered, deliveredAt: e.deliveredAt || g.deliveredAt || "", updatedBy: uidMe };
    setGuests((r) => r.filter((x) => x.id !== g.id).map((x) => x.id === e.id ? merged : x));
    await supabase.from("wed_guests").delete().eq("id", g.id);
    await persistGuest(merged);
    setOverlap(null);
    if (again) { setGDraft({ id: uid(), name: "", side: "공동", relation: "", delivered: false, method: "대면", deliverer: "함께", attending: "미정", memo: "", createdBy: uidMe, updatedBy: uidMe }); setGMore(false); }
    else setGDraft(null);
    toast("공동 하객으로 합쳤습니다");
  };
  const keepApart = () => {
    const k = [overlap.existing.id, gDraft.id].sort().join("|");
    if (settings.skips.indexOf(k) < 0) patchSettings({ skips: [...settings.skips, k] });
    const again = overlap.again; setOverlap(null); commitGuest(again);
  };

  /* ── 모임 저장 ── */
  const saveMeeting = async () => {
    const m = { ...mDraft, updatedBy: uidMe };
    const exists = meetings.some((x) => x.id === m.id);
    let changed = [];
    if (mstatus(m) === "완료") {
      const upd = [];
      (m.attendeeIds || []).forEach((id) => { const g = guests.find((x) => x.id === id); if (g && !g.delivered) { const ng = { ...g, delivered: true, deliveredAt: m.date || today(), method: g.method || "대면", updatedBy: uidMe }; upd.push(ng); } });
      if (upd.length) { changed = upd; setGuests((r) => r.map((x) => { const f = upd.find((u) => u.id === x.id); return f || x; })); }
    }
    setMeetings((r) => exists ? r.map((x) => x.id === m.id ? m : x) : [...r, m]);
    const { error } = await supabase.from("wed_meetings").upsert(meetingToRow(m));
    if (error) { toast("저장에 실패했어요"); return; }
    if (changed.length) await Promise.all(changed.map((g) => persistGuest(g)));
    setMDraft(null);
    toast(changed.length ? `${changed.length}분을 전달완료로 바꿨습니다` : exists ? "수정했습니다" : "모임을 만들었습니다");
  };
  const delMeeting = async () => {
    const id = mDraft.id; setMeetings((r) => r.filter((x) => x.id !== id)); setMDraft(null);
    const { error } = await supabase.from("wed_meetings").delete().eq("id", id);
    if (error) toast("삭제에 실패했어요"); else toast("모임을 지웠습니다");
  };

  /* ── 기타 ── */
  const doCopy = (text, okMsg) => {
    if (!text) { toast("설정 탭에서 먼저 넣어 주세요"); return; }
    const fallback = () => { const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); toast(okMsg); } catch { toast("복사하지 못했습니다"); } ta.remove(); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(() => toast(okMsg), fallback); else fallback();
  };
  const copyLink = () => doCopy(settings.link, "링크를 복사했습니다");
  const copyMsg = () => { const m = (settings.msg || "").trim(); const full = m ? (m.indexOf(settings.link) >= 0 ? m : m + "\n" + settings.link) : settings.link; doCopy(full, "멘트를 복사했습니다"); };
  const wipeDo = async () => {
    setGuests([]); setMeetings([]); setWipeAsk(false);
    await supabase.from("wed_guests").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("wed_meetings").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await patchSettings({ skips: [] });
    toast("모두 지웠습니다");
  };
  const csv = () => {
    const head = ["이름", "구분", "관계", "전달여부", "전달방식", "전달일", "전달자", "참석여부", "메모"];
    const rows = guests.map((g) => [g.name, g.side, g.relation || "", g.delivered ? "전달완료" : "미전달", g.method || "", g.deliveredAt || "", g.deliverer || "", g.attending || "미정", (g.memo || "").replace(/[\n,]/g, " ")]);
    const text = "﻿" + [head].concat(rows).map((r) => r.map((c) => '"' + String(c) + '"').join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a"); a.href = url; a.download = "하객명단.csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); toast("CSV를 내려받았습니다");
  };

  /* ── 목록 ── */
  const visible = useMemo(() => guests
    .filter((g) => filt === "전체" || g.side === filt)
    .filter((g) => !undel || !g.delivered)
    .filter((g) => !q || (g.name + (g.relation || "")).indexOf(q) >= 0)
    .sort((a, b) => a.name.localeCompare(b.name, "ko")), [guests, filt, undel, q]);

  /* ========================= 렌더 ========================= */
  if (!authReady) return <><style>{CSS}</style><div className="wl"><div className="center"><span className="small">잠시만요…</span></div></div></>;
  if (!session) return <><style>{CSS}</style><div className="wl"><AuthGate onToast={toast} /></div></>;
  if (access === "no") return <><style>{CSS}</style><div className="wl"><NoAccess email={email} onSignOut={signOut} /></div></>;
  if (access === "unknown" || !loaded) return <><style>{CSS}</style><div className="wl"><div className="center"><span className="small">불러오는 중…</span></div></div></>;

  return (
    <><style>{CSS}</style><div className="wl">
      <header>
        <div className="hrow">
          <h1 className="serif">청첩장 명단</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {dday !== null && <span className="dday serif">{dday > 0 ? `결혼식까지 ${dday}일` : dday === 0 ? "오늘이 결혼식입니다" : "결혼식이 지났습니다"}</span>}
            <button aria-label="내 계정" onClick={() => setAccountOpen(true)}><Avatar user={me} size={30} /></button>
          </div>
        </div>
        {tab === "guests" && stats.left > 0 &&
          <p className="sub">{stats.scope === "전체" ? "아직" : stats.scope + " 하객 중 아직"} {stats.left}분에게 청첩장을 전하지 않았습니다.</p>}
        <div className="copyrow">
          <button onClick={copyLink}><LinkIcon size={15} /> 모청 링크 복사</button>
          <button onClick={copyMsg}><Copy size={15} /> 모청 멘트 복사</button>
        </div>
      </header>

      <main>
        {tab === "guests" && <GuestsTab {...{ stats, paper, settings, q, setQ, filt, setFilt, undel, setUndel, visible, tick, openGuest, guests }} />}
        {tab === "meetings" && <MeetingsTab {...{ meetings, mstatus, openMeeting }} />}
        {tab === "money" && <MoneyTab {...{ calc, settings, csv }} />}
        {tab === "settings" && <SettingsTab {...{ settings, patchSettings, managers, addManager, removeManager, email, setWipeAsk }} />}
      </main>

      {(tab === "guests" || tab === "meetings") &&
        <button className="fab" onClick={addNew} aria-label="새로 넣기"><Plus size={24} /></button>}

      <nav>
        {[["guests", "하객", Users], ["meetings", "모임", Calendar], ["money", "정산", Wallet], ["settings", "설정", Gear]].map(([t, label, Ic]) => (
          <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}><Ic size={20} /><span>{label}</span></button>
        ))}
      </nav>

      {gDraft && <GuestSheet {...{ gDraft, setGDraft, gMore, setGMore, relations, guests, attemptSaveGuest, delGuest }} />}
      {mDraft && <MeetingSheet {...{ mDraft, setMDraft, exDraft, setExDraft, guests, meetings, sidesIn, mstatus, saveMeeting, delMeeting }} />}
      {overlap && <OverlapModal {...{ overlap, mergeBoth, keepApart }} />}
      {wipeAsk && (
        <div className="modal"><div className="box">
          <h3 className="serif">전체를 지울까요?</h3>
          <p>하객 명단, 모임, 지출이 모두 사라집니다. 되돌릴 수 없습니다.</p>
          <button className="btn" style={{ background: "var(--bride)" }} onClick={wipeDo}>지우기</button>
          <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => setWipeAsk(false)}>그만두기</button>
        </div></div>
      )}
      {(accountOpen || needProfile) && <AccountSheet {...{ me, email, onSave: saveProfile, onSignOut: signOut, onClose: () => setAccountOpen(false), firstSetup: needProfile }} />}

      {toastMsg && <div className="toast"><span>{toastMsg}</span></div>}
    </div></>
  );
}

/* =============================================================================
 *  하객 탭
 * ========================================================================== */
function GuestsTab({ stats, paper, q, setQ, filt, setFilt, undel, setUndel, visible, tick, openGuest, guests }) {
  const s = stats, pp = paper;
  const warn = pp.left < 0, low = !warn && pp.left <= 5;
  return (
    <>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span className="small">{s.scope === "전체" ? "청첩장 전달" : s.scope + " 하객 전달"}</span>
          <span className="serif big">{s.done}<span className="small"> / {s.total}</span></span>
        </div>
        <div className="bar"><i style={{ width: s.pct + "%" }} /></div>
        <div className="small">남은 분 <b style={{ color: s.left ? "var(--bride)" : "var(--mute)" }}>{s.left}</b> &nbsp; 공동 <b style={{ color: "var(--both)" }}>{s.both}</b></div>
        {pp.total > 0 && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span className="small">종이 청첩장 남은 수</span>
            <span className="serif" style={{ fontSize: 19, color: warn ? "var(--bride)" : low ? "var(--both)" : "var(--ink)" }}>{pp.left}<span className="small"> / {pp.total}장</span></span>
          </div>
        )}
        {pp.total > 0 && warn && <div className="small" style={{ color: "var(--bride)", marginTop: 6 }}>주문한 수량보다 {Math.abs(pp.left)}장 더 전했습니다</div>}
        {pp.total > 0 && low && <div className="small" style={{ color: "var(--both)", marginTop: 6 }}>얼마 남지 않았습니다</div>}
        {/* 참석 현황 요약 (원본 데이터를 활용한 편의 개선) */}
        {s.total > 0 && (
          <div className="att">
            <div><div className="serif n" style={{ color: "var(--both)" }}>{s.att.참석}</div><div className="l">참석</div></div>
            <div><div className="serif n">{s.att.미정}</div><div className="l">미정</div></div>
            <div><div className="serif n" style={{ color: "var(--mute)" }}>{s.att.불참}</div><div className="l">불참</div></div>
          </div>
        )}
      </div>

      <div className="search">
        <span className="si"><Search size={17} /></span>
        <input value={q} placeholder="이름이나 관계로 찾기" onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="chips">
        {["전체", "신부", "신랑", "공동"].map((x) => (
          <button key={x} className={"chip " + (filt === x ? "on" : "")}
            style={filt === x && x !== "전체" ? { background: col(x), borderColor: col(x) } : undefined}
            onClick={() => setFilt(x)}>{x}</button>
        ))}
        <button className={"chip " + (undel ? "on" : "")} onClick={() => setUndel(!undel)}>미전달만</button>
      </div>

      <div>
        {visible.length === 0
          ? <div className="empty">{guests.length ? "조건에 맞는 하객이 없습니다." : <>오른쪽 아래 + 를 눌러<br />첫 하객을 넣어 보세요.</>}</div>
          : visible.map((g) => (
            <div className="row" key={g.id}>
              <button className={"tick " + (g.delivered ? "on" : "")} style={g.delivered ? { background: col(g.side) } : undefined} onClick={() => tick(g.id)} aria-label="전달 표시">
                <span style={{ color: g.delivered ? "#fff" : "var(--line)", display: "flex" }}><Check size={18} /></span>
              </button>
              <button className="rowbody" onClick={() => openGuest(g.id)}>
                <div className="rowtop"><span className="nm serif">{g.name}</span>
                  <span className="tag" style={{ background: col(g.side) + "1A", color: col(g.side) }}>{g.side}</span></div>
                <div className="rowsub">{[g.relation, g.delivered ? (g.method || "전달") + " · " + (g.deliveredAt || "") : "미전달", g.attending && g.attending !== "미정" ? g.attending : ""].filter(Boolean).join(" · ")}</div>
              </button>
              <span style={{ color: "var(--line)", display: "flex" }}><ChevronRight size={18} /></span>
            </div>
          ))}
      </div>
    </>
  );
}

/* =============================================================================
 *  모임 탭
 * ========================================================================== */
function MeetingsTab({ meetings, mstatus, openMeeting }) {
  if (!meetings.length) return <div className="empty">오른쪽 아래 + 를 눌러<br />모임을 만들어 보세요.</div>;
  return meetings.slice().sort((a, b) => (b.date || "").localeCompare(a.date || "")).map((m) => {
    const s = (m.expenses || []).reduce((a, e) => a + (Number(e.amount) || 0), 0);
    const st = mstatus(m);
    return (
      <button className="card" style={{ display: "block", width: "100%", textAlign: "left" }} key={m.id} onClick={() => openMeeting(m.id)}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="serif" style={{ fontSize: 17 }}>{m.place || "장소 미정"}</div>
            <div className="small" style={{ marginTop: 3 }}>{m.date || "날짜 미정"}
              {st ? <> · <b style={{ color: st === "완료" ? "var(--mute)" : "var(--bride)" }}>{st}</b></> : <> · <b style={{ color: "var(--both)" }}>오늘</b></>}</div>
          </div>
          <span className="tag" style={{ background: col(m.type) + "1A", color: col(m.type) }}>{m.type}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 13, paddingTop: 13, borderTop: "1px solid var(--line)" }}>
          <span className="small">{(m.attendeeIds || []).length}명 참석</span>
          <span className="serif" style={{ fontSize: 18 }}>{won(s)}원</span>
        </div>
      </button>
    );
  });
}

/* =============================================================================
 *  정산 탭
 * ========================================================================== */
function BudgetCard({ who, spent, bud }) {
  const c = who === "신부" ? "var(--bride)" : "var(--groom)";
  const pct = bud ? Math.min(100, Math.round(spent / bud * 100)) : 0, over = bud && spent > bud;
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="small" style={{ color: c }}>{who}</span>
        <span className="serif" style={{ fontSize: 22, color: over ? "var(--bride)" : "var(--ink)" }}>{won(spent)}원</span>
      </div>
      {bud ? (<>
        <div className="bar"><i style={{ width: pct + "%", background: over ? "var(--bride)" : c }} /></div>
        <div className="small" style={{ color: over ? "var(--bride)" : "var(--mute)" }}>
          {over ? `예산보다 ${won(spent - bud)}원 더 썼습니다` : `예산 ${won(bud)}원 중 ${won(bud - spent)}원 남았습니다`}</div>
      </>) : <div className="small" style={{ marginTop: 8 }}>설정 탭에서 예산을 넣으면 남은 금액이 보입니다</div>}
    </div>
  );
}
function MoneyTab({ calc, settings, csv }) {
  const c = calc;
  return (
    <>
      <div className="card"><div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="small">모임에 쓴 돈 전체</span><span className="serif big">{won(c.total)}원</span></div></div>
      <BudgetCard who="신부" spent={c.spend["신부"]} bud={Number(settings.budgetB) || 0} />
      <BudgetCard who="신랑" spent={c.spend["신랑"]} bud={Number(settings.budgetG) || 0} />
      <div className="card">
        <div className="small" style={{ marginBottom: 14 }}>하객 구분별</div>
        {SIDES.map((k) => {
          const amt = Math.round(c.byGuest[k]), n = c.cnt[k], avg = n ? Math.round(amt / n) : 0;
          return (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "11px 0", borderBottom: k !== "공동" ? "1px solid var(--line)" : "none" }}>
              <div><span className="tag" style={{ background: col(k) + "1A", color: col(k) }}>{k}</span><span className="small" style={{ marginLeft: 8 }}>{n}명 참석</span></div>
              <div style={{ textAlign: "right" }}><div className="serif" style={{ fontSize: 16 }}>{won(amt)}원</div><div className="small" style={{ fontSize: 12 }}>1인당 {won(avg)}원</div></div>
            </div>
          );
        })}
        <p className="small" style={{ margin: "12px 0 0", fontSize: 12.5, lineHeight: 1.6 }}>모임 비용을 참석자 머릿수 비율로 나눈 값입니다.</p>
      </div>
      {c.per.length > 0 && (
        <div className="card"><div className="small" style={{ marginBottom: 12 }}>비용이 큰 모임부터</div>
          {c.per.slice(0, 6).map((m) => <div className="money" key={m.id}><span>{m.place || "장소 미정"}</span><span className="small">{won(m.sum)}원</span></div>)}
        </div>
      )}
      <button className="btn ghost" onClick={csv}><Download size={17} /> 하객명단 CSV로 내려받기</button>
    </>
  );
}

/* =============================================================================
 *  설정 탭
 * ========================================================================== */
function SettingsTab({ settings, patchSettings, managers, addManager, removeManager, email, setWipeAsk }) {
  const [newEmail, setNewEmail] = useState("");
  return (
    <>
      <div className="card">
        <label className="f"><span>결혼식 날짜</span><input type="date" value={settings.weddingDate} onChange={(e) => patchSettings({ weddingDate: e.target.value })} /></label>
        <label className="f"><span>신부 예산 (원)</span><input type="number" inputMode="numeric" value={settings.budgetB} placeholder="예: 800000" onChange={(e) => patchSettings({ budgetB: e.target.value })} /></label>
        <label className="f"><span>신랑 예산 (원)</span><input type="number" inputMode="numeric" value={settings.budgetG} placeholder="예: 800000" onChange={(e) => patchSettings({ budgetG: e.target.value })} /></label>
        <label className="f" style={{ marginBottom: 0 }}><span>종이 청첩장 주문 수량 (장)</span><input type="number" inputMode="numeric" value={settings.paperTotal} placeholder="예: 200" onChange={(e) => patchSettings({ paperTotal: e.target.value })} /></label>
      </div>

      <div className="card">
        <div className="serif" style={{ marginBottom: 12 }}>모바일 청첩장</div>
        <label className="f"><span>링크</span><input value={settings.link} placeholder="https://" onChange={(e) => patchSettings({ link: e.target.value })} /></label>
        <label className="f" style={{ marginBottom: 0 }}><span>보낼 멘트</span><textarea rows={4} placeholder="멘트를 넣어 두면 링크와 함께 복사됩니다" value={settings.msg} onChange={(e) => patchSettings({ msg: e.target.value })} /></label>
        <p className="small" style={{ margin: "10px 0 0", lineHeight: 1.6 }}>멘트 끝에 링크가 자동으로 붙습니다. 멘트 안에 링크를 직접 넣으셨다면 그대로 복사됩니다.</p>
      </div>

      {/* 공동 관리자 */}
      <div className="card">
        <div className="serif" style={{ marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}><ShieldCheck size={16} /> 공동 관리자</div>
        <p className="small" style={{ margin: "0 0 12px", lineHeight: 1.7 }}>여기 등록된 이메일만 이 명단을 보고 고칠 수 있습니다. 배우자의 이메일을 넣어 함께 관리하세요.</p>
        <div>
          {managers.map((m) => (
            <div className="mgr" key={m.email}>
              <Mail size={16} style={{ color: "var(--mute)", flex: "0 0 auto" }} />
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 14.5 }}>{m.email}</span>
              {m.email.toLowerCase() === email.toLowerCase()
                ? <span className="small" style={{ fontSize: 12 }}>나</span>
                : <button aria-label="삭제" style={{ color: "var(--bride)", width: "auto", padding: 4 }} onClick={() => removeManager(m.email)}><X size={16} /></button>}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <input type="email" inputMode="email" value={newEmail} placeholder="배우자 이메일" style={{ flex: 1 }}
            onChange={(e) => setNewEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { addManager(newEmail); setNewEmail(""); } }} />
          <button className="btn" style={{ width: "auto", padding: "0 18px", marginTop: 0 }} onClick={() => { addManager(newEmail); setNewEmail(""); }}><UserPlus size={17} /></button>
        </div>
      </div>

      <div className="card">
        <div className="serif" style={{ marginBottom: 8 }}>저장 위치</div>
        <p className="small" style={{ margin: 0, lineHeight: 1.7 }}>명단은 두 관리자의 계정에만 공유되는 안전한 저장소(Supabase)에 보관되고, 두 기기 사이에서 실시간으로 동기화됩니다. 인터넷이 끊겨도 마지막으로 본 명단은 이 기기에서 보이며, 가끔 정산 탭에서 CSV로 백업해 두면 안심입니다.</p>
      </div>

      <div className="card">
        <div className="serif" style={{ marginBottom: 8 }}>겹지인 판단 기록</div>
        <p className="small" style={{ margin: "0 0 14px", lineHeight: 1.7 }}>다른 분이라고 답하신 이름이 {settings.skips.length}건 있습니다. 지우면 다음에 같은 이름을 넣을 때 다시 물어봅니다.</p>
        <button className="btn ghost" onClick={() => patchSettings({ skips: [] })}>기록 지우기</button>
      </div>

      <button className="btn warn" onClick={() => setWipeAsk(true)}>전체 지우기</button>
    </>
  );
}

/* =============================================================================
 *  하객 시트
 * ========================================================================== */
function GuestSheet({ gDraft, setGDraft, gMore, setGMore, relations, guests, attemptSaveGuest, delGuest }) {
  const g = gDraft;
  const isNew = !guests.some((x) => x.id === g.id);
  const set = (k, v) => setGDraft({ ...g, [k]: v });
  return (
    <div className="veil" onClick={(e) => { if (e.target.classList.contains("veil")) setGDraft(null); }}>
      <div className="sheet">
        <div className="shead"><h2 className="serif">{isNew ? "하객 넣기" : "하객 정보"}</h2>
          <button aria-label="닫기" style={{ color: "var(--mute)", padding: 6, margin: -6, width: "auto" }} onClick={() => setGDraft(null)}><X size={20} /></button></div>
        <div className="sbody">
          <label className="f"><span>이름</span>
            <input id="gname" value={g.name} placeholder="이름" autoFocus onChange={(e) => set("name", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && attemptSaveGuest(false)} /></label>
          <label className="f"><span>구분</span><Seg opts={SIDES} cur={g.side} onPick={(v) => set("side", v)} colored /></label>
          <label className="f"><span>관계</span>
            <input id="grel" value={g.relation} placeholder="회사 · 대학 · 가족 · 친구" onChange={(e) => set("relation", e.target.value)} />
            {relations.length > 0 && <div className="chips" style={{ margin: "8px 0 0" }}>{relations.map((r) => <button key={r} className="chip" onClick={() => set("relation", r)}>{r}</button>)}</div>}
          </label>

          {!gMore ? (
            <button className="more" onClick={() => setGMore(true)}>전달 여부 · 참석 · 메모 더 넣기</button>
          ) : (
            <>
              <label className="f"><span>전달 여부</span>
                <Seg opts={["미전달", "전달완료"]} cur={g.delivered ? "전달완료" : "미전달"} onPick={(v) => { const d = v === "전달완료"; setGDraft({ ...g, delivered: d, deliveredAt: d ? (g.deliveredAt || today()) : "" }); }} /></label>
              {g.delivered && <>
                <label className="f"><span>전달 방식</span><Seg opts={METHODS} cur={g.method} onPick={(v) => set("method", v)} /></label>
                <label className="f"><span>전달한 사람</span><Seg opts={DELIVERER} cur={g.deliverer} onPick={(v) => set("deliverer", v)} /></label>
                <label className="f"><span>전달일</span><input type="date" value={g.deliveredAt || ""} onChange={(e) => set("deliveredAt", e.target.value)} /></label>
              </>}
              <label className="f"><span>참석 여부</span><Seg opts={ATTEND} cur={g.attending} onPick={(v) => set("attending", v)} /></label>
              <label className="f"><span>메모</span><textarea rows={2} placeholder="부모님 지인, 알레르기 등" value={g.memo} onChange={(e) => set("memo", e.target.value)} /></label>
            </>
          )}

          <button className="btn" onClick={() => attemptSaveGuest(false)}>저장</button>
          {isNew
            ? <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => attemptSaveGuest(true)}>저장하고 다음 사람</button>
            : <button className="btn warn" onClick={delGuest}><Trash2 size={15} /> 명단에서 빼기</button>}
        </div>
      </div>
    </div>
  );
}

/* =============================================================================
 *  모임 시트
 * ========================================================================== */
function MeetingSheet({ mDraft, setMDraft, exDraft, setExDraft, guests, meetings, sidesIn, mstatus, saveMeeting, delMeeting }) {
  const m = mDraft;
  const isNew = !meetings.some((x) => x.id === m.id);
  const set = (k, v) => setMDraft({ ...m, [k]: v });
  const sum = (m.expenses || []).reduce((a, e) => a + (Number(e.amount) || 0), 0);
  const auto = mstatus(m);
  const allow = sidesIn(m);
  const payer = allow.indexOf(exDraft.payer) < 0 ? allow[0] : exDraft.payer;

  const toggleAtt = (id) => { const cur = m.attendeeIds || []; const i = cur.indexOf(id); set("attendeeIds", i >= 0 ? cur.filter((x) => x !== id) : [...cur, id]); };
  const addEx = () => {
    if (!exDraft.label.trim() || !exDraft.amount) { return; }
    set("expenses", [...(m.expenses || []), { id: uid(), label: exDraft.label, amount: exDraft.amount, payer, category: exDraft.category }]);
    setExDraft({ label: "", amount: "", payer, category: exDraft.category });
  };
  const delEx = (id) => set("expenses", (m.expenses || []).filter((e) => e.id !== id));
  const pickPreset = (label, cat) => { setExDraft({ ...exDraft, label, category: cat }); setTimeout(() => document.getElementById("exa")?.focus(), 60); };

  return (
    <div className="veil" onClick={(e) => { if (e.target.classList.contains("veil")) setMDraft(null); }}>
      <div className="sheet">
        <div className="shead"><h2 className="serif">{isNew ? "모임 만들기" : "모임"}</h2>
          <button aria-label="닫기" style={{ color: "var(--mute)", padding: 6, margin: -6, width: "auto" }} onClick={() => setMDraft(null)}><X size={20} /></button></div>
        <div className="sbody">
          <label className="f"><span>날짜</span><input type="date" value={m.date} onChange={(e) => set("date", e.target.value)} /></label>
          <label className="f"><span>진행 상태</span>
            {m.date === today()
              ? <><Seg opts={["예정", "완료"]} cur={m.status || "예정"} onPick={(v) => set("status", v)} /><div className="small" style={{ marginTop: 7, fontSize: 12.5 }}>오늘 모임입니다. 끝나면 완료로 바꿔 주세요.</div></>
              : <div className="mini" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 14.5, color: auto === "완료" ? "var(--mute)" : "var(--bride)" }}>{auto}</span>
                  <span className="small" style={{ fontSize: 12 }}>날짜 기준으로 자동 표시됩니다</span></div>}
          </label>
          <label className="f"><span>장소</span><input value={m.place} placeholder="식당·카페 이름" onChange={(e) => set("place", e.target.value)} /></label>
          <label className="f"><span>모임 성격</span><Seg opts={SIDES} cur={m.type} onPick={(v) => set("type", v)} colored /></label>

          <label className="f"><span>참석자 {(m.attendeeIds || []).length}명</span>
            {!guests.length
              ? <div className="mini small">하객 탭에서 명단을 먼저 만들어 주세요.</div>
              : <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 6, maxHeight: 190, overflowY: "auto" }}>
                  {guests.slice().sort((a, b) => a.name.localeCompare(b.name, "ko")).map((g) => {
                    const on = (m.attendeeIds || []).indexOf(g.id) >= 0;
                    return (
                      <button key={g.id} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 12px", borderRadius: 9, textAlign: "left", background: on ? "var(--paper)" : "none" }} onClick={() => toggleAtt(g.id)}>
                        <span style={{ fontSize: 14.5 }}>{g.name}<span style={{ color: col(g.side) }}> · {g.side}</span></span>
                        {on && <Check size={16} />}
                      </button>
                    );
                  })}
                </div>}
          </label>

          <div style={{ marginBottom: 16 }}>
            <div className="money" style={{ marginBottom: 8 }}><span className="small">지출</span><span className="serif" style={{ fontSize: 16 }}>{won(sum)}원</span></div>
            {(m.expenses || []).map((e) => (
              <div className="exp" key={e.id}>
                <div><div style={{ fontSize: 14.5 }}>{e.label}</div><div className="small" style={{ fontSize: 12 }}>{e.category} · {e.payer} 결제</div></div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}><span style={{ fontSize: 14.5 }}>{won(e.amount)}원</span>
                  <button aria-label="지출 삭제" style={{ color: "var(--mute)", width: "auto" }} onClick={() => delEx(e.id)}><X size={15} /></button></div>
              </div>
            ))}
            <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 14 }}>
              <div className="chips" style={{ marginBottom: 10 }}>
                {PRESETS.map((pr) => <button key={pr[0]} className={"chip " + (exDraft.label === pr[0] ? "on" : "")} onClick={() => pickPreset(pr[0], pr[1])}>{pr[0]}</button>)}
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input id="exl" value={exDraft.label} placeholder="항목" style={{ flex: 1 }} onChange={(e) => setExDraft({ ...exDraft, label: e.target.value })} />
                <input id="exa" type="number" inputMode="numeric" value={exDraft.amount} placeholder="금액" style={{ width: 110 }} onChange={(e) => setExDraft({ ...exDraft, amount: e.target.value })} />
              </div>
              {allow.length === 1
                ? <div className="mini" style={{ textAlign: "center", fontSize: 14, color: col(allow[0]) }}>{allow[0]} 지출로 기록됩니다</div>
                : <Seg opts={["신부", "신랑"]} cur={payer} onPick={(v) => setExDraft({ ...exDraft, payer: v })} colored />}
              <button className="btn ghost" style={{ marginTop: 10, padding: 13 }} onClick={addEx}><Plus size={16} /> 지출 넣기</button>
            </div>
          </div>

          <button className="btn" onClick={saveMeeting}>저장</button>
          {!isNew && <button className="btn warn" onClick={delMeeting}><Trash2 size={15} /> 모임 지우기</button>}
        </div>
      </div>
    </div>
  );
}

/* =============================================================================
 *  겹지인 모달
 * ========================================================================== */
function OverlapModal({ overlap, mergeBoth, keepApart }) {
  const e = overlap.existing;
  return (
    <div className="modal"><div className="box">
      <h3 className="serif">겹지인인가요?</h3>
      <p><b style={{ color: "var(--ink)" }}>{e.name}</b>님은 이미 <b style={{ color: col(e.side) }}>{e.side}</b> 명단에 있습니다{e.relation ? ` (${e.relation})` : ""}.<br />같은 분이면 한 줄로 합치고 공동 하객으로 바꿉니다.</p>
      <button className="btn" style={{ background: "var(--both)" }} onClick={mergeBoth}>같은 분입니다 · 공동으로 합치기</button>
      <button className="btn ghost" style={{ marginTop: 8 }} onClick={keepApart}>다른 분입니다 · 따로 두기</button>
    </div></div>
  );
}

/* =============================================================================
 *  내 계정 / 프로필
 * ========================================================================== */
function AccountSheet({ me, email, onSave, onSignOut, onClose, firstSetup }) {
  const [editing, setEditing] = useState(firstSetup);
  const [name, setName] = useState(me.name || "");
  const [emoji, setEmoji] = useState(me.emoji || "💍");
  const save = () => { if (!name.trim()) return; onSave({ name: name.trim(), emoji }); };
  return (
    <div className="veil" onClick={(e) => { if (!firstSetup && e.target.classList.contains("veil")) onClose(); }}>
      <div className="sheet">
        <div className="shead"><h2 className="serif">{firstSetup ? "프로필 설정" : editing ? "프로필 수정" : "내 계정"}</h2>
          {!firstSetup && <button aria-label="닫기" style={{ color: "var(--mute)", padding: 6, margin: -6, width: "auto" }} onClick={onClose}><X size={20} /></button>}</div>
        <div className="sbody">
          {editing ? (<>
            {firstSetup && <p className="small" style={{ textAlign: "center", margin: "0 0 16px", lineHeight: 1.6 }}>처음 오셨네요! 프로필 이모지와 이름을 정해 주세요.</p>}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}><Avatar user={{ emoji }} size={72} /></div>
            <label className="f"><span>이름</span><input value={name} autoFocus placeholder="예) 유나" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} /></label>
            <label className="f" style={{ marginBottom: 0 }}><span>프로필 이모지</span>
              <div className="emoji-grid">{EMOJIS.map((em) => <button key={em} className={"emoji-btn " + (emoji === em ? "on" : "")} onClick={() => setEmoji(em)}>{em}</button>)}</div></label>
            <button className="btn" style={{ marginTop: 18 }} disabled={!name.trim()} onClick={save}><Check size={16} /> 저장</button>
            {!firstSetup && <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => setEditing(false)}>취소</button>}
          </>) : (<>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <Avatar user={me} size={48} />
              <div style={{ minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 16 }}>{me.name}</div>
                {email && <div className="small" style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</div>}</div>
            </div>
            <button className="btn ghost" style={{ marginBottom: 8 }} onClick={() => { setName(me.name || ""); setEmoji(me.emoji || "💍"); setEditing(true); }}><Pencil size={15} /> 프로필 수정</button>
            <button className="btn ghost" onClick={onSignOut}><LogOut size={15} /> 로그아웃</button>
          </>)}
        </div>
      </div>
    </div>
  );
}
