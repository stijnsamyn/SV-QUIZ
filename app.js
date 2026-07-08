/* ============================================================
   QUIZT.ET — frontend (vanilla JS + Supabase)
   ============================================================ */
"use strict";

/* ---------- Supabase client ---------- */
const CFG = window.CONFIG || {};
const configOk = CFG.SUPABASE_URL && !CFG.SUPABASE_URL.startsWith("VUL_") &&
                 CFG.SUPABASE_ANON_KEY && !CFG.SUPABASE_ANON_KEY.startsWith("VUL_");
const sb = configOk ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;

/* ---------- State ---------- */
let ME = null;            // profiel {id, display_name, role}
const app = document.getElementById("app");

/* ---------- Line-icons (subtiel, currentColor) ---------- */
const ICON = {
  person: `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1"/></svg>`,
  robot: `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="9" width="15" height="10" rx="2.5"/><path d="M12 9V5.5"/><circle cx="12" cy="4.2" r="1.1"/><path d="M9.5 13.5v1.5M14.5 13.5v1.5"/></svg>`,
  flag: `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 21V4M6 4h11l-2.2 3.2L17 11H6"/></svg>`,
  chat: `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 15a3 3 0 0 1-3 3H8l-4 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3z"/></svg>`,
  clock: `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>`,
  check: `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>`,
  info: `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="7.7" r="0.6" fill="currentColor"/></svg>`,
};
// info-icoon met hover-tooltip
function infoTip(text){ return `<span class="infotip" tabindex="0" data-tip="${esc(text)}">${ICON.info}</span>`; }
// tags/badges voor een vraag
function questionTags(q){
  const t=[];
  if(q.validated===false) t.push(`<span class="tag tag-warn">Niet gevalideerd ${infoTip("Er is nog geen officieel juist antwoord. Kies via de opmerkingen wat volgens jou het juiste antwoord is, en gebruik de flags om erover in overleg te gaan.")}</span>`);
  else t.push(`<span class="tag tag-ok">Gevalideerd ${infoTip("Het juiste antwoord is nagekeken en bevestigd door een beheerder.")}</span>`);
  if(q.multi || arr(q.correct_indexes).length>1) t.push(`<span class="tag">Meerkeuze ${infoTip("Er kunnen meerdere antwoorden juist zijn — kruis alle juiste aan.")}</span>`);
  return t.join(" ");
}
function isRight(q, chosen){ return q.validated===false ? null : setEq(chosen, q.correct_indexes); }
function srcBadge(kind, src){
  const t = src === "ai" ? "Door AI bepaald" : "Door een mens bepaald";
  return `<span class="src ${src}" title="${kind}: ${t}">${src==="ai"?ICON.robot:ICON.person}</span>`;
}

/* ---------- Helpers ---------- */
const esc = s => (s==null?"":String(s)).replace(/[&<>"']/g, c => (
  {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const letter = i => String.fromCharCode(65 + i);
// Vertrouwde, door beheerders ingevoerde inhoud (uitleg, wettelijke basis, wettekst) mag als HTML.
const html = s => (s==null?"":String(s));
function fmtDate(d){ const x=new Date(d); return x.toLocaleDateString("nl-BE",{day:"numeric",month:"short",year:"numeric"})+" "+x.toLocaleTimeString("nl-BE",{hour:"2-digit",minute:"2-digit"}); }
function toast(msg, kind){ const t=document.getElementById("toast"); t.className="toast "+(kind||""); t.textContent=msg; t.hidden=false; clearTimeout(t._t); t._t=setTimeout(()=>t.hidden=true, 3200); }
function go(hash){ if(location.hash===hash) route(); else location.hash=hash; }
const isEditor = () => ME && (ME.role==="beheerder"||ME.role==="admin");
const isAdmin  = () => ME && ME.role==="admin";
function pct(n,d){ return d? Math.round(n/d*100):0; }
const arr = v => Array.isArray(v)?v:(v==null?[]:[v]);
const setEq = (a,b)=>{ a=arr(a); b=arr(b); if(a.length!==b.length) return false; const s=new Set(a); return b.every(x=>s.has(x)); };
const inSet = (a,i)=>arr(a).includes(i);
const lettersOf = idxs => arr(idxs).slice().sort((x,y)=>x-y).map(letter).join(", ")||"—";

/* ---------- Statistiek-hulpjes ---------- */
function scored(events){ return (events||[]).filter(e=>e.is_correct!=null); }  // enkel gevalideerde antwoorden
function dailyAccuracy(events){
  const byDay={};
  scored(events).forEach(e=>{ const d=(e.created_at||"").slice(0,10); if(!d)return; (byDay[d]=byDay[d]||{c:0,t:0}); byDay[d].t++; if(e.is_correct)byDay[d].c++; });
  return Object.keys(byDay).sort().map(d=>({label:d.slice(5), value:Math.round(byDay[d].c/byDay[d].t*100), n:byDay[d].t}));
}
function cumulativeAccuracy(events){
  const ev=scored(events).sort((a,b)=>(a.created_at||"")<(b.created_at||"")?-1:1);
  let c=0; return ev.map((e,i)=>{ if(e.is_correct)c++; return {label:String(i+1), value:Math.round(c/(i+1)*100)}; });
}
function improvement(events){ // eerste helft vs tweede helft
  const ev=scored(events).sort((a,b)=>(a.created_at||"")<(b.created_at||"")?-1:1);
  if(ev.length<6) return null;
  const h=Math.floor(ev.length/2);
  const acc=a=>Math.round(a.filter(e=>e.is_correct).length/a.length*100);
  return { first:acc(ev.slice(0,h)), last:acc(ev.slice(h)) };
}
function lineChartSVG(points, opts){
  opts=opts||{}; const color=opts.color||"#2952cc";
  const W=680,H=210,pL=30,pR=12,pT=12,pB=28,n=points.length;
  if(!n) return `<p class="muted">Nog geen gegevens — speel wat vragen om je curve te zien.</p>`;
  const X=i=> n===1? pL+(W-pL-pR)/2 : pL+i*(W-pL-pR)/(n-1);
  const Y=v=> pT+(1-v/100)*(H-pT-pB);
  const path=points.map((p,i)=>`${i?"L":"M"}${X(i).toFixed(1)},${Y(p.value).toFixed(1)}`).join(" ");
  const grid=[0,50,100].map(g=>`<line x1="${pL}" y1="${Y(g)}" x2="${W-pR}" y2="${Y(g)}" stroke="#dfe3ea"/><text x="2" y="${Y(g)+3}" font-size="9" fill="#5b6472">${g}</text>`).join("");
  const dots=points.map((p,i)=>`<circle cx="${X(i).toFixed(1)}" cy="${Y(p.value).toFixed(1)}" r="2.4" fill="${color}"><title>${esc(p.label)}: ${p.value}%${p.n?` (${p.n})`:""}</title></circle>`).join("");
  const step=Math.max(1,Math.ceil(n/8));
  const xl=points.map((p,i)=>(i%step===0||i===n-1)?`<text x="${X(i)}" y="${H-8}" font-size="9" fill="#5b6472" text-anchor="middle">${esc(p.label)}</text>`:"").join("");
  return `<svg viewBox="0 0 ${W} ${H}" class="chart">${grid}<path d="${path}" fill="none" stroke="${color}" stroke-width="2"/>${dots}${xl}</svg>`;
}
function kpi(label,val,sub){ return `<div class="kpi"><div class="kpi-val">${val}</div><div class="kpi-lab">${esc(label)}</div>${sub?`<div class="kpi-sub">${esc(sub)}</div>`:""}</div>`; }
function dailyCounts(rows){
  const by={}; rows.forEach(r=>{ const d=(r.created_at||"").slice(0,10); if(d) by[d]=(by[d]||0)+1; });
  return Object.keys(by).sort().map(d=>({label:d.slice(5), value:by[d]}));
}
function barChartSVG(points, opts){
  opts=opts||{}; const color=opts.color||"#2952cc";
  const W=680,H=180,pL=30,pR=12,pT=12,pB=28,n=points.length;
  if(!n) return `<p class="muted">Nog geen gegevens.</p>`;
  const maxV=Math.max(1,...points.map(p=>p.value));
  const gap=(W-pL-pR)/n, bw=gap*0.68;
  const Y=v=>pT+(1-v/maxV)*(H-pT-pB), base=H-pB;
  const grid=[0,maxV].map(g=>`<line x1="${pL}" y1="${Y(g)}" x2="${W-pR}" y2="${Y(g)}" stroke="#dfe3ea"/><text x="2" y="${Y(g)+3}" font-size="9" fill="#5b6472">${g}</text>`).join("");
  const bars=points.map((p,i)=>{ const x=pL+i*gap+(gap-bw)/2, y=Y(p.value); return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${(base-y).toFixed(1)}" rx="1.5" fill="${color}"><title>${esc(p.label)}: ${p.value}</title></rect>`; }).join("");
  const step=Math.max(1,Math.ceil(n/10));
  const xl=points.map((p,i)=>(i%step===0||i===n-1)?`<text x="${pL+i*gap+gap/2}" y="${H-8}" font-size="9" fill="#5b6472" text-anchor="middle">${esc(p.label)}</text>`:"").join("");
  return `<svg viewBox="0 0 ${W} ${H}" class="chart">${grid}${bars}${xl}</svg>`;
}

// PROM-cohorten: nu is PROM23 de nieuwste; vanaf 1 maart 2027 komt PROM24 erbij,
// daarna elk jaar op 1 maart één nummer hoger. Groeit dus vanzelf.
function promList(){
  const base=23, baseYear=2027;           // 1 maart 2027 → PROM24
  const now=new Date(), Y=now.getFullYear(), m=now.getMonth();  // maart = index 2
  const latest = base + Math.max(0, Y-baseYear) + ((Y>=baseYear && m>=2)?1:0);
  const out=[]; for(let n=latest;n>=base;n--) out.push("PROM"+n);
  return out;
}

/* ============================================================
   AUTH
   ============================================================ */
async function loadProfile(){
  const { data:{ user } } = await sb.auth.getUser();
  if(!user){ ME=null; return; }
  const { data } = await sb.from("profiles").select("*").eq("id", user.id).single();
  ME = data ? { ...data, email:user.email } : null;
}

async function viewLogin(){
  let regOpen = true;
  try{ const {data}=await sb.from("app_settings").select("registration_open").eq("id",1).single(); if(data) regOpen=data.registration_open; }catch(e){}
  app.innerHTML = `
    <div class="auth-wrap">
      <div class="card">
        <h1>QUIZT.ET</h1>
        <p class="muted" style="margin-bottom:1rem">Oefenquizzen</p>
        <div class="tabs">
          <button id="tabLogin" class="active">Inloggen</button>
          <button id="tabReg" ${regOpen?"":"disabled title='Registratie is afgesloten'"}>Registreren</button>
        </div>
        <div id="regNote" class="notice" hidden>
          <strong>Toegang enkel met een @police.belgium.eu e-mailadres.</strong>
          Registreer met je politie-e-mailadres; andere adressen worden geweigerd.
          <br><br>Sterk aangeraden: gebruik hier een wachtwoord dat je <strong>nog nooit ergens anders</strong> hebt gebruikt.
        </div>
        <form id="authForm">
          <div id="nameRow" hidden><label>Weergavenaam</label><input id="dname" autocomplete="name"></div>
          <div id="cohortRow" hidden>
            <label>Oorsprong</label>
            <select id="cohort">${promList().map(p=>`<option value="${p}">${p}</option>`).join("")}<option value="__ander">Andere…</option></select>
            <input id="cohortOther" placeholder="Vul je oorsprong in" hidden style="margin-top:.4rem">
          </div>
          <label>E-mail</label><input id="email" type="email" autocomplete="email" required>
          <label>Wachtwoord</label><input id="pw" type="password" autocomplete="current-password" required minlength="6">
          <div class="btnrow"><button class="btn btn-primary" type="submit" id="submitBtn" style="width:100%">Inloggen</button></div>
        </form>
        ${regOpen?"":`<p class="muted" style="margin-top:.8rem">Registratie is momenteel afgesloten door een beheerder.</p>`}
      </div>
    </div>`;
  let mode="login";
  const setMode = m => { mode=m;
    document.getElementById("tabLogin").classList.toggle("active",m==="login");
    document.getElementById("tabReg").classList.toggle("active",m==="reg");
    document.getElementById("nameRow").hidden = m!=="reg";
    document.getElementById("cohortRow").hidden = m!=="reg";
    document.getElementById("regNote").hidden = m!=="reg";
    document.getElementById("submitBtn").textContent = m==="reg"?"Account aanmaken":"Inloggen";
  };
  document.getElementById("cohort").onchange=e=>{
    document.getElementById("cohortOther").hidden = e.target.value!=="__ander";
  };
  document.getElementById("tabLogin").onclick=()=>setMode("login");
  document.getElementById("tabReg").onclick=()=>{ if(regOpen) setMode("reg"); };
  document.getElementById("authForm").onsubmit = async e=>{
    e.preventDefault();
    const email=document.getElementById("email").value.trim();
    const pw=document.getElementById("pw").value;
    const btn=document.getElementById("submitBtn"); btn.disabled=true;
    try{
      if(mode==="reg"){
        if(!email.toLowerCase().endsWith("@police.belgium.eu")){ toast("Registreren kan enkel met een @police.belgium.eu e-mailadres.","err"); btn.disabled=false; return; }
        const dname=document.getElementById("dname").value.trim()||email.split("@")[0];
        let cohort=document.getElementById("cohort").value;
        if(cohort==="__ander") cohort=document.getElementById("cohortOther").value.trim();
        if(!cohort){ toast("Geef je oorsprong op.","err"); btn.disabled=false; return; }
        const { error } = await sb.auth.signUp({ email, password:pw, options:{ data:{ display_name:dname, cohort } }});
        if(error) throw error;
        toast("Account aangemaakt. Je kan nu inloggen.","ok");
        setMode("login");
      }else{
        const { error } = await sb.auth.signInWithPassword({ email, password:pw });
        if(error) throw error;
        await boot();
      }
    }catch(err){ toast(err.message||"Er ging iets mis","err"); }
    finally{ btn.disabled=false; }
  };
}

async function doLogout(){ await sb.auth.signOut(); ME=null; go("#/login"); location.reload(); }

/* ============================================================
   HEADER / ROUTER
   ============================================================ */
function renderHeader(){
  const h=document.getElementById("appHeader");
  if(!ME){ h.hidden=true; return; }
  h.hidden=false;
  const nav=document.getElementById("topnav");
  const links=[["#/","Quizzen"],["#/stats/vragen","Vraagstatistiek"]];
  if(isEditor()) links.push(["#/stats/gebruikers","Gebruikers"]);
  if(isEditor()) links.push(["#/beheer","Beheer"]);
  nav.innerHTML = links.map(([h,l])=>`<a data-nav="${h}">${l}</a>`).join("");
  const roleName = ME.role==="admin"?"admin":ME.role==="beheerder"?"beheerder":"speler";
  document.getElementById("userbox").innerHTML =
    `<span class="role ${ME.role}">${roleName}</span><span>${esc(ME.display_name)}</span>`+
    `<button class="btn btn-ghost btn-sm" id="logoutBtn">Uitloggen</button>`;
  document.getElementById("logoutBtn").onclick=doLogout;
  document.querySelectorAll("[data-nav]").forEach(a=>a.onclick=()=>go(a.dataset.nav));
  const cur = location.hash||"#/";
  nav.querySelectorAll("a").forEach(a=>a.classList.toggle("active", a.dataset.nav===cur || (a.dataset.nav==="#/"&&cur.startsWith("#/quiz"))));
}

async function route(){
  if(!sb){ app.innerHTML=`<div class="card"><h1>Nog niet geconfigureerd</h1><p class="muted">Vul je Supabase-gegevens in <code>config.js</code> in. Zie SETUP.md.</p></div>`; return; }
  if(!ME){ document.getElementById("appHeader").hidden=true; return viewLogin(); }
  renderHeader();
  const h=(location.hash||"#/").slice(1);
  const p=h.split("/").filter(Boolean);   // ["quiz","<id>","overzicht"]
  app.innerHTML=`<div class="loading">Laden…</div>`;
  try{
    if(p.length===0) return viewHome();
    if(p[0]==="quiz" && p[2]==="overzicht") return viewOverview(p[1]);
    if(p[0]==="quiz" && p[2]==="stats") return viewQuizStats(p[1]);
    if(p[0]==="quiz") return viewPlay(p[1]);
    if(p[0]==="stats" && p[1]==="vragen") return viewStatsVragen();
    if(p[0]==="stats" && p[1]==="gebruikers") return viewStatsGebruikers();
    if(p[0]==="beheer" && p[1]==="quiz") return viewBeheerQuiz(p[2]);
    if(p[0]==="beheer" && p[1]==="import") return viewImport();
    if(p[0]==="beheer") return viewBeheer();
    viewHome();
  }catch(err){ console.error(err); app.innerHTML=`<div class="card err">Fout: ${esc(err.message)}</div>`; }
}
window.addEventListener("hashchange", route);

/* ============================================================
   HOME — quizoverzicht
   ============================================================ */
async function viewHome(){
  const { data:quizzes, error } = await sb.from("quizzes").select("*").order("created_at");
  if(error) throw error;
  // aantal vragen per quiz + mijn voortgang
  const { data:qs } = await sb.from("questions").select("id,quiz_id");
  const counts={}, q2quiz={}; (qs||[]).forEach(q=>{ counts[q.quiz_id]=(counts[q.quiz_id]||0)+1; q2quiz[q.id]=q.quiz_id; });
  const myAns={};
  const qids=(qs||[]).map(q=>q.id);
  if(qids.length){ const {data:mine}=await sb.from("answers").select("question_id").eq("user_id",ME.id).in("question_id",qids);
    (mine||[]).forEach(a=>{ const qz=q2quiz[a.question_id]; if(qz) myAns[qz]=(myAns[qz]||0)+1; }); }
  const cards=(quizzes||[]).map(q=>{
    const tot=counts[q.id]||0, done=myAns[q.id]||0;
    return `
    <div class="card quiz-card" data-open="${q.id}">
      <div class="spread"><h3>${esc(q.title)}</h3>
        <span class="badge ${q.status==="gepubliceerd"?"pub":"concept"}">${q.status}</span></div>
      <p class="muted">${esc(q.description||"")}</p>
      <div class="bar" style="margin-top:.7rem"><span style="width:${pct(done,tot)}%"></span><div class="lab">${done}/${tot} beantwoord</div></div>
    </div>`;}).join("");
  app.innerHTML=`
    <div class="spread"><h1>Quizzen</h1>${isEditor()?`<button class="btn btn-primary btn-sm" data-nav="#/beheer">Beheer</button>`:""}</div>
    ${quizzes&&quizzes.length?`<div class="grid" style="margin-top:1rem">${cards}</div>`:`<div class="empty">Nog geen quizzen.</div>`}`;
  app.querySelectorAll("[data-open]").forEach(c=>c.onclick=()=>go("#/quiz/"+c.dataset.open));
  app.querySelectorAll("[data-nav]").forEach(a=>a.onclick=()=>go(a.dataset.nav));
}

/* ============================================================
   PLAY — vraag per vraag
   ============================================================ */
const PLAY={ mode:"slim" };
// Volgorde: 'volgorde' = op vraagnummer; 'slim' = fout > nog niet > juist, met toeval (deels voorrang)
function orderQuestions(all, answers, mode){
  if(mode==="volgorde") return all.slice().sort((a,b)=>a.sort_order-b.sort_order);
  const weight=q=>{ const c=answers[q.id]; if(c==null) return 2; return setEq(c,q.correct_indexes)?1:3; }; // fout=3
  return all.map(q=>({q, k: Math.random()/weight(q)}))   // hoger gewicht ⇒ kleinere sleutel ⇒ vroeger
            .sort((a,b)=>a.k-b.k).map(x=>x.q);
}
async function viewPlay(quizId){
  const { data:quiz } = await sb.from("quizzes").select("*").eq("id",quizId).single();
  if(!quiz){ app.innerHTML=`<div class="empty">Quiz niet gevonden.</div>`; return; }
  const { data:questions } = await sb.from("questions").select("*").eq("quiz_id",quizId).order("sort_order");
  PLAY.quiz=quiz; PLAY.all=questions||[]; PLAY.i=0; PLAY.answers={};
  const ids=PLAY.all.map(q=>q.id);
  if(ids.length){ const {data:mine}=await sb.from("answers").select("*").eq("user_id",ME.id).in("question_id",ids);
    (mine||[]).forEach(a=>PLAY.answers[a.question_id]=a.chosen_indexes||[]); }
  if(PLAY.pendingJump){
    const jid=PLAY.pendingJump; PLAY.pendingJump=null;
    PLAY.session={size:"alle",focus:"alle"};
    PLAY.questions=orderQuestions(PLAY.all, PLAY.answers, PLAY.mode);
    const idx=PLAY.questions.findIndex(x=>x.id===jid);
    PLAY.i=idx>=0?idx:0; renderQuestion();
  } else renderPlaySetup();
}

function poolFor(focus){
  const A=PLAY.answers;
  if(focus==="foute")       return PLAY.all.filter(q=>A[q.id]!=null && isRight(q,A[q.id])===false);
  if(focus==="onbeantwoord")return PLAY.all.filter(q=>A[q.id]==null);
  return PLAY.all.slice();
}
function renderPlaySetup(){
  const A=PLAY.answers;
  const total=PLAY.all.length;
  const wrong=PLAY.all.filter(q=>A[q.id]!=null && isRight(q,A[q.id])===false).length;
  const todo=PLAY.all.filter(q=>A[q.id]==null).length;
  app.innerHTML=`
    <a class="muted" data-nav="#/">← Quizzen</a>
    <h1 style="margin:.5rem 0">${esc(PLAY.quiz.title)}</h1>
    <p class="muted">${esc(PLAY.quiz.description||"")}</p>
    <div class="card" style="margin-top:1rem">
      <label>Aantal vragen</label>
      <div class="btnrow" id="setSize">
        <button class="chip-toggle active" data-size="25">25</button>
        <button class="chip-toggle" data-size="50">50</button>
        <button class="chip-toggle" data-size="alle">Alle (${total})</button>
      </div>
      <label style="margin-top:1rem">Welke vragen</label>
      <div class="btnrow" id="setFocus">
        <button class="chip-toggle active" data-focus="alle">Alle vragen</button>
        <button class="chip-toggle" data-focus="foute">Enkel mijn foute (${wrong})</button>
        <button class="chip-toggle" data-focus="onbeantwoord">Nog niet beantwoord (${todo})</button>
      </div>
      <label style="margin-top:1rem">Volgorde</label>
      <div class="btnrow" id="setMode">
        <button class="chip-toggle active" data-mode="slim" title="Fout beantwoorde vragen krijgen deels voorrang">Slim oefenen</button>
        <button class="chip-toggle" data-mode="volgorde">Op nummer</button>
      </div>
      <div class="btnrow" style="margin-top:1.2rem">
        <button class="btn btn-primary" id="startBtn">Start</button>
        <a class="btn btn-ghost btn-sm" data-nav="#/quiz/${PLAY.quiz.id}/overzicht">Overzicht</a>
        <a class="btn btn-ghost btn-sm" data-nav="#/quiz/${PLAY.quiz.id}/stats">Statistiek</a>
      </div>
    </div>`;
  app.querySelectorAll("[data-nav]").forEach(a=>a.onclick=()=>go(a.dataset.nav));
  let size="25", focus="alle";
  const pick=(grp,attr,set)=>app.querySelectorAll(`#${grp} [data-${attr}]`).forEach(b=>b.onclick=()=>{
    app.querySelectorAll(`#${grp} [data-${attr}]`).forEach(x=>x.classList.toggle("active",x===b)); set(b.dataset[attr]); });
  pick("setSize","size",v=>size=v);
  pick("setFocus","focus",v=>focus=v);
  pick("setMode","mode",v=>PLAY.mode=v);
  document.getElementById("startBtn").onclick=()=>startSession(size, focus);
}
function startSession(size, focus){
  PLAY.session={ size, focus };
  let pool=orderQuestions(poolFor(focus), PLAY.answers, PLAY.mode);
  if(!pool.length){ toast("Geen vragen voor deze keuze.","err"); return; }
  if(size!=="alle") pool=pool.slice(0, +size);
  PLAY.questions=pool; PLAY.i=0; renderQuestion();
}

async function renderQuestion(){
  const q=PLAY.questions[PLAY.i];
  if(!q){ app.innerHTML=`<div class="empty">Deze quiz heeft nog geen vragen.</div>`; return; }
  const chosen = PLAY.answers[q.id];            // array of undefined
  const answered = chosen!=null;
  const correct = arr(q.correct_indexes);
  const validated = q.validated!==false;
  const multi = q.multi || correct.length>1;
  const opts=(q.options||[]).map((o,i)=>{
    let cls="opt"; let box="";
    if(answered){ cls+=" disabled";
      if(validated){ if(correct.includes(i)) cls+=" correct"; else if(inSet(chosen,i)) cls+=" wrong"; }
      else if(inSet(chosen,i)) cls+=" chosen"; }
    else if(multi){ box=`<input type="checkbox" class="mopt" value="${i}" style="width:auto;margin-top:.15rem">`; }
    return `<div class="${cls}" data-opt="${i}">${box}<span class="letter">${letter(i)}</span><span>${esc(o)} ${answered&&validated&&correct.includes(i)?srcBadge("Juist antwoord",q.answer_source):""}</span></div>`;
  }).join("");
  // voortgang
  const total=PLAY.questions.length;
  const answeredN=PLAY.questions.filter(x=>PLAY.answers[x.id]!=null).length;
  const correctN=PLAY.questions.filter(x=>PLAY.answers[x.id]!=null && isRight(x,PLAY.answers[x.id])===true).length;
  const wrongN=PLAY.questions.filter(x=>PLAY.answers[x.id]!=null && isRight(x,PLAY.answers[x.id])===false).length;
  const overlegN=PLAY.questions.filter(x=>PLAY.answers[x.id]!=null && x.validated===false).length;
  const allDone=answeredN===total;
  const unanswered=PLAY.questions.filter(x=>PLAY.answers[x.id]==null).length;
  app.innerHTML=`
    <div class="spread">
      <div><a class="muted" data-nav="#/">← Quizzen</a> &nbsp;·&nbsp; <a class="muted" id="newSession">Nieuwe sessie</a> &nbsp;·&nbsp; <a class="muted" data-nav="#/quiz/${PLAY.quiz.id}/overzicht">Overzicht</a></div>
      <div class="muted">Vraag ${PLAY.i+1} / ${total}</div>
    </div>
    <h1 style="font-size:1.2rem;margin:.6rem 0 .4rem">${esc(PLAY.quiz.title)}</h1>
    <div class="progress">
      <div class="bar"><span style="width:${pct(answeredN,total)}%"></span><div class="lab">Beantwoord ${answeredN}/${total}</div></div>
      <div class="progress-legend">
        <span class="dot ok"></span> Juist: ${correctN}
        <span class="dot bad"></span> Fout: ${wrongN}
        ${overlegN?`<span class="dot warn"></span> In overleg: ${overlegN}`:""}
        <span class="dot none"></span> Nog niet: ${unanswered}
        ${allDone?`<span class="pill" style="background:var(--correct-soft);color:var(--correct)">${ICON.check} Alle vragen gezien</span>`:""}
        <span style="margin-left:auto"></span>
        <span class="muted">Volgorde:</span>
        <button class="chip-toggle ${PLAY.mode==="slim"?"active":""}" data-mode="slim" title="Fout beantwoorde vragen krijgen deels voorrang">Slim oefenen</button>
        <button class="chip-toggle ${PLAY.mode==="volgorde"?"active":""}" data-mode="volgorde">Op nummer</button>
      </div>
    </div>
    <div class="btnrow" style="margin-bottom:.8rem">
      <button class="btn btn-ghost btn-sm" id="prevBtn" ${PLAY.i===0?"disabled":""}>← Vorige</button>
      <button class="btn btn-ghost btn-sm" id="nextBtn" ${PLAY.i>=total-1?"disabled":""}>Volgende →</button>
      ${unanswered?`<button class="btn btn-primary btn-sm" id="nextUnans">Volgende onbeantwoorde →</button>`:""}
    </div>
    <div class="card">
      <div class="q-meta"><span class="q-num">Vraag ${q.qnum}</span>${questionTags(q)}${answered?(isRight(q,chosen)===true?`<span class="pill juist">juist beantwoord</span>`:isRight(q,chosen)===false?`<span class="pill fout">fout beantwoord</span>`:`<span class="pill twijfel">antwoord genoteerd — in overleg</span>`):`<span class="pill" style="background:var(--surface2);color:var(--text-muted)">nog niet beantwoord</span>`}</div>
      <div class="q-text">${esc(q.text)}</div>
      <div id="opts">${opts}</div>
      ${(multi&&!answered)?`<div class="btnrow"><button class="btn btn-primary btn-sm" id="checkMulti">Nakijken</button></div>`:""}
      <div id="afterAnswer"></div>
    </div>`;
  app.querySelectorAll("[data-nav]").forEach(a=>a.onclick=()=>go(a.dataset.nav));
  document.getElementById("prevBtn").onclick=()=>{ if(PLAY.i>0){PLAY.i--;renderQuestion();} };
  document.getElementById("nextBtn").onclick=()=>{ if(PLAY.i<total-1){PLAY.i++;renderQuestion();} };
  const nu=document.getElementById("nextUnans");
  if(nu) nu.onclick=()=>{
    let j=-1;
    for(let k=1;k<=total;k++){ const idx=(PLAY.i+k)%total; if(PLAY.answers[PLAY.questions[idx].id]==null){ j=idx; break; } }
    if(j>=0){ PLAY.i=j; renderQuestion(); } else toast("Alle vragen beantwoord","ok");
  };
  const nsBtn=document.getElementById("newSession");
  if(nsBtn) nsBtn.onclick=()=>renderPlaySetup();
  app.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>{
    if(PLAY.mode===b.dataset.mode) return;
    PLAY.mode=b.dataset.mode;
    const curId=PLAY.questions[PLAY.i].id;
    PLAY.questions=orderQuestions(PLAY.questions, PLAY.answers, PLAY.mode);
    PLAY.i=Math.max(0, PLAY.questions.findIndex(x=>x.id===curId));
    renderQuestion();
  });
  if(answered){ renderAfterAnswer(q); }
  else if(multi){
    document.getElementById("checkMulti").onclick=()=>{
      const sel=[...app.querySelectorAll(".mopt:checked")].map(c=>+c.value);
      if(!sel.length) return toast("Kruis minstens één antwoord aan","err");
      answerQuestion(q, sel);
    };
  }
  else app.querySelectorAll("[data-opt]").forEach(o=>o.onclick=()=>answerQuestion(q, [+o.dataset.opt]));
}

async function answerQuestion(q, idxArray){
  const chosen=arr(idxArray).slice().sort((a,b)=>a-b);
  const is_correct = isRight(q, chosen);   // null bij niet-gevalideerde vraag
  PLAY.answers[q.id]=chosen;
  try{
    await sb.from("answers").upsert({ question_id:q.id, user_id:ME.id, chosen_indexes:chosen, is_correct, updated_at:new Date().toISOString() },{ onConflict:"question_id,user_id" });
    await sb.from("answer_events").insert({ question_id:q.id, quiz_id:PLAY.quiz.id, user_id:ME.id, is_correct });
  }
  catch(e){ toast("Antwoord niet opgeslagen: "+e.message,"err"); }
  renderQuestion();
}

async function renderAfterAnswer(q){
  const box=document.getElementById("afterAnswer");
  box.innerHTML=`<div class="muted">Laden…</div>`;
  const [{data:flags},{data:opm},{data:edits}] = await Promise.all([
    sb.from("flags").select("*").eq("question_id",q.id).order("created_at",{ascending:false}),
    sb.from("opmerkingen").select("*").eq("question_id",q.id).order("created_at",{ascending:false}),
    sb.from("question_edits").select("*").eq("question_id",q.id).order("created_at",{ascending:false}),
  ]);
  const names = await namesFor([...(flags||[]),...(opm||[]),...(edits||[])].map(r=>r.user_id||r.edited_by));
  const correct=arr(q.correct_indexes);
  const myOpm=(opm||[]).find(o=>o.user_id===ME.id);
  // collectief beeld
  const votes=(opm||[]); const totV=votes.length;
  const dist=(q.options||[]).map((_,i)=>votes.filter(v=>inSet(v.preferred_indexes,i)).length);
  const wrongVotes=votes.filter(v=>!setEq(v.preferred_indexes,correct)).length;
  const bars=(q.options||[]).map((o,i)=>`
    <div class="spread" style="gap:.5rem"><div class="bar ${correct.includes(i)?"correct":""}" style="flex:1">
      <span style="width:${pct(dist[i],totV)}%"></span><div class="lab">${letter(i)} — ${pct(dist[i],totV)}% (${dist[i]})</div></div></div>`).join("");

  box.innerHTML=`
    ${q.validated===false?`<div class="notice">${ICON.info} <strong>Nog geen gevalideerd juist antwoord.</strong> Bekijk hieronder welk antwoord de groep verkiest, kies zelf je voorkeursantwoord en gebruik de flags om in overleg te gaan.</div>`:""}
    <div class="explain">
      <span class="lbl">Uitleg ${srcBadge("Uitleg",q.explanation_source)}</span>${html(q.explanation||"— geen uitleg —")}
      ${q.legal_basis?`<div class="legal-inline"><strong>Wettelijke basis:</strong> ${html(q.legal_basis)}</div>`:""}
      ${q.wettekst?`<details class="wettekst-d"><summary>${ICON.info} Toon wettekst</summary><div class="wettekst">${html(q.wettekst)}</div></details>`:""}
    </div>

    <details><summary>${ICON.chat} Reageer op deze vraag</summary>
      <div class="body">
        <div class="btnrow" id="reactBtns">
          <button class="chip-toggle" data-ftype="twijfel">Ik twijfel aan het antwoord</button>
          <button class="chip-toggle" data-ftype="fout">Het antwoord is fout</button>
          <button class="chip-toggle" data-ftype="juist">Het antwoord is juist</button>
        </div>
        <div id="reactPref" hidden>
          <label>Welk antwoord vind jij dan juist?</label>
          <div class="opref-list">
            ${(q.options||[]).map((o,i)=>`<label class="opref-item"><input type="checkbox" class="opref" value="${i}" ${myOpm&&inSet(myOpm.preferred_indexes,i)?"checked":""}><span><strong>${letter(i)}.</strong> ${esc(o)}</span></label>`).join("")}
          </div>
        </div>
        <div id="reactComment" hidden>
          <label id="rMotLabel">Commentaar</label>
          <textarea id="rMot" placeholder="Leg uit waarom…">${myOpm?esc(myOpm.motivatie||""):""}</textarea>
        </div>
        <div class="btnrow" id="reactSubmitRow" hidden><button class="btn btn-primary btn-sm" id="rSubmit">Versturen</button></div>
      </div></details>

    <details ${(flags&&flags.length)?"open":""}><summary>${ICON.flag} Geschiedenis: flags (${(flags||[]).length}) &amp; opmerkingen (${(opm||[]).length})</summary>
      <div class="body">
        ${totV?`<label>Collectief beeld — ${pct(wrongVotes,totV)}% verkiest een ander antwoord dan het huidige</label>${bars}<hr>`:""}
        ${(flags||[]).map(f=>`<div class="hist ${f.type}"><span class="pill ${f.type}">${f.type}</span> ${f.status==="afgehandeld"?`<span class="pill afgehandeld">afgehandeld</span>`:""} <span class="who">${esc(names[f.user_id]||"?")}</span> <span class="when">${fmtDate(f.created_at)}</span>${f.toelichting?`<div>${esc(f.toelichting)}</div>`:""}</div>`).join("")||`<p class="muted">Nog geen flags.</p>`}
        ${(opm||[]).map(o=>`<div class="hist"><span class="who">${esc(names[o.user_id]||"?")}</span> verkiest <strong>${lettersOf(o.preferred_indexes)}</strong> <span class="when">${fmtDate(o.created_at)}</span>${o.motivatie?`<div>${esc(o.motivatie)}</div>`:""}</div>`).join("")}
      </div></details>

    <details><summary>${ICON.clock} Wijzigingshistoriek (${(edits||[]).length})</summary>
      <div class="body">${(edits||[]).map(e=>`<div class="hist"><span class="who">${esc(names[e.edited_by]||"?")}</span> <span class="when">${fmtDate(e.created_at)}</span><div>${esc(e.summary)}</div></div>`).join("")||`<p class="muted">Nog geen wijzigingen.</p>`}</div></details>`;

  // reactie: flag + (bij twijfel/fout) voorkeursantwoord — één geheel
  let ftype=null;
  box.querySelectorAll("#reactBtns [data-ftype]").forEach(b=>b.onclick=()=>{
    ftype=b.dataset.ftype;
    box.querySelectorAll("#reactBtns [data-ftype]").forEach(x=>x.classList.toggle("active",x===b));
    const disagree=(ftype==="twijfel"||ftype==="fout");
    document.getElementById("reactPref").hidden=!disagree;
    document.getElementById("reactComment").hidden=false;
    document.getElementById("reactSubmitRow").hidden=false;
    document.getElementById("rMotLabel").textContent=disagree?"Waarom denk je dat?":"Commentaar (optioneel)";
    document.getElementById("rMot").placeholder=disagree?"Leg uit waarom…":"Optionele opmerking…";
  });
  const rs=document.getElementById("rSubmit");
  if(rs) rs.onclick=async()=>{
    if(!ftype) return toast("Kies eerst één van de drie opties","err");
    const mot=(document.getElementById("rMot").value||"").trim();
    const pref=[...box.querySelectorAll(".opref:checked")].map(c=>+c.value).sort((a,b)=>a-b);
    const disagree=(ftype==="twijfel"||ftype==="fout");
    if(disagree && !mot) return toast("Leg kort uit waarom","err");
    const { error:fe }=await sb.from("flags").insert({ question_id:q.id, user_id:ME.id, type:ftype, toelichting:mot });
    if(fe) return toast(fe.message,"err");
    if(pref.length){
      const { error:oe }=await sb.from("opmerkingen").upsert({ question_id:q.id, user_id:ME.id, preferred_indexes:pref, motivatie:mot, updated_at:new Date().toISOString() },{ onConflict:"question_id,user_id" });
      if(oe) return toast(oe.message,"err");
    }
    toast("Bedankt voor je reactie","ok"); renderAfterAnswer(q);
  };
}

/* haal weergavenamen op voor een set user-ids */
async function namesFor(ids){
  const uniq=[...new Set(ids.filter(Boolean))];
  if(!uniq.length) return {};
  const { data }=await sb.from("profiles").select("id,display_name").in("id",uniq);
  const m={}; (data||[]).forEach(p=>m[p.id]=p.display_name); return m;
}

/* ============================================================
   OVERZICHT per quiz — met flag-filter
   ============================================================ */
async function viewOverview(quizId){
  const { data:quiz } = await sb.from("quizzes").select("*").eq("id",quizId).single();
  const { data:questions } = await sb.from("questions").select("*").eq("quiz_id",quizId).order("sort_order");
  const ids=(questions||[]).map(q=>q.id);
  let flags=[];
  if(ids.length){ const {data}=await sb.from("flags").select("question_id,type,status").in("question_id",ids); flags=data||[]; }
  const fBy={}; flags.forEach(f=>{ (fBy[f.question_id]=fBy[f.question_id]||[]).push(f); });
  let filter="alle";
  const draw=()=>{
    const rows=(questions||[]).filter(q=>{
      const fs=fBy[q.id]||[];
      if(filter==="alle") return true;
      if(filter==="geflagd") return fs.length>0;
      if(filter==="fout") return fs.some(f=>f.type==="fout");
      if(filter==="twijfel") return fs.some(f=>f.type==="twijfel");
      if(filter==="juist") return fs.some(f=>f.type==="juist");
      if(filter==="open") return fs.some(f=>f.status==="open");
      if(filter==="nietgevalideerd") return q.validated===false;
      return true;
    }).map(q=>{
      const fs=fBy[q.id]||[]; const open=fs.filter(f=>f.status==="open").length;
      return `<tr class="row-link" data-qid="${q.id}" data-quiz="${quizId}">
        <td><span class="q-num">${q.qnum}</span></td>
        <td>${esc(q.text).slice(0,120)}${q.text.length>120?"…":""}</td>
        <td>${q.validated===false?`<span class="tag tag-warn">in overleg</span>`:`<strong>${lettersOf(q.correct_indexes)}</strong> ${srcBadge("Antwoord",q.answer_source)}`}</td>
        <td>${fs.length?`<span class="count-chip">${ICON.flag} ${fs.length}${open?` · ${open} open`:""}</span>`:`<span class="muted">—</span>`}</td>
      </tr>`;
    }).join("");
    document.getElementById("ovBody").innerHTML = rows||`<tr><td colspan="4" class="empty">Geen vragen voor dit filter.</td></tr>`;
    document.querySelectorAll("#ovBody .row-link").forEach(r=>r.onclick=()=>{ PLAY_goto(quizId, r.dataset.qid); });
    document.querySelectorAll("[data-filter]").forEach(b=>b.classList.toggle("active",b.dataset.filter===filter));
  };
  app.innerHTML=`
    <div class="spread"><h1>Overzicht — ${esc(quiz?quiz.title:"")}</h1>
      <div class="btnrow" style="margin:0">
        <button class="btn btn-ghost btn-sm" data-nav="#/quiz/${quizId}/stats">Statistiek</button>
        <button class="btn btn-ghost btn-sm" data-nav="#/quiz/${quizId}">Spelen →</button></div></div>
    <div class="filterbar" style="margin-top:1rem">
      <span class="muted">Filter:</span>
      ${[["alle","alle"],["geflagd","geflagd"],["fout","fout"],["twijfel","twijfel"],["juist","juist"],["open","open"],["nietgevalideerd","niet gevalideerd"]].map(([f,l])=>`<button class="chip-toggle" data-filter="${f}">${l}</button>`).join("")}
    </div>
    <div class="card" style="padding:.3rem .3rem">
      <table><thead><tr><th>#</th><th>Vraag</th><th>Juist</th><th>Flags</th></tr></thead><tbody id="ovBody"></tbody></table>
    </div>`;
  app.querySelectorAll("[data-nav]").forEach(a=>a.onclick=()=>go(a.dataset.nav));
  app.querySelectorAll("[data-filter]").forEach(b=>b.onclick=()=>{ filter=b.dataset.filter; draw(); });
  draw();
}
function PLAY_goto(quizId, qid){ PLAY.pendingJump=qid; go("#/quiz/"+quizId); }

/* ============================================================
   STATISTIEK — gedeelde hulpjes
   ============================================================ */
function aggregateQuestions(questions, answers, flags, opm){
  const agg={};
  (questions||[]).forEach(q=>agg[q.id]={q, played:0, correct:0, flags:0, wrongVotes:0, votes:0});
  (answers||[]).forEach(a=>{ const x=agg[a.question_id]; if(x && a.is_correct!=null){x.played++; if(a.is_correct)x.correct++;} });
  (flags||[]).forEach(f=>{ const x=agg[f.question_id]; if(x)x.flags++; });
  (opm||[]).forEach(o=>{ const x=agg[o.question_id]; if(x){x.votes++; if(!setEq(o.preferred_indexes,x.q.correct_indexes))x.wrongVotes++;} });
  return agg;
}
function mountStatsTable(mountId, agg, qtitle){
  let rows=Object.values(agg), sortKey="flags";
  const el=document.getElementById(mountId);
  el.innerHTML=`
    <div class="filterbar"><span class="muted">Sorteer:</span>
      ${[["flags","meeste flags"],["fout","hoogste % fout"],["moeilijk","moeilijkst"],["nummer","vraagnummer"]].map(([k,l])=>`<button class="chip-toggle" data-sort="${k}">${l}</button>`).join("")}</div>
    <div class="card" style="padding:.3rem"><table>
      <thead><tr><th>#</th><th>Vraag</th><th>% correct</th><th>Flags</th><th>% fout</th></tr></thead>
      <tbody></tbody></table></div>`;
  const draw=()=>{
    rows.sort((a,b)=>{
      if(sortKey==="flags") return b.flags-a.flags || b.wrongVotes-a.wrongVotes;
      if(sortKey==="fout") return pct(b.wrongVotes,b.votes)-pct(a.wrongVotes,a.votes);
      if(sortKey==="moeilijk") return pct(a.correct,a.played)-pct(b.correct,b.played);
      if(sortKey==="nummer") return a.q.qnum-b.q.qnum;
      return 0;
    });
    el.querySelector("tbody").innerHTML=rows.map(r=>`
      <tr class="row-link" data-quiz="${r.q.quiz_id}" data-qid="${r.q.id}">
        <td><span class="q-num">${r.q.qnum}</span></td>
        <td>${esc(r.q.text).slice(0,90)}…${qtitle?`<br><span class="muted" style="font-size:.72rem">${esc(qtitle[r.q.quiz_id]||"")}</span>`:""}</td>
        <td>${r.played?pct(r.correct,r.played)+"%":"—"}<br><span class="muted" style="font-size:.72rem">${r.played}×</span></td>
        <td>${r.flags?`<span class="count-chip">${r.flags}</span>`:"—"}</td>
        <td>${r.votes?pct(r.wrongVotes,r.votes)+"%":"—"}</td>
      </tr>`).join("");
    el.querySelectorAll(".row-link").forEach(t=>t.onclick=()=>PLAY_goto(t.dataset.quiz, t.dataset.qid));
    el.querySelectorAll("[data-sort]").forEach(b=>b.classList.toggle("active",b.dataset.sort===sortKey));
  };
  el.querySelectorAll("[data-sort]").forEach(b=>b.onclick=()=>{ sortKey=b.dataset.sort; draw(); });
  draw();
}
function learningBlock(myEvents, title){
  const daily=dailyAccuracy(myEvents);
  const imp=improvement(myEvents);
  const impBadge = imp ? `<span class="pill" style="background:${imp.last>=imp.first?"var(--correct-soft)":"var(--wrong-soft)"};color:${imp.last>=imp.first?"var(--correct)":"var(--wrong)"}">${imp.last>=imp.first?"▲":"▼"} ${imp.first}% → ${imp.last}%</span>` : "";
  return `<h2>${esc(title)} ${impBadge}</h2>
    <p class="muted">% juist per dag${imp?` — vergelijking eerste helft (${imp.first}%) versus tweede helft (${imp.last}%) van je antwoorden.`:"."}</p>
    <div class="card">${lineChartSVG(daily)}</div>`;
}

/* ============================================================
   STATISTIEK — algemeen (alle quizzen)
   ============================================================ */
async function viewStatsVragen(){
  const [{data:questions},{data:answers},{data:flags},{data:opm},{data:quizzes},{data:myEvents},{data:allEvents},{data:visits}] = await Promise.all([
    sb.from("questions").select("id,qnum,quiz_id,text,correct_indexes,options"),
    sb.from("answers").select("question_id,is_correct"),
    sb.from("flags").select("question_id,type"),
    sb.from("opmerkingen").select("question_id,preferred_indexes"),
    sb.from("quizzes").select("id,title,status"),
    sb.from("answer_events").select("is_correct,created_at").eq("user_id",ME.id),
    sb.from("answer_events").select("is_correct,quiz_id,user_id,created_at"),
    sb.from("visits").select("user_id,created_at"),
  ]);
  const qtitle={}; (quizzes||[]).forEach(q=>qtitle[q.id]=q.title);
  const agg=aggregateQuestions(questions, answers, flags, opm);
  // per-quiz vergelijking
  const perQuiz={}; (quizzes||[]).forEach(q=>perQuiz[q.id]={q,vragen:0,antw:0,correct:0,flags:0,spelers:new Set()});
  (questions||[]).forEach(q=>{ if(perQuiz[q.quiz_id])perQuiz[q.quiz_id].vragen++; });
  (allEvents||[]).forEach(e=>{ const x=perQuiz[e.quiz_id]; if(x){x.antw++; if(e.is_correct)x.correct++; x.spelers.add(e.user_id);} });
  (flags||[]).forEach(f=>{ const qq=(questions||[]).find(q=>q.id===f.question_id); if(qq&&perQuiz[qq.quiz_id])perQuiz[qq.quiz_id].flags++; });
  const totAntw=(allEvents||[]).length;
  const totSpelers=new Set((allEvents||[]).map(e=>e.user_id)).size;
  const myScored=scored(myEvents).length;
  const myCorrect=(myEvents||[]).filter(e=>e.is_correct===true).length;

  app.innerHTML=`
    <h1>Statistiek — algemeen</h1>
    <p class="muted">Over alle quizzen heen. Publiek zichtbaar.</p>
    <div class="kpis">
      ${kpi("Quizzen",(quizzes||[]).length)}
      ${kpi("Vragen",(questions||[]).length)}
      ${kpi("Antwoorden gegeven",totAntw)}
      ${kpi("Actieve gebruikers",totSpelers)}
      ${kpi("Bezoeken",(visits||[]).length)}
      ${kpi("Jouw % juist",myScored?pct(myCorrect,myScored)+"%":"—",myScored+" gevalideerde antwoorden")}
    </div>
    ${learningBlock(myEvents||[], "Jouw vooruitgang over tijd")}
    <h2>Bezoeken per dag</h2>
    <div class="card">${barChartSVG(dailyCounts(visits||[]),{color:"#1d3a99"})}</div>
    <h2>Antwoorden per dag</h2>
    <div class="card">${barChartSVG(dailyCounts(allEvents||[]),{color:"#2952cc"})}</div>
    <h2>Per quiz</h2>
    <div class="card" style="padding:.3rem"><table>
      <thead><tr><th>Quiz</th><th>Vragen</th><th>Antwoorden</th><th>Gem. % juist</th><th>Spelers</th><th>Flags</th><th></th></tr></thead>
      <tbody>${Object.values(perQuiz).map(x=>`<tr>
        <td>${esc(x.q.title)} ${x.q.status!=="gepubliceerd"?`<span class="badge concept">concept</span>`:""}</td>
        <td>${x.vragen}</td><td>${x.antw}</td><td>${x.antw?pct(x.correct,x.antw)+"%":"—"}</td>
        <td>${x.spelers.size}</td><td>${x.flags||"—"}</td>
        <td><a class="btn btn-ghost btn-sm" data-nav="#/quiz/${x.q.id}/stats">Details</a></td></tr>`).join("")}</tbody>
    </table></div>
    <h2>Alle vragen</h2>
    <div id="svTable"></div>`;
  app.querySelectorAll("[data-nav]").forEach(a=>a.onclick=()=>go(a.dataset.nav));
  mountStatsTable("svTable", agg, qtitle);
}

/* ============================================================
   STATISTIEK — per quiz
   ============================================================ */
async function viewQuizStats(quizId){
  const { data:quiz } = await sb.from("quizzes").select("*").eq("id",quizId).single();
  if(!quiz){ app.innerHTML=`<div class="empty">Quiz niet gevonden.</div>`; return; }
  const { data:questions } = await sb.from("questions").select("id,qnum,quiz_id,text,correct_indexes,options").eq("quiz_id",quizId).order("sort_order");
  const ids=(questions||[]).map(q=>q.id);
  const [{data:answers},{data:flags},{data:opm},{data:myEvents},{data:allEvents}] = await Promise.all([
    ids.length? sb.from("answers").select("question_id,is_correct,user_id").in("question_id",ids) : Promise.resolve({data:[]}),
    ids.length? sb.from("flags").select("question_id,type").in("question_id",ids) : Promise.resolve({data:[]}),
    ids.length? sb.from("opmerkingen").select("question_id,preferred_indexes").in("question_id",ids) : Promise.resolve({data:[]}),
    sb.from("answer_events").select("is_correct,created_at").eq("quiz_id",quizId).eq("user_id",ME.id),
    sb.from("answer_events").select("is_correct,created_at,user_id").eq("quiz_id",quizId),
  ]);
  const agg=aggregateQuestions(questions, answers, flags, opm);
  const myAnsSet=new Set((answers||[]).filter(a=>a.user_id===ME.id).map(a=>a.question_id));
  const myScoredN=(answers||[]).filter(a=>a.user_id===ME.id && a.is_correct!=null).length;
  const myCorrect=(answers||[]).filter(a=>a.user_id===ME.id && a.is_correct===true).length;
  const spelers=new Set((allEvents||[]).map(e=>e.user_id)).size;
  const hardest=Object.values(agg).filter(r=>r.played>0).sort((a,b)=>pct(a.correct,a.played)-pct(b.correct,b.played)).slice(0,8);
  const flagged=Object.values(agg).filter(r=>r.flags>0).sort((a,b)=>b.flags-a.flags).slice(0,8);
  // community daily curve
  const commDaily=dailyAccuracy(allEvents||[]);

  app.innerHTML=`
    <div class="spread"><h1>Statistiek — ${esc(quiz.title)}</h1>
      <div class="btnrow" style="margin:0">
        <button class="btn btn-ghost btn-sm" data-nav="#/quiz/${quizId}">Spelen →</button>
        <button class="btn btn-ghost btn-sm" data-nav="#/quiz/${quizId}/overzicht">Overzicht</button>
        <button class="btn btn-ghost btn-sm" data-nav="#/stats/vragen">Alle quizzen</button>
      </div></div>
    <div class="kpis">
      ${kpi("Vragen",(questions||[]).length)}
      ${kpi("Jij beantwoord",`${myAnsSet.size}/${(questions||[]).length}`, (questions||[]).length?pct(myAnsSet.size,(questions||[]).length)+"% gezien":"")}
      ${kpi("Jouw % juist",myScoredN?pct(myCorrect,myScoredN)+"%":"—")}
      ${kpi("Antwoorden (allen)",(allEvents||[]).length)}
      ${kpi("Spelers",spelers)}
    </div>
    ${learningBlock(myEvents||[], "Jouw vooruitgang op deze quiz")}
    <h2>Vooruitgang van iedereen samen</h2>
    <p class="muted">% juist per dag, alle spelers samen — zie of de groep beter wordt.</p>
    <div class="card">${lineChartSVG(commDaily,{color:"#16803d"})}</div>
    <div class="two-col">
      <div><h2>Moeilijkste vragen</h2><div class="card">${hardest.length?hardest.map(r=>`<div class="spread mini"><span><span class="q-num">${r.q.qnum}</span> ${esc(r.q.text).slice(0,60)}…</span><strong>${pct(r.correct,r.played)}%</strong></div>`).join(""):`<p class="muted">Nog geen antwoorden.</p>`}</div></div>
      <div><h2>Meest geflagd</h2><div class="card">${flagged.length?flagged.map(r=>`<div class="spread mini"><span><span class="q-num">${r.q.qnum}</span> ${esc(r.q.text).slice(0,60)}…</span><span class="count-chip">${ICON.flag} ${r.flags}</span></div>`).join(""):`<p class="muted">Nog geen flags.</p>`}</div></div>
    </div>
    <h2>Alle vragen</h2>
    <div id="qsTable"></div>`;
  app.querySelectorAll("[data-nav]").forEach(a=>a.onclick=()=>go(a.dataset.nav));
  mountStatsTable("qsTable", agg, null);
}

/* ============================================================
   STATISTIEK — gebruikers
   ============================================================ */
async function viewStatsGebruikers(){
  if(!isEditor()){ app.innerHTML=`<div class="empty">Deze pagina is enkel voor beheerders.</div>`; return; }
  const { data:profiles } = await sb.from("profiles").select("id,display_name,role,cohort");
  const { data:answers } = await sb.from("answers").select("user_id,is_correct");
  const { data:flags } = await sb.from("flags").select("user_id");
  const { data:opm } = await sb.from("opmerkingen").select("user_id");
  const { data:visits } = await sb.from("visits").select("user_id");
  const agg={}; (profiles||[]).forEach(p=>agg[p.id]={p,ans:0,correct:0,flags:0,opm:0,visits:0});
  (answers||[]).forEach(a=>{ const x=agg[a.user_id]; if(x){x.ans++; if(a.is_correct)x.correct++;} });
  (flags||[]).forEach(f=>{ const x=agg[f.user_id]; if(x)x.flags++; });
  (opm||[]).forEach(o=>{ const x=agg[o.user_id]; if(x)x.opm++; });
  (visits||[]).forEach(v=>{ const x=agg[v.user_id]; if(x)x.visits++; });
  const all=Object.values(agg);
  // cohort-overzicht
  const byCohort={}; all.forEach(r=>{ const c=r.p.cohort||"—"; (byCohort[c]=byCohort[c]||{n:0,ans:0,correct:0,visits:0}); byCohort[c].n++; byCohort[c].ans+=r.ans; byCohort[c].correct+=r.correct; byCohort[c].visits+=r.visits; });
  let filter="__alle";
  const draw=()=>{
    const rows=all.filter(r=>filter==="__alle"||(r.p.cohort||"—")===filter).sort((a,b)=>b.ans-a.ans);
    document.getElementById("guBody").innerHTML=rows.map(r=>`<tr><td>${esc(r.p.display_name)}</td><td>${esc(r.p.cohort||"—")}</td><td><span class="role ${r.p.role}">${r.p.role}</span></td>
      <td>${r.ans}</td><td>${r.ans?pct(r.correct,r.ans)+"%":"—"}</td><td>${r.visits}</td><td>${r.flags}</td><td>${r.opm}</td></tr>`).join("");
    document.querySelectorAll("[data-coh]").forEach(b=>b.classList.toggle("active",b.dataset.coh===filter));
  };
  const cohorts=["__alle",...Object.keys(byCohort).sort()];
  app.innerHTML=`
    <h1>Gebruikersstatistiek</h1>
    <p class="muted">Publiek zichtbaar.</p>
    <h2>Per oorsprong</h2>
    <div class="card" style="padding:.3rem"><table>
      <thead><tr><th>Oorsprong</th><th>Gebruikers</th><th>Antwoorden</th><th>Gem. % correct</th><th>Bezoeken</th></tr></thead>
      <tbody>${Object.keys(byCohort).sort().map(c=>`<tr><td>${esc(c)}</td><td>${byCohort[c].n}</td><td>${byCohort[c].ans}</td><td>${byCohort[c].ans?pct(byCohort[c].correct,byCohort[c].ans)+"%":"—"}</td><td>${byCohort[c].visits}</td></tr>`).join("")}</tbody>
    </table></div>
    <h2>Gebruikers</h2>
    <div class="filterbar"><span class="muted">Oorsprong:</span>${cohorts.map(c=>`<button class="chip-toggle" data-coh="${esc(c)}">${c==="__alle"?"alle":esc(c)}</button>`).join("")}</div>
    <div class="card" style="padding:.3rem"><table>
      <thead><tr><th>Naam</th><th>Oorsprong</th><th>Rol</th><th>Beantwoord</th><th>% correct</th><th>Bezoeken</th><th>Flags</th><th>Opmerkingen</th></tr></thead>
      <tbody id="guBody"></tbody></table></div>`;
  app.querySelectorAll("[data-coh]").forEach(b=>b.onclick=()=>{ filter=b.dataset.coh; draw(); });
  draw();
}

/* ============================================================
   BEHEER-dashboard
   ============================================================ */
async function viewBeheer(){
  if(!isEditor()){ app.innerHTML=`<div class="empty">Geen toegang.</div>`; return; }
  const { data:quizzes } = await sb.from("quizzes").select("*").order("created_at");
  const { data:openFlags } = await sb.from("flags").select("id,question_id,type,toelichting,created_at,user_id").eq("status","open").order("created_at",{ascending:false});
  const names=await namesFor((openFlags||[]).map(f=>f.user_id));
  // map question -> quiz voor flaglinks
  let qmap={};
  if(openFlags&&openFlags.length){ const {data:qq}=await sb.from("questions").select("id,qnum,quiz_id").in("id",[...new Set(openFlags.map(f=>f.question_id))]); (qq||[]).forEach(q=>qmap[q.id]=q); }

  app.innerHTML=`
    <div class="spread"><h1>Beheer</h1>
      <div class="btnrow" style="margin:0">
        <button class="btn btn-ghost btn-sm" id="newQuiz">+ Nieuwe quiz</button>
        <button class="btn btn-ghost btn-sm" data-nav="#/beheer/import">Quiz importeren</button>
      </div></div>

    <h2>Quizzen</h2>
    <div class="stack">${(quizzes||[]).map(q=>`
      <div class="card"><div class="spread">
        <div><strong>${esc(q.title)}</strong> <span class="badge ${q.status==="gepubliceerd"?"pub":"concept"}">${q.status}</span>
          <div class="muted">${esc(q.description||"")}</div></div>
        <div class="btnrow" style="margin:0">
          <button class="btn btn-ghost btn-sm" data-edit="${q.id}">Bewerken</button>
          <button class="btn btn-ghost btn-sm" data-pub="${q.id}" data-status="${q.status}">${q.status==="gepubliceerd"?"Terug naar concept":"Publiceren"}</button>
          <button class="btn btn-danger btn-sm" data-del="${q.id}">Verwijderen</button>
        </div></div></div>`).join("")||`<p class="muted">Nog geen quizzen.</p>`}
    </div>

    <h2>Open flags (${(openFlags||[]).length})</h2>
    <div class="stack">${(openFlags||[]).map(f=>{ const qq=qmap[f.question_id]; return `
      <div class="card"><div class="spread">
        <div><span class="pill ${f.type}">${f.type}</span> ${qq?`<a class="muted" data-nav="#/quiz/${qq.quiz_id}/overzicht">Vraag ${qq.qnum}</a>`:""} — <span class="who">${esc(names[f.user_id]||"?")}</span>
          <div>${esc(f.toelichting)}</div></div>
        <button class="btn btn-ghost btn-sm" data-resolve="${f.id}">${ICON.check} Afhandelen</button>
      </div></div>`; }).join("")||`<p class="muted">Geen open flags.</p>`}
    </div>

    ${isAdmin()?`<h2>Gebruikers &amp; rollen</h2><div id="usersBox" class="card">Laden…</div>
      <h2>Instellingen</h2><div id="settingsBox" class="card">Laden…</div>`:""}
  `;
  app.querySelectorAll("[data-nav]").forEach(a=>a.onclick=()=>go(a.dataset.nav));
  document.getElementById("newQuiz").onclick=createQuiz;
  app.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>go("#/beheer/quiz/"+b.dataset.edit));
  app.querySelectorAll("[data-pub]").forEach(b=>b.onclick=async()=>{
    const ns=b.dataset.status==="gepubliceerd"?"concept":"gepubliceerd";
    await sb.from("quizzes").update({status:ns}).eq("id",b.dataset.pub); toast("Status bijgewerkt","ok"); viewBeheer();
  });
  app.querySelectorAll("[data-del]").forEach(b=>b.onclick=async()=>{
    if(!confirm("Deze quiz en al zijn vragen verwijderen?")) return;
    await sb.from("quizzes").delete().eq("id",b.dataset.del); toast("Verwijderd","ok"); viewBeheer();
  });
  app.querySelectorAll("[data-resolve]").forEach(b=>b.onclick=async()=>{
    await sb.from("flags").update({status:"afgehandeld"}).eq("id",b.dataset.resolve); toast("Afgehandeld","ok"); viewBeheer();
  });
  if(isAdmin()){ renderUsers(); renderSettings(); }
}

async function createQuiz(){
  const title=prompt("Titel van de nieuwe quiz:"); if(!title) return;
  const { data, error }=await sb.from("quizzes").insert({ title, description:"", status:"concept", created_by:ME.id }).select().single();
  if(error) return toast(error.message,"err");
  go("#/beheer/quiz/"+data.id);
}

async function renderUsers(){
  const box=document.getElementById("usersBox");
  const { data:profiles } = await sb.from("profiles").select("*").order("created_at");
  box.innerHTML=`<table><thead><tr><th>Naam</th><th>E-mail-id</th><th>Rol</th></tr></thead><tbody>${
    (profiles||[]).map(p=>`<tr><td>${esc(p.display_name)}</td><td class="muted" style="font-size:.72rem">${p.id.slice(0,8)}…</td>
      <td><select data-role="${p.id}" ${p.id===ME.id?"disabled title='Je eigen rol'":""}>
        ${["speler","beheerder","admin"].map(r=>`<option value="${r}" ${p.role===r?"selected":""}>${r}</option>`).join("")}
      </select></td></tr>`).join("")}</tbody></table>`;
  box.querySelectorAll("[data-role]").forEach(s=>s.onchange=async()=>{
    const { error }=await sb.from("profiles").update({role:s.value}).eq("id",s.dataset.role);
    if(error) return toast(error.message,"err");
    toast("Rol bijgewerkt","ok");
  });
}

async function renderSettings(){
  const box=document.getElementById("settingsBox");
  const { data } = await sb.from("app_settings").select("*").eq("id",1).single();
  box.innerHTML=`<label style="display:flex;align-items:center;gap:.6rem;margin:0">
    <input type="checkbox" id="regOpen" style="width:auto" ${data&&data.registration_open?"checked":""}> Registratie open (nieuwe accounts toegestaan)</label>`;
  document.getElementById("regOpen").onchange=async e=>{
    const { error }=await sb.from("app_settings").update({registration_open:e.target.checked}).eq("id",1);
    if(error) return toast(error.message,"err");
    toast("Instelling opgeslagen","ok");
  };
}

/* ============================================================
   BEHEER — quiz bewerken (vragen CRUD, herkomst-toggles)
   ============================================================ */
async function viewBeheerQuiz(quizId){
  if(!isEditor()){ app.innerHTML=`<div class="empty">Geen toegang.</div>`; return; }
  const { data:quiz } = await sb.from("quizzes").select("*").eq("id",quizId).single();
  const { data:questions } = await sb.from("questions").select("*").eq("quiz_id",quizId).order("sort_order");
  app.innerHTML=`
    <a class="muted" data-nav="#/beheer">← Beheer</a>
    <div class="card" style="margin-top:.6rem">
      <label>Titel</label><input id="qzTitle" value="${esc(quiz.title)}">
      <label>Beschrijving</label><textarea id="qzDesc">${esc(quiz.description||"")}</textarea>
      <div class="btnrow"><button class="btn btn-primary btn-sm" id="saveQuiz">Quiz opslaan</button>
        <span class="badge ${quiz.status==="gepubliceerd"?"pub":"concept"}">${quiz.status}</span></div>
    </div>
    <div class="spread"><h2>Vragen (${(questions||[]).length})</h2>
      <button class="btn btn-ghost btn-sm" id="addQ">+ Vraag toevoegen</button></div>
    <input id="qSearch" placeholder="Zoek een vraag — op nummer of tekst…" style="margin-bottom:.6rem">
    <div class="muted" id="qSearchInfo" style="margin-bottom:.6rem;display:none"></div>
    <div class="stack" id="qList"></div>`;
  app.querySelectorAll("[data-nav]").forEach(a=>a.onclick=()=>go(a.dataset.nav));
  document.getElementById("saveQuiz").onclick=async()=>{
    await sb.from("quizzes").update({ title:document.getElementById("qzTitle").value, description:document.getElementById("qzDesc").value }).eq("id",quizId);
    toast("Opgeslagen","ok");
  };
  document.getElementById("addQ").onclick=async()=>{
    const { data, error }=await sb.from("questions").insert({ quiz_id:quizId, text:"Nieuwe vraag", options:["Optie A","Optie B"], correct_indexes:[0] }).select().single();
    if(error) return toast(error.message,"err");
    viewBeheerQuiz(quizId);
  };
  const list=document.getElementById("qList");
  list.innerHTML=(questions||[]).map(q=>questionEditor(q)).join("")||`<p class="muted">Nog geen vragen.</p>`;
  (questions||[]).forEach(q=>wireQuestionEditor(q, quizId));
  document.getElementById("qSearch").oninput=e=>{
    const s=e.target.value.trim().toLowerCase();
    let n=0;
    (questions||[]).forEach(q=>{
      const card=document.querySelector(`[data-qcard="${q.id}"]`); if(!card) return;
      const hit = !s || String(q.qnum)===s || String(q.qnum).includes(s) || (q.text||"").toLowerCase().includes(s);
      card.style.display = hit?"":"none"; if(hit)n++;
    });
    const info=document.getElementById("qSearchInfo");
    info.style.display = s?"":"none"; info.textContent = s?`${n} vraag/vragen gevonden`:"";
  };
}

function srcToggle(id, val){
  return `<div class="btnrow" style="margin:.2rem 0 0">
    <button type="button" class="chip-toggle ${val==="mens"?"active":""}" data-src="${id}" data-val="mens">${ICON.person} mens</button>
    <button type="button" class="chip-toggle ${val==="ai"?"active":""}" data-src="${id}" data-val="ai">${ICON.robot} AI</button></div>`;
}
function questionEditor(q){
  const corr=arr(q.correct_indexes);
  return `<div class="card" data-qcard="${q.id}">
    <div class="spread"><span class="q-num">Vraag ${q.qnum}</span>
      <button class="btn btn-danger btn-sm" data-delq="${q.id}">Verwijderen</button></div>
    <label>Vraagtekst</label><textarea data-f="text" data-q="${q.id}">${esc(q.text)}</textarea>
    <label style="display:flex;align-items:center;gap:.5rem;font-weight:400"><input type="checkbox" data-valid="${q.id}" style="width:auto" ${q.validated!==false?"checked":""}> Gevalideerd juist antwoord ${infoTip("Uit = er is nog geen officieel juist antwoord; de groep bepaalt het via opmerkingen en flags. De vraag krijgt dan de tag 'Niet gevalideerd'.")}</label>
    <label style="display:flex;align-items:center;gap:.5rem;font-weight:400"><input type="checkbox" data-multi="${q.id}" style="width:auto" ${q.multi?"checked":""}> Meerkeuze (meerdere juiste antwoorden)</label>
    <label>Antwoordopties — vink de juiste aan (mag leeg blijven als niet gevalideerd)</label>
    <div data-opts="${q.id}">${(q.options||[]).map((o,i)=>`
      <div class="spread optrow" style="gap:.5rem;margin:.2rem 0">
        <input type="checkbox" class="corr" data-q="${q.id}" value="${i}" ${corr.includes(i)?"checked":""} style="width:auto">
        <input data-opt="${q.id}" value="${esc(o)}" style="flex:1">
        <button class="btn btn-ghost btn-sm" data-rmopt="${q.id}">×</button>
      </div>`).join("")}</div>
    <button class="btn btn-ghost btn-sm" data-addopt="${q.id}">+ optie</button>
    <label>Herkomst juist antwoord</label>${srcToggle("as-"+q.id, q.answer_source)}
    <label>Wettelijke basis</label><textarea data-f="legal_basis" data-q="${q.id}">${esc(q.legal_basis||"")}</textarea>
    <label>Wettekst (volledige artikels, uitklapbaar bij de vraag)</label><textarea data-f="wettekst" data-q="${q.id}">${esc(q.wettekst||"")}</textarea>
    <label>Uitleg</label><textarea data-f="explanation" data-q="${q.id}">${esc(q.explanation||"")}</textarea>
    <label>Herkomst uitleg</label>${srcToggle("es-"+q.id, q.explanation_source)}
    <div class="btnrow"><button class="btn btn-primary btn-sm" data-saveq="${q.id}">Vraag opslaan</button></div>
  </div>`;
}
function wireQuestionEditor(q, quizId){
  const card=document.querySelector(`[data-qcard="${q.id}"]`);
  const srcVals={ answer_source:q.answer_source, explanation_source:q.explanation_source };
  card.querySelectorAll("[data-src]").forEach(b=>b.onclick=()=>{
    const grp=b.dataset.src; card.querySelectorAll(`[data-src="${grp}"]`).forEach(x=>x.classList.toggle("active",x===b));
    if(grp.startsWith("as-")) srcVals.answer_source=b.dataset.val; else srcVals.explanation_source=b.dataset.val;
  });
  const addRm=el=>{ el.querySelector("[data-rmopt]").onclick=()=>el.remove(); };
  card.querySelector(`[data-addopt="${q.id}"]`).onclick=()=>{
    const wrap=card.querySelector(`[data-opts="${q.id}"]`);
    const div=document.createElement("div"); div.className="spread optrow"; div.style="gap:.5rem;margin:.2rem 0";
    div.innerHTML=`<input type="checkbox" class="corr" data-q="${q.id}" style="width:auto"><input data-opt="${q.id}" value="" style="flex:1"><button class="btn btn-ghost btn-sm" data-rmopt="${q.id}">×</button>`;
    wrap.appendChild(div); addRm(div);
  };
  card.querySelectorAll(`[data-opts="${q.id}"] .optrow`).forEach(addRm);
  card.querySelector(`[data-delq="${q.id}"]`).onclick=async()=>{
    if(!confirm("Vraag verwijderen?")) return;
    await sb.from("questions").delete().eq("id",q.id); toast("Verwijderd","ok"); viewBeheerQuiz(quizId);
  };
  card.querySelector(`[data-saveq="${q.id}"]`).onclick=async()=>{
    const text=card.querySelector(`[data-f="text"][data-q="${q.id}"]`).value.trim();
    const rows=[...card.querySelectorAll(`[data-opts="${q.id}"] .optrow`)];
    const opts=[]; const correct=[];
    rows.forEach(r=>{ const v=r.querySelector(`[data-opt="${q.id}"]`).value.trim(); if(!v) return;
      const idx=opts.length; opts.push(v); if(r.querySelector(".corr").checked) correct.push(idx); });
    if(opts.length<2) return toast("Minstens 2 opties","err");
    const validated=card.querySelector(`[data-valid="${q.id}"]`).checked;
    if(validated && !correct.length) return toast("Vink een juist antwoord aan, of zet 'Gevalideerd' uit.","err");
    const multi=card.querySelector(`[data-multi="${q.id}"]`).checked || correct.length>1;
    const payload={ text, options:opts, correct_indexes:correct, multi, validated,
      legal_basis:card.querySelector(`[data-f="legal_basis"][data-q="${q.id}"]`).value,
      wettekst:card.querySelector(`[data-f="wettekst"][data-q="${q.id}"]`).value,
      explanation:card.querySelector(`[data-f="explanation"][data-q="${q.id}"]`).value,
      answer_source:srcVals.answer_source, explanation_source:srcVals.explanation_source };
    const { error }=await sb.from("questions").update(payload).eq("id",q.id);
    if(error) return toast(error.message,"err");
    toast("Vraag opgeslagen (wijzigingen gelogd)","ok");
  };
}

/* ============================================================
   IMPORT via Markdown
   ============================================================ */
function parseQuizMarkdown(text){
  text=text.replace(/<!--[\s\S]*?-->/g,"");           // commentaar weg
  const lines=text.split(/\r?\n/);
  let title="", desc=""; const questions=[]; const errors=[];
  let cur=null, field=null;
  const push=()=>{ if(cur){ questions.push(cur); cur=null; } };
  for(let raw of lines){
    const line=raw.trim();
    if(/^#\s*Titel:/i.test(line)){ title=line.replace(/^#\s*Titel:/i,"").trim(); continue; }
    if(/^#\s+/.test(line)&&!title){ title=line.replace(/^#+\s*/,"").trim(); continue; }
    if(/^Beschrijving:/i.test(line)){ desc=line.replace(/^Beschrijving:/i,"").trim(); continue; }
    if(/^##\s*/.test(line)){ push(); cur={ text:"", options:[], correct_indexes:[], legal_basis:"", wettekst:"", explanation:"", source:"mens", validated:true }; field="text"; continue; }
    if(!cur) continue;
    let m;
    if((m=line.match(/^-\s*\[( |x|X)\]\s*(.+)$/))){ if(m[1].toLowerCase()==="x") cur.correct_indexes.push(cur.options.length); cur.options.push(m[2].trim()); field="opt"; continue; }
    if(/^\*\*Wettelijke basis:\*\*/i.test(line)){ cur.legal_basis=line.replace(/^\*\*Wettelijke basis:\*\*/i,"").trim(); field="legal"; continue; }
    if(/^\*\*Wettekst:\*\*/i.test(line)){ cur.wettekst=line.replace(/^\*\*Wettekst:\*\*/i,"").trim(); field="wettekst"; continue; }
    if(/^\*\*Uitleg:\*\*/i.test(line)){ cur.explanation=line.replace(/^\*\*Uitleg:\*\*/i,"").trim(); field="uitleg"; continue; }
    if(/^\*\*Bron:\*\*/i.test(line)){ cur.source=/ai|robot/i.test(line)?"ai":"mens"; field=null; continue; }
    if(/^\*\*Gevalideerd:\*\*/i.test(line)){ cur.validated=!/nee|neen|geen|no|uit|false/i.test(line); field=null; continue; }
    if(line===""){ continue; }
    // vervolgtekst bij het lopende veld
    if(field==="text") cur.text=(cur.text?cur.text+" ":"")+line;
    else if(field==="legal") cur.legal_basis+=" "+line;
    else if(field==="wettekst") cur.wettekst+=" "+line;
    else if(field==="uitleg") cur.explanation+=" "+line;
  }
  push();
  questions.forEach((q,i)=>{
    if(!q.text) errors.push(`Vraag ${i+1}: geen vraagtekst.`);
    if(q.options.length<2) errors.push(`Vraag ${i+1}: minder dan 2 opties.`);
    if(!q.correct_indexes.length) q.validated=false;   // geen [x] ⇒ niet gevalideerd
    q.multi=q.correct_indexes.length>1;
  });
  if(!title) errors.push("Geen titel gevonden (# Titel: ...).");
  if(!questions.length) errors.push("Geen vragen gevonden (## Vraag ...).");
  return { title, desc, questions, errors };
}

async function viewImport(){
  if(!isEditor()){ app.innerHTML=`<div class="empty">Geen toegang.</div>`; return; }
  app.innerHTML=`
    <a class="muted" data-nav="#/beheer">← Beheer</a>
    <h1>Quiz importeren</h1>
    <p class="muted">Plak een ingevuld Markdown-sjabloon of kies een <code>.md</code>-bestand. <a href="quiz-sjabloon.md" download>Leeg sjabloon downloaden</a>.</p>
    <div class="card">
      <input type="file" id="mdFile" accept=".md,text/markdown,text/plain" style="margin-bottom:.6rem">
      <textarea id="mdText" style="min-height:220px" placeholder="…of plak hier de inhoud van je sjabloon"></textarea>
      <label style="display:flex;align-items:center;gap:.5rem;margin-top:.6rem"><input type="checkbox" id="aiAll" style="width:auto"> Deze hele import is door AI gegenereerd (herkomst = AI, tenzij een vraag zelf <code>**Bron:** mens</code> vermeldt)</label>
      <div class="btnrow"><button class="btn btn-ghost btn-sm" id="previewBtn">Voorbeeld</button>
        <button class="btn btn-primary btn-sm" id="importBtn">Importeren als concept</button></div>
    </div>
    <div id="importStatus" class="muted" style="margin-top:.6rem"></div>
    <div id="importPreview"></div>`;
  app.querySelectorAll("[data-nav]").forEach(a=>a.onclick=()=>go(a.dataset.nav));
  const status=m=>{ document.getElementById("importStatus").textContent=m||""; };
  document.getElementById("mdFile").onchange=async e=>{
    const f=e.target.files[0]; if(f){ document.getElementById("mdText").value=await f.text(); showPreview(); }
  };
  const showPreview=()=>{
    const parsed=parseQuizMarkdown(document.getElementById("mdText").value);
    const box=document.getElementById("importPreview");
    box.innerHTML=`<div class="card">
      ${parsed.errors.length?`<div style="color:var(--wrong)"><strong>Aandachtspunten:</strong><ul>${parsed.errors.map(e=>`<li>${esc(e)}</li>`).join("")}</ul></div>`:`<p style="color:var(--correct)">${ICON.check} Geen fouten gevonden.</p>`}
      <p><strong>${esc(parsed.title||"(geen titel)")}</strong> — ${parsed.questions.length} vragen</p>
      ${parsed.questions.filter(q=>!q.validated).length?`<p class="muted">${parsed.questions.filter(q=>!q.validated).length} vraag/vragen zonder aangeduid juist antwoord → komen binnen als <strong>niet gevalideerd</strong>.</p>`:""}
      <ol>${parsed.questions.slice(0,8).map(q=>`<li>${esc(q.text).slice(0,80)}… <span class="muted">(juist: ${q.validated?lettersOf(q.correct_indexes):"in overleg"}${q.multi?" · meerkeuze":""})</span></li>`).join("")}</ol>
      ${parsed.questions.length>8?`<p class="muted">…en ${parsed.questions.length-8} meer.</p>`:""}
    </div>`;
    return parsed;
  };
  document.getElementById("previewBtn").onclick=showPreview;
  document.getElementById("importBtn").onclick=async()=>{
    const btn=document.getElementById("importBtn");
    const parsed=parseQuizMarkdown(document.getElementById("mdText").value);
    showPreview();
    if(!parsed.title || !parsed.questions.length){ toast("Niets te importeren — controleer het bestand.","err"); return; }
    if(parsed.errors.length){ toast("Los eerst de aandachtspunten op.","err"); return; }
    btn.disabled=true;
    try{
      const aiAll=document.getElementById("aiAll").checked;
      status("Quiz aanmaken…");
      const { data:quiz, error }=await sb.from("quizzes").insert({ title:parsed.title, description:parsed.desc, status:"concept", created_by:ME.id }).select().single();
      if(error) throw error;
      const rows=parsed.questions.map((q,i)=>{
        const src = q.source==="ai" ? "ai" : (aiAll ? "ai" : "mens");
        return { quiz_id:quiz.id, sort_order:i+1, text:q.text, options:q.options, correct_indexes:q.correct_indexes, multi:!!q.multi, validated:q.validated!==false,
          legal_basis:q.legal_basis, wettekst:q.wettekst, explanation:q.explanation, answer_source:src, explanation_source:src };
      });
      const CHUNK=40;
      for(let i=0;i<rows.length;i+=CHUNK){
        status(`Vragen wegschrijven… ${Math.min(i+CHUNK,rows.length)}/${rows.length}`);
        const { error:e2 }=await sb.from("questions").insert(rows.slice(i,i+CHUNK));
        if(e2) throw e2;
      }
      status("");
      toast(`Geïmporteerd: ${rows.length} vragen (concept)`,"ok");
      go("#/beheer/quiz/"+quiz.id);
    }catch(err){
      status("");
      toast("Import mislukt: "+(err.message||err),"err");
      btn.disabled=false;
    }
  };
}

/* ============================================================
   BOOT
   ============================================================ */
let visitLogged=false;
async function boot(){
  if(!sb){ document.getElementById("appHeader").hidden=true; route(); return; }
  await loadProfile();
  if(ME && !visitLogged){ visitLogged=true; sb.from("visits").insert({ user_id:ME.id }).then(()=>{},()=>{}); }
  if(ME) renderHeader();
  route();
}
if(sb){ sb.auth.onAuthStateChange((_e,_s)=>{ /* sessiewissels */ }); }
boot();
