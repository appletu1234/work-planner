import { useState, useMemo, useEffect, useCallback } from "react";
import { loadData, saveData } from "./supabase.js";

const PAL = {
  purple:{ light:"#EDF3EF", mid:"#B5CFC0", dark:"#2D4A36", accent:"#7A9E87" },
  teal:  { light:"#EBF0EE", mid:"#8FA89A", dark:"#1E3830", accent:"#5A8A76" },
  coral: { light:"#F7F0E6", mid:"#D4B896", dark:"#6B4F2A", accent:"#C4A882" },
  blue:  { light:"#EEF0F7", mid:"#B0B8D4", dark:"#2A3060", accent:"#6A7AB0" },
  amber: { light:"#F5F0E6", mid:"#C4B090", dark:"#40300E", accent:"#A08050" },
  pink:  { light:"#F7EDEB", mid:"#D4A89A", dark:"#4A2820", accent:"#C4897A" },
};
const CKEYS = Object.keys(PAL);
const PRI = {
  high:{ bg:"#FDF0EE", text:"#8A2A1E", label:"緊急", emoji:"🔥", bar:"#C4897A" },
  mid: { bg:"#F7F0E6", text:"#6B4A1E", label:"優先", emoji:"⚡", bar:"#C4A882" },
  low: { bg:"#EDF3EF", text:"#2D4A36", label:"一般", emoji:"🌿", bar:"#7A9E87" },
};
const MONTHS = ["一月","二月","三月","四月","五月","六月","七月","八月","九月","十月","十一月","十二月"];
const WDAYS  = ["日","一","二","三","四","五","六"];
const EVT_TYPES = {
  task:    { label:"任務截止", emoji:"📋", bg:"#EDF3EF", border:"#B5CFC0", text:"#2D4A36" },
  school:  { label:"學校行事", emoji:"🏫", bg:"#EEF0F7", border:"#B0B8D4", text:"#2A3060" },
  meeting: { label:"會議活動", emoji:"📌", bg:"#F7F0E6", border:"#D4B896", text:"#6B4F2A" },
  remind:  { label:"個人提醒", emoji:"🔔", bg:"#F5F0E6", border:"#C4B090", text:"#40300E" },
};

function daysUntil(d){ return d ? Math.ceil((new Date(d)-new Date())/86400000) : 999; }
function getPri(t){ const d=daysUntil(t.due); return d<=3?"high":d<=7?"mid":"low"; }

const initProjects = [
  { id:1, name:"畢業旅行", color:"purple", archived:false, tasks:[
    { id:11, name:"調查住宿資料", due:"2026-04-10", est:2, note:"需要比較至少三間旅館", done:false },
    { id:12, name:"Key 打名單",   due:"2026-04-12", est:1, note:"", done:false },
    { id:13, name:"製作分房表",   due:"2026-04-15", est:3, note:"參考去年的分房邏輯", done:false },
  ]},
  { id:2, name:"行政作業", color:"teal", archived:false, tasks:[
    { id:21, name:"整理公文",   due:"2026-04-05", est:1, note:"", done:false },
    { id:22, name:"繳交月報表", due:"2026-04-08", est:2, note:"", done:true  },
  ]},
];
const initPocket = [
  { id:101, name:"確認場地預約",      tag:"todo",  note:"",            createdAt:"今天" },
  { id:201, name:"國教署創新教學計畫", tag:"watch", note:"截止日不確定", createdAt:"本週" },
];
const initEvents = {
  "2026-04-10":[{ id:1, title:"調查住宿資料截止", type:"task" }],
  "2026-04-15":[{ id:2, title:"製作分房表截止",   type:"task" }],
  "2026-04-01":[{ id:3, title:"四月份班會",        type:"meeting" }],
  "2026-04-05":[{ id:4, title:"清明節放假",        type:"school" }],
};

const TABS = [
  { key:"今日",    emoji:"☀️" },
  { key:"月曆",    emoji:"🗓️" },
  { key:"專案",    emoji:"📋" },
  { key:"收集箱",  emoji:"🧺" },
  { key:"小結",    emoji:"✨" },
];

const Deco = () => (
  <svg viewBox="0 0 420 90" style={{position:"absolute",top:0,left:0,width:"100%",pointerEvents:"none",zIndex:0}} preserveAspectRatio="none">
    <ellipse cx="60"  cy="30" rx="55" ry="28" fill="#EEEDFE" opacity=".7"/>
    <ellipse cx="360" cy="20" rx="70" ry="30" fill="#E1F5EE" opacity=".7"/>
    <ellipse cx="210" cy="60" rx="90" ry="22" fill="#FBEAF0" opacity=".5"/>
    <circle cx="20"  cy="75" r="10" fill="#FAEEDA" opacity=".8"/>
    <circle cx="400" cy="70" r="14" fill="#E6F1FB" opacity=".8"/>
    <circle cx="310" cy="10" r="7"  fill="#FAECE7" opacity=".9"/>
  </svg>
);

export default function App() {
  const [tab, setTab]           = useState("今日");
  const [projects, setProjects] = useState(initProjects);
  const [selId, setSelId]       = useState(1);
  const [pocket, setPocket]     = useState(initPocket);
  const [events, setEvents]     = useState(initEvents);
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [dbLoading, setDbLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState(null);

  const today = new Date();
  const [calYear,  setCalYear]  = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selDay,   setSelDay]   = useState(null);
  const [evtInput, setEvtInput] = useState("");
  const [evtType,  setEvtType]  = useState("remind");
  const [popupPos, setPopupPos] = useState({x:0,y:0});

  const [showPF,     setShowPF]     = useState(false);
  const [editProj,   setEditProj]   = useState(null);
  const [pForm,      setPForm]      = useState({name:"",color:"purple"});
  const [confirmDel, setConfirmDel] = useState(null);
  const [showTF,     setShowTF]     = useState(false);
  const [newTask,    setNewTask]     = useState({name:"",due:"",est:"",note:"",syncCal:false});
  const [editTask,   setEditTask]   = useState(null);
  const [editForm,   setEditForm]   = useState({name:"",due:"",est:"",note:""});
  const [expandedTask, setExpandedTask] = useState(null);
  const [showPF2,    setShowPF2]    = useState(false);
  const [pocketForm, setPocketForm] = useState({name:"",tag:"todo",note:""});

  useEffect(()=>{
    loadData().then(data=>{
      if(data){
        if(data.projects?.length) setProjects(data.projects);
        if(data.pocket?.length)   setPocket(data.pocket);
        if(Object.keys(data.events||{}).length) setEvents(data.events);
      }
      setDbLoading(false);
    });
  },[]);

  const save = useCallback(async(p,pk,ev)=>{
    setSaveStatus("saving");
    try{
      await saveData(p,pk,ev);
      setSaveStatus("saved");
      setTimeout(()=>setSaveStatus(null),2000);
    }catch{
      setSaveStatus("error");
    }
  },[]);

  useEffect(()=>{
    if(dbLoading) return;
    const t = setTimeout(()=>save(projects,pocket,events),800);
    return ()=>clearTimeout(t);
  },[projects,pocket,events,dbLoading]);

  const project = projects.find(p=>p.id===selId);
  const activeProjects = projects.filter(p=>!p.archived);
  const archivedProjects = projects.filter(p=>p.archived);
  const todayTasks = useMemo(()=>{
    const res=[];
    projects.filter(p=>!p.archived).forEach(p=>{
      p.tasks.filter(t=>!t.done&&daysUntil(t.due)<=7).forEach(t=>{
        res.push({...t,projectName:p.name,projectColor:p.color,projectId:p.id});
      });
    });
    return res.sort((a,b)=>daysUntil(a.due)-daysUntil(b.due));
  },[projects]);
  const allPending = useMemo(()=>{
    const res=[];
    projects.filter(p=>!p.archived).forEach(p=>p.tasks.filter(t=>!t.done).forEach(t=>res.push(t)));
    return res;
  },[projects]);

  function openNewP(){ setEditProj(null); setPForm({name:"",color:"purple"}); setShowPF(true); }
  function openEditP(p,e){ e.stopPropagation(); setEditProj(p); setPForm({name:p.name,color:p.color}); setShowPF(true); }
  function saveP(){
    if(!pForm.name.trim()) return;
    if(editProj) setProjects(projects.map(p=>p.id===editProj.id?{...p,name:pForm.name.trim(),color:pForm.color}:p));
    else{ const np={id:Date.now(),name:pForm.name.trim(),color:pForm.color,archived:false,tasks:[]}; setProjects(prev=>[...prev,np]); setSelId(np.id); setTab("專案"); }
    setShowPF(false);
  }
  function archiveProject(id){ setProjects(projects.map(p=>p.id===id?{...p,archived:true}:p)); if(selId===id) setSelId(activeProjects.find(p=>p.id!==id)?.id||null); }
  function unarchiveProject(id){ setProjects(projects.map(p=>p.id===id?{...p,archived:false}:p)); }
  function delP(){ setProjects(projects.filter(p=>p.id!==confirmDel)); if(selId===confirmDel) setSelId(activeProjects.find(p=>p.id!==confirmDel)?.id||null); setConfirmDel(null); }

  function addTask(){
    if(!newTask.name.trim()) return;
    const t={id:Date.now(),name:newTask.name.trim(),due:newTask.due,est:parseFloat(newTask.est)||1,note:newTask.note.trim(),done:false};
    setProjects(projects.map(p=>p.id===selId?{...p,tasks:[...p.tasks,t]}:p));
    if(newTask.syncCal&&newTask.due) setEvents(prev=>({...prev,[newTask.due]:[...(prev[newTask.due]||[]),{id:Date.now(),title:t.name,type:"task"}]}));
    setNewTask({name:"",due:"",est:"",note:"",syncCal:false}); setShowTF(false);
  }
  function toggleT(pid,tid){ setProjects(projects.map(p=>p.id===pid?{...p,tasks:p.tasks.map(t=>t.id===tid?{...t,done:!t.done}:t)}:p)); }
  function delT(pid,tid){ setProjects(projects.map(p=>p.id===pid?{...p,tasks:p.tasks.filter(t=>t.id!==tid)}:p)); }
  function openEditT(t,e){ e.stopPropagation(); setEditTask(t); setEditForm({name:t.name,due:t.due,est:t.est,note:t.note||""}); }
  function saveEditT(){
    if(!editForm.name.trim()) return;
    setProjects(projects.map(p=>p.id===selId?{...p,tasks:p.tasks.map(t=>t.id===editTask.id?{...t,...editForm,name:editForm.name.trim(),est:parseFloat(editForm.est)||1}:t)}:p));
    setEditTask(null);
  }

  function fmtDay(d){ return `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`; }
  function addEvent(){ if(!evtInput.trim()||!selDay) return; setEvents(prev=>({...prev,[selDay]:[...(prev[selDay]||[]),{id:Date.now(),title:evtInput.trim(),type:evtType}]})); setEvtInput(""); }
  function delEvent(day,id){ setEvents(prev=>({...prev,[day]:(prev[day]||[]).filter(e=>e.id!==id)})); }
  function openDayPopup(key,e){ const rect=e.currentTarget.getBoundingClientRect(); const cr=e.currentTarget.closest(".cal-grid-wrap").getBoundingClientRect(); setPopupPos({x:Math.min(rect.left-cr.left,cr.width-250),y:rect.bottom-cr.top+6}); setSelDay(selDay===key?null:key); setEvtInput(""); }

  function addPocket(){ if(!pocketForm.name.trim()) return; setPocket([...pocket,{id:Date.now(),...pocketForm,name:pocketForm.name.trim(),createdAt:"今天"}]); setPocketForm({name:"",tag:"todo",note:""}); setShowPF2(false); }
  function movePocket(item,pid){ setProjects(projects.map(p=>p.id===pid?{...p,tasks:[...p.tasks,{id:Date.now(),name:item.name,due:"",est:1,note:item.note||"",done:false}]}:p)); setPocket(pocket.filter(x=>x.id!==item.id)); setTab("專案"); setSelId(pid); }

  async function runAI(type){
    setAiLoading(true); setAiResult(null);
    const done=[],pending=[];
    projects.filter(p=>!p.archived).forEach(p=>p.tasks.forEach(t=>(t.done?done:pending).push(`[${p.name}] ${t.name}（截止：${t.due||"未定"}，預估${t.est}hr）`)));
    const prompt=type==="summary"
      ?`你是工作效率助理。今日：\n完成：${done.join("\n")||"無"}\n未完：${pending.join("\n")||"無"}\n收集箱：${pocket.map(x=>`- ${x.name}（${x.tag==="watch"?"觀望":"待分類"}）`).join("\n")||"無"}\n\n請用繁體中文輸出：\n【今日回顧】（2句）\n\n【明日優先】\n1.\n2.\n3.\n\n【收集箱建議】`
      :`你是工作效率助理。未完成任務：\n${pending.join("\n")||"無任務"}\n\n請用繁體中文輸出：\n【AI 排程建議】\n1.（原因：）\n2.\n\n【今日建議先做】`;
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:prompt}]})});
      const data=await res.json();
      setAiResult(data.content?.map(b=>b.text||"").join("")||"（無法取得回應）");
    }catch{ setAiResult("連線失敗，請稍後再試。"); }
    setAiLoading(false);
    if(type==="summary") setTab("小結");
  }

  const inp={width:"100%",padding:"8px 12px",fontSize:13,borderRadius:10,border:"1.5px solid #E2DDD6",background:"#fff",color:"#3A3530",boxSizing:"border-box",outline:"none",fontFamily:"inherit"};
  const card={background:"#fff",borderRadius:20,border:"1px solid #E8E4DC",padding:"16px"};
  const {first,total}=(()=>{ const f=new Date(calYear,calMonth,1).getDay(),t=new Date(calYear,calMonth+1,0).getDate(); return{first:f,total:t}; })();

  function TaskCard({t,pid,pColor,pName,showProject=false}){
    const pri=getPri(t),pv=PRI[pri],d=daysUntil(t.due);
    const isExp=expandedTask===t.id;
    return(
      <div style={{borderRadius:14,border:`1.5px solid ${t.done?"#e8e4f5":pri==="high"?"#F7C1C1":pri==="mid"?"#FAC775":"#e0d9f5"}`,background:t.done?"#faf8ff":"#fff",marginBottom:6,overflow:"hidden"}}>
        <div style={{display:"flex"}}>
          {!t.done&&<div style={{width:3,background:pv.bar,flexShrink:0,borderRadius:"14px 0 0 14px"}}/>}
          <div style={{flex:1,display:"flex",alignItems:"center",gap:10,padding:"11px 12px",cursor:"pointer"}} onClick={()=>setExpandedTask(isExp?null:t.id)}>
            <input type="checkbox" checked={t.done} onChange={e=>{e.stopPropagation();toggleT(pid,t.id);}} style={{width:16,height:16,cursor:"pointer",flexShrink:0}} onClick={e=>e.stopPropagation()}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                <span style={{fontSize:13,fontWeight:500,color:"#2a2060",textDecoration:t.done?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:180}}>{t.name}</span>
                {showProject&&<span style={{fontSize:10,background:PAL[pColor]?.light,color:PAL[pColor]?.accent,borderRadius:6,padding:"1px 6px",border:`1px solid ${PAL[pColor]?.mid}`,flexShrink:0}}>{pName}</span>}
              </div>
              <div style={{fontSize:11,color:"#9a88cc",marginTop:3,display:"flex",gap:10,flexWrap:"wrap"}}>
                {t.due&&<span style={{color:d<0?"#E24B4A":d<=3?"#854F0B":"#9a88cc"}}>{t.due} · {d>=0?`剩 ${d} 天`:`⚠️ 逾期 ${Math.abs(d)} 天`}</span>}
                {t.est&&<span>{t.est} hr</span>}
              </div>
            </div>
            {!t.done&&<span style={{fontSize:11,fontWeight:500,background:pv.bg,color:pv.text,borderRadius:8,padding:"3px 7px",flexShrink:0}}>{pv.emoji} {pv.label}</span>}
            <button onClick={e=>openEditT(t,e)} style={{background:"#f0eeff",border:"1px solid #c4b5f0",cursor:"pointer",color:"#534AB7",fontSize:11,padding:"3px 7px",borderRadius:7,flexShrink:0}}>✎</button>
            <button onClick={e=>{e.stopPropagation();delT(pid,t.id);}} style={{background:"none",border:"none",cursor:"pointer",color:"#c4b5f0",fontSize:16,padding:"0 2px",flexShrink:0}}>×</button>
          </div>
        </div>
        {isExp&&(
          <div style={{padding:"0 14px 10px 28px",fontSize:12,color:t.note?"#7a6aaa":"#c4b5f0",lineHeight:1.6,borderTop:"1px dashed #e8e4f5",paddingTop:8}}>
            {t.note?`📝 ${t.note}`:"（無備註）"}
          </div>
        )}
      </div>
    );
  }

  if(dbLoading) return(
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:400,flexDirection:"column",gap:14,fontFamily:"var(--font-sans)"}}>
      <div style={{width:20,height:20,borderRadius:"50%",border:"2.5px solid #7A9E87",borderTopColor:"transparent",animation:"spin 0.8s linear infinite"}}/>
      <div style={{fontSize:13,color:"#9A9088"}}>載入資料中...</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return(
    <div style={{fontFamily:"var(--font-sans)",    background:"#F7F5F0",minHeight:600,padding:"1.25rem 1rem"}}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pop{0%{transform:scale(0.92);opacity:0}100%{transform:scale(1);opacity:1}}
        .proj-row:hover .pact{opacity:1!important}
        .tab-btn:hover{background:#f0eeff!important}
      `}</style>

      <div style={{position:"relative",        background:"linear-gradient(135deg,#EDF3EF 0%,#F5F0E8 50%,#EEF0F7 100%)",borderRadius:24,padding:"18px 20px 14px",marginBottom:14,overflow:"hidden"}}>
        <Deco/>
        <div style={{position:"relative",zIndex:1}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <div style={{fontSize:11,fontWeight:500,letterSpacing:2,color:"#9A9088",textTransform:"uppercase",marginBottom:4}}>✿ Work Planner ✿</div>
              <h1 style={{margin:0,fontSize:22,fontWeight:500,color:"#3A3530"}}>工作管理中心 <span style={{fontSize:12,color:"#9A9088"}}>★★★</span></h1>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              {saveStatus&&(
                <span style={{fontSize:11,color:saveStatus==="saved"?"#2D4A36":saveStatus==="error"?"#8A2A1E":"#6B4A1E",background:saveStatus==="saved"?"#EDF3EF":saveStatus==="error"?"#FDF0EE":"#F7F0E6",borderRadius:8,padding:"4px 10px",border:`1px solid ${saveStatus==="saved"?"#B5CFC0":saveStatus==="error"?"#D4A89A":"#D4B896"}`}}>
                  {saveStatus==="saving"?"💾 儲存中...":saveStatus==="saved"?"✅ 已同步":"❌ 儲存失敗"}
                </span>
              )}
              <button onClick={()=>runAI("schedule")} style={{padding:"8px 14px",fontSize:12,borderRadius:12,border:"1.5px solid #C8D4CA",background:"#fff",color:"#3A6A46",cursor:"pointer",fontWeight:500}}>🤖 AI 排程</button>
              <button onClick={()=>runAI("summary")}  style={{padding:"8px 14px",fontSize:12,borderRadius:12,border:"none",background:"#7A9E87",color:"#fff",cursor:"pointer",fontWeight:500}}>✨ 今日小結</button>
            </div>
          </div>
          <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
            {[
              {emoji:"📁",label:"專案",val:activeProjects.length,bg:"#EEEDFE",tc:"#534AB7"},
              {emoji:"⏳",label:"待完成",val:allPending.length,bg:"#E6F1FB",tc:"#185FA5"},
              {emoji:"✅",label:"已完成",val:projects.reduce((a,p)=>a+p.tasks.filter(t=>t.done).length,0),bg:"#E1F5EE",tc:"#0F6E56"},
              {emoji:"🔥",label:"本週到期",val:todayTasks.length,bg:"#FCEBEB",tc:"#A32D2D"},
              {emoji:"🧺",label:"收集箱",val:pocket.length,bg:"#FAEEDA",tc:"#854F0B"},
            ].map(s=>(
              <div key={s.label} style={{background:s.bg,borderRadius:12,padding:"7px 12px",display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:14}}>{s.emoji}</span>
                <span style={{fontSize:11,color:s.tc,fontWeight:500}}>{s.label} {s.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{display:"flex",gap:6,marginBottom:14,background:"#EDF3EF",borderRadius:16,padding:5}}>
        {TABS.map(({key,emoji})=>(
          <button key={key} className="tab-btn" onClick={()=>setTab(key)} style={{flex:1,padding:"9px 4px",fontSize:13,fontWeight:tab===key?500:400,borderRadius:12,border:"none",cursor:"pointer",background:tab===key?"#fff":"transparent",color:tab===key?"#3A3530":"#9A9088",boxShadow:tab===key?"0 1px 4px rgba(0,0,0,0.06)":"none"}}>{emoji} {key}</button>
        ))}
      </div>

      {tab==="今日"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {activeProjects.length===0&&(
            <div style={{...card,textAlign:"center",padding:"2.5rem 1.5rem"}}>
              <div style={{fontSize:32,marginBottom:10}}>🌱</div>
              <div style={{fontSize:15,fontWeight:500,color:"#2a2060",marginBottom:6}}>歡迎使用工作管理中心！</div>
              <div style={{fontSize:13,color:"#9a88cc",marginBottom:16,lineHeight:1.7}}>先建立你的第一個專案，<br/>再新增任務就可以開始囉。</div>
              <button onClick={openNewP} style={{padding:"10px 24px",fontSize:13,borderRadius:12,border:"none",background:"#7A9E87",color:"#fff",cursor:"pointer",fontWeight:500}}>🌱 建立第一個專案</button>
            </div>
          )}
          {todayTasks.length>0&&(
            <div style={card}>
              <div style={{fontSize:13,fontWeight:500,color:"#2a2060",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>☀️ 本週需要注意<span style={{fontSize:11,background:"#FCEBEB",color:"#A32D2D",borderRadius:8,padding:"2px 8px"}}>{todayTasks.length} 件</span></div>
              {todayTasks.map(t=><TaskCard key={t.id} t={t} pid={t.projectId} pColor={t.projectColor} pName={t.projectName} showProject={true}/>)}
            </div>
          )}
          {todayTasks.length===0&&activeProjects.length>0&&(
            <div style={{...card,textAlign:"center",padding:"1.5rem"}}><div style={{fontSize:24,marginBottom:6}}>🎉</div><div style={{fontSize:13,color:"#9a88cc"}}>本週沒有即將到期的任務，繼續保持！</div></div>
          )}
          {activeProjects.length>0&&(
            <div style={card}>
              <div style={{fontSize:13,fontWeight:500,color:"#2a2060",marginBottom:12}}>📁 專案總覽</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10}}>
                {activeProjects.map(p=>{
                  const c=PAL[p.color]||PAL.purple;
                  const done=p.tasks.filter(t=>t.done).length,total=p.tasks.length,pct=total?Math.round(done/total*100):0;
                  return(
                    <div key={p.id} onClick={()=>{setSelId(p.id);setTab("專案");}} style={{background:c.light,borderRadius:14,padding:"12px 14px",cursor:"pointer",border:`1.5px solid ${c.mid}`}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}><div style={{width:8,height:8,borderRadius:"50%",background:c.accent}}/><span style={{fontSize:13,fontWeight:500,color:c.dark}}>{p.name}</span></div>
                      <div style={{height:4,background:"rgba(255,255,255,0.6)",borderRadius:99,overflow:"hidden",marginBottom:6}}><div style={{height:"100%",width:`${pct}%`,background:c.accent,borderRadius:99}}/></div>
                      <div style={{fontSize:11,color:c.dark,opacity:0.7}}>{done}/{total} 完成 · {pct}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {pocket.length>0&&(
            <div style={card}>
              <div style={{fontSize:13,fontWeight:500,color:"#2a2060",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span>🧺 收集箱待處理</span>
                <button onClick={()=>setTab("收集箱")} style={{fontSize:11,color:"#3A6A46",background:"#EDF3EF",border:"1px solid #B5CFC0",borderRadius:8,padding:"3px 10px",cursor:"pointer"}}>查看全部</button>
              </div>
              {pocket.slice(0,3).map(item=>(
                <div key={item.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",marginBottom:5,borderRadius:12,border:"1.5px solid #e0d9f5",background:"#faf8ff"}}>
                  <span style={{fontSize:12}}>{item.tag==="watch"?"🔭":"🗒️"}</span>
                  <span style={{flex:1,fontSize:13,color:"#2a2060"}}>{item.name}</span>
                  <span style={{fontSize:10,color:"#9a88cc",background:"#f0eeff",borderRadius:6,padding:"2px 6px"}}>{item.tag==="watch"?"觀望":"待分類"}</span>
                </div>
              ))}
              {pocket.length>3&&<div style={{fontSize:11,color:"#9a88cc",textAlign:"center",marginTop:4}}>還有 {pocket.length-3} 項...</div>}
            </div>
          )}
        </div>
      )}

      {tab==="月曆"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
            {Object.entries(EVT_TYPES).map(([k,v])=>(
              <div key={k} style={{display:"flex",alignItems:"center",gap:5,background:v.bg,border:`1px solid ${v.border}`,borderRadius:8,padding:"3px 10px"}}>
                <span style={{fontSize:11}}>{v.emoji}</span><span style={{fontSize:11,color:v.text,fontWeight:500}}>{v.label}</span>
              </div>
            ))}
            <div style={{marginLeft:"auto",fontSize:11,color:"#9a88cc"}}>點格子新增事件</div>
          </div>
          <div style={{...card,padding:"16px",position:"relative"}} className="cal-grid-wrap">
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
              <button onClick={()=>{let m=calMonth-1,y=calYear;if(m<0){m=11;y--;}setCalMonth(m);setCalYear(y);setSelDay(null);}} style={{background:"none",border:"1.5px solid #e0d9f5",borderRadius:10,width:32,height:32,cursor:"pointer",fontSize:16,color:"#534AB7",display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontWeight:500,fontSize:16,color:"#2a2060"}}>{calYear} 年 {MONTHS[calMonth]}</span>
                <button onClick={()=>{setCalYear(today.getFullYear());setCalMonth(today.getMonth());setSelDay(null);}} style={{fontSize:11,color:"#534AB7",background:"#f0eeff",border:"1px solid #c4b5f0",borderRadius:8,padding:"3px 10px",cursor:"pointer"}}>今天</button>
              </div>
              <button onClick={()=>{let m=calMonth+1,y=calYear;if(m>11){m=0;y++;}setCalMonth(m);setCalYear(y);setSelDay(null);}} style={{background:"none",border:"1.5px solid #e0d9f5",borderRadius:10,width:32,height:32,cursor:"pointer",fontSize:16,color:"#534AB7",display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:4}}>
              {WDAYS.map((w,i)=><div key={w} style={{textAlign:"center",fontSize:12,fontWeight:500,padding:"6px 0",color:i===0?"#E24B4A":i===6?"#185FA5":"#9a88cc"}}>{w}</div>)}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
              {Array.from({length:first}).map((_,i)=><div key={"e"+i} style={{minHeight:80,borderRadius:12,              background:"#F7F5F0",border:"1.5px solid transparent"}}/>)}
              {Array.from({length:total}).map((_,i)=>{
                const d=i+1,key=fmtDay(d);
                const isToday=calYear===today.getFullYear()&&calMonth===today.getMonth()&&d===today.getDate();
                const isSel=selDay===key;
                const dayEvts=events[key]||[];
                const dow=new Date(calYear,calMonth,d).getDay();
                return(
                  <div key={d} onClick={e=>openDayPopup(key,e)} style={{minHeight:80,borderRadius:12,padding:"6px 5px",cursor:"pointer",background:isSel?"#f0eeff":isToday?"#EEEDFE":dow===0||dow===6?"#fdfcff":"#fff",border:isSel?"1.5px solid #534AB7":isToday?"1.5px solid #AFA9EC":"1.5px solid #ede9f5"}}>
                    <div style={{width:24,height:24,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:4,fontSize:12,fontWeight:isToday?500:400,background:isToday?"#534AB7":"transparent",color:isToday?"#fff":dow===0?"#E24B4A":dow===6?"#185FA5":"#2a2060"}}>{d}</div>
                    {dayEvts.map(ev=>{
                      const et=EVT_TYPES[ev.type]||EVT_TYPES.remind;
                      return(
                        <div key={ev.id} onClick={e=>e.stopPropagation()} style={{display:"flex",alignItems:"center",gap:3,background:et.bg,border:`1px solid ${et.border}`,borderRadius:6,padding:"2px 5px",marginBottom:3,fontSize:10,color:et.text,fontWeight:500,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>
                          <span style={{flexShrink:0}}>{et.emoji}</span>
                          <span style={{overflow:"hidden",textOverflow:"ellipsis",flex:1}}>{ev.title}</span>
                          <span onClick={e=>{e.stopPropagation();delEvent(key,ev.id);}} style={{flexShrink:0,cursor:"pointer",opacity:0.5,fontSize:11,marginLeft:2}}>×</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            {selDay&&(()=>{
              const [y,m,d]=selDay.split("-");
              return(
                <div style={{position:"absolute",left:Math.min(popupPos.x,520),top:popupPos.y,width:240,background:"#fff",borderRadius:16,border:"1.5px solid #c4b5f0",boxShadow:"0 4px 20px rgba(83,74,183,0.15)",padding:"14px",zIndex:50,animation:"pop 0.15s ease"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                    <span style={{fontSize:13,fontWeight:500,color:"#2a2060"}}>{parseInt(m)} 月 {parseInt(d)} 日</span>
                    <button onClick={()=>setSelDay(null)} style={{background:"none",border:"none",cursor:"pointer",color:"#9a88cc",fontSize:16,padding:0}}>×</button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:8}}>
                    {Object.entries(EVT_TYPES).map(([k,v])=>(
                      <button key={k} onClick={()=>setEvtType(k)} style={{padding:"5px 4px",fontSize:11,borderRadius:8,cursor:"pointer",border:`1.5px solid ${evtType===k?v.border:"#e0d9f5"}`,background:evtType===k?v.bg:"transparent",color:evtType===k?v.text:"#9a88cc",fontWeight:evtType===k?500:400}}>{v.emoji} {v.label}</button>
                    ))}
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <input style={{...inp,flex:1,fontSize:12,padding:"7px 10px"}} placeholder="新增事件..." value={evtInput} onChange={e=>setEvtInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addEvent()} autoFocus/>
                    <button onClick={addEvent} style={{padding:"7px 12px",fontSize:13,borderRadius:10,border:"none",background:"#534AB7",color:"#fff",cursor:"pointer",fontWeight:500}}>+</button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {tab==="專案"&&(
        <div style={{display:"grid",gridTemplateColumns:"210px 1fr",gap:14}}>
          <div style={{...card,padding:"12px 10px"}}>
            <div style={{fontSize:11,fontWeight:500,letterSpacing:1,color:"#9a88cc",padding:"0 6px",marginBottom:8,textTransform:"uppercase"}}>📁 專案列表</div>
            {activeProjects.map(p=>{
              const c=PAL[p.color]||PAL.purple;
              const done=p.tasks.filter(t=>t.done).length,total=p.tasks.length,pct=total?Math.round(done/total*100):0,active=selId===p.id;
              return(
                <div key={p.id} className="proj-row" onClick={()=>setSelId(p.id)} style={{padding:"10px 10px",borderRadius:14,marginBottom:5,cursor:"pointer",background:active?c.light:"transparent",border:active?`1.5px solid ${c.mid}`:"1.5px solid transparent",position:"relative"}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:5}}>
                    <div style={{width:9,height:9,borderRadius:"50%",background:c.accent,flexShrink:0}}/>
                    <span style={{fontSize:13,fontWeight:500,color:active?c.dark:"#2a2060",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                    <span className="pact" style={{display:"flex",gap:2,opacity:0,transition:"opacity 0.15s"}}>
                      <span onClick={e=>openEditP(p,e)} style={{fontSize:11,padding:"1px 5px",borderRadius:6,background:"#f0eeff",color:"#534AB7",cursor:"pointer",border:"1px solid #c4b5f0"}}>✎</span>
                      <span onClick={e=>{e.stopPropagation();archiveProject(p.id);}} style={{fontSize:11,padding:"1px 5px",borderRadius:6,background:"#FAEEDA",color:"#854F0B",cursor:"pointer",border:"1px solid #FAC775"}}>📦</span>
                      <span onClick={e=>{e.stopPropagation();setConfirmDel(p.id);}} style={{fontSize:11,padding:"1px 5px",borderRadius:6,background:"#FCEBEB",color:"#A32D2D",cursor:"pointer",border:"1px solid #F7C1C1"}}>✕</span>
                    </span>
                  </div>
                  <div style={{height:4,background:active?c.mid:"#ede9f5",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:c.accent,borderRadius:99}}/></div>
                  <div style={{fontSize:10,color:"#9a88cc",marginTop:4}}>{done}/{total} 完成</div>
                </div>
              );
            })}
            {activeProjects.length===0&&<div style={{textAlign:"center",padding:"1rem 0.5rem",fontSize:12,color:"#c4b5f0"}}>還沒有專案 🌱</div>}
            {showPF?(
              <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:6,padding:"0 2px"}}>
                <div style={{fontSize:11,color:"#9a88cc",marginBottom:2}}>{editProj?"✎ 編輯專案":"🌱 新增專案"}</div>
                <input style={inp} placeholder="專案名稱" value={pForm.name} onChange={e=>setPForm({...pForm,name:e.target.value})} onKeyDown={e=>e.key==="Enter"&&saveP()} autoFocus/>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",padding:"2px 0"}}>
                  {CKEYS.map(k=>{const c=PAL[k];const s=pForm.color===k;return(<div key={k} onClick={()=>setPForm({...pForm,color:k})} style={{width:22,height:22,borderRadius:"50%",background:c.accent,cursor:"pointer",border:s?"2.5px solid #2a2060":"2.5px solid transparent",outline:s?`2px solid ${c.accent}`:"none",outlineOffset:2}}/>);})}
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button style={{flex:1,padding:"7px 0",fontSize:12,borderRadius:10,border:"none",background:"#534AB7",color:"#fff",cursor:"pointer"}} onClick={saveP}>儲存</button>
                  <button style={{flex:1,padding:"7px 0",fontSize:12,borderRadius:10,border:"1.5px solid #e0d9f5",background:"transparent",color:"#9a88cc",cursor:"pointer"}} onClick={()=>setShowPF(false)}>取消</button>
                </div>
              </div>
            ):(
              <button onClick={openNewP} style={{width:"100%",marginTop:8,padding:"8px 0",fontSize:12,borderRadius:12,border:"1.5px dashed #c4b5f0",background:"transparent",color:"#9a88cc",cursor:"pointer"}}>🌱 新增專案</button>
            )}
            {archivedProjects.length>0&&(
              <div style={{marginTop:12,borderTop:"1px dashed #e0d9f5",paddingTop:10}}>
                <button onClick={()=>setShowArchived(v=>!v)} style={{width:"100%",textAlign:"left",background:"none",border:"none",cursor:"pointer",fontSize:11,color:"#9a88cc",padding:"2px 4px"}}>📦 已歸檔 ({archivedProjects.length}) {showArchived?"▲":"▼"}</button>
                {showArchived&&archivedProjects.map(p=>(
                  <div key={p.id} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 8px",borderRadius:10,marginTop:4,background:"#faf8ff",border:"1px solid #e8e4f5"}}>
                    <span style={{fontSize:11,color:"#9a88cc",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                    <span onClick={()=>unarchiveProject(p.id)} style={{fontSize:10,color:"#0F6E56",cursor:"pointer",background:"#E1F5EE",borderRadius:6,padding:"2px 6px",border:"1px solid #5DCAA5",flexShrink:0}}>還原</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={card}>
            {project?(
              <>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:10,height:10,borderRadius:"50%",background:PAL[project.color]?.accent}}/>
                    <span style={{fontSize:16,fontWeight:500,color:"#2a2060"}}>{project.name}</span>
                    <span style={{fontSize:11,background:PAL[project.color]?.light,color:PAL[project.color]?.accent,borderRadius:8,padding:"2px 9px",fontWeight:500,border:`1px solid ${PAL[project.color]?.mid}`}}>{project.tasks.filter(t=>!t.done).length} 待完成</span>
                  </div>
                  <button onClick={()=>setShowTF(v=>!v)} style={{padding:"7px 14px",fontSize:12,borderRadius:10,border:"1.5px solid #C8D4CA",background:"#EDF3EF",color:"#2D4A36",cursor:"pointer",fontWeight:500}}>＋ 新增任務</button>
                </div>
                {showTF&&(
                  <div style={{background:"#faf8ff",borderRadius:14,padding:"12px 14px",marginBottom:12,border:"1.5px solid #e0d9f5",animation:"pop 0.15s ease"}}>
                    <input style={{...inp,marginBottom:8}} placeholder="任務名稱 🖊" value={newTask.name} onChange={e=>setNewTask({...newTask,name:e.target.value})} autoFocus/>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                      <div><div style={{fontSize:11,color:"#9a88cc",marginBottom:4}}>截止日期 📅</div><input style={inp} type="date" value={newTask.due} onChange={e=>setNewTask({...newTask,due:e.target.value})}/></div>
                      <div><div style={{fontSize:11,color:"#9a88cc",marginBottom:4}}>預估時數 ⏱</div><input style={inp} type="number" placeholder="1" min="0.5" step="0.5" value={newTask.est} onChange={e=>setNewTask({...newTask,est:e.target.value})}/></div>
                    </div>
                    <div style={{marginBottom:8}}><div style={{fontSize:11,color:"#9a88cc",marginBottom:4}}>說明備註 📝（選填）</div><textarea style={{...inp,resize:"vertical",minHeight:56,lineHeight:1.6}} placeholder="補充細節說明..." value={newTask.note} onChange={e=>setNewTask({...newTask,note:e.target.value})}/></div>
                    <label style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,cursor:"pointer",padding:"8px 12px",borderRadius:10,                    background:newTask.syncCal?"#EDF3EF":"#F7F5F0",border:`1.5px solid ${newTask.syncCal?"#B5CFC0":"#E2DDD6"}`}}>
                      <input type="checkbox" checked={newTask.syncCal} onChange={e=>setNewTask({...newTask,syncCal:e.target.checked})} style={{width:15,height:15,cursor:"pointer",accentColor:"#7A9E87"}}/>
                      <span style={{fontSize:12,color:newTask.syncCal?"#2D4A36":"#9A9088",fontWeight:newTask.syncCal?500:400}}>🗓️ 同步截止日到月曆</span>
                      {newTask.syncCal&&!newTask.due&&<span style={{fontSize:11,color:"#F0997B",marginLeft:"auto"}}>請先填截止日期</span>}
                    </label>
                    <div style={{display:"flex",gap:8}}>
                      <div style={{flex:1,padding:"8px 0",fontSize:13,borderRadius:10,border:"none",background:"#7A9E87",color:"#fff",cursor:"pointer"}} onClick={addTask}>新增</div>
                      <div style={{flex:1,padding:"8px 0",fontSize:13,borderRadius:10,border:"1.5px solid #E2DDD6",background:"transparent",color:"#9A9088",cursor:"pointer",textAlign:"center"}} onClick={()=>setShowTF(false)}>取消</div>
                    </div>
                  </div>
                )}
                {project.tasks.length===0?<div style={{textAlign:"center",padding:"2rem 0",color:"#9a88cc",fontSize:13}}>還沒有任務，點右上角新增吧 🌸</div>:project.tasks.map(t=><TaskCard key={t.id} t={t} pid={project.id} pColor={project.color} pName={project.name}/>)}
              </>
            ):<div style={{fontSize:13,color:"#9a88cc",textAlign:"center",padding:"2rem"}}>請選擇左側專案 👈</div>}
          </div>
        </div>
      )}

      {tab==="收集箱"&&(
        <div style={card}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18}}>
            <div style={{background:"#FAEEDA",borderRadius:14,padding:"10px 14px",border:"1.5px solid #FAC775"}}><div style={{fontSize:13,fontWeight:500,color:"#854F0B",marginBottom:3}}>🗒️ 待分類任務</div><div style={{fontSize:11,color:"#633806",lineHeight:1.6}}>確定要做、但還沒放到專案的事。</div></div>
            <div style={{background:"#E1F5EE",borderRadius:14,padding:"10px 14px",border:"1.5px solid #5DCAA5"}}><div style={{fontSize:13,fontWeight:500,color:"#0F6E56",marginBottom:3}}>🔭 觀望業務</div><div style={{fontSize:11,color:"#085041",lineHeight:1.6}}>不確定要不要辦的計畫，先放這。</div></div>
          </div>
              <button onClick={()=>setShowPF2(v=>!v)} style={{padding:"7px 16px",fontSize:12,marginBottom:14,borderRadius:10,border:"1.5px solid #C8D4CA",background:"#EDF3EF",color:"#2D4A36",cursor:"pointer",fontWeight:500}}>🧺 新增到收集箱</button>
          {showPF2&&(
            <div style={{background:"#faf8ff",borderRadius:14,padding:"12px 14px",marginBottom:14,border:"1.5px solid #e0d9f5",animation:"pop 0.15s ease"}}>
              <input style={{...inp,marginBottom:8}} placeholder="名稱" value={pocketForm.name} onChange={e=>setPocketForm({...pocketForm,name:e.target.value})} autoFocus/>
              <div style={{display:"flex",gap:8,marginBottom:8}}>
                {[{v:"todo",label:"🗒️ 待分類",bg:"#FAEEDA",bc:"#FAC775",tc:"#854F0B"},{v:"watch",label:"🔭 觀望",bg:"#E1F5EE",bc:"#5DCAA5",tc:"#0F6E56"}].map(o=>(
                  <button key={o.v} onClick={()=>setPocketForm({...pocketForm,tag:o.v})} style={{flex:1,padding:"7px 0",fontSize:12,borderRadius:10,border:`1.5px solid ${pocketForm.tag===o.v?o.bc:"#e0d9f5"}`,background:pocketForm.tag===o.v?o.bg:"transparent",color:pocketForm.tag===o.v?o.tc:"#9a88cc",cursor:"pointer",fontWeight:pocketForm.tag===o.v?500:400}}>{o.label}</button>
                ))}
              </div>
              <input style={{...inp,marginBottom:8}} placeholder="備註（選填）" value={pocketForm.note} onChange={e=>setPocketForm({...pocketForm,note:e.target.value})}/>
              <div style={{display:"flex",gap:8}}>
                <button style={{flex:1,padding:"8px 0",fontSize:13,borderRadius:10,border:"none",background:"#534AB7",color:"#fff",cursor:"pointer"}} onClick={addPocket}>新增</button>
                <button style={{flex:1,padding:"8px 0",fontSize:13,borderRadius:10,border:"1.5px solid #e0d9f5",background:"transparent",color:"#9a88cc",cursor:"pointer"}} onClick={()=>setShowPF2(false)}>取消</button>
              </div>
            </div>
          )}
          {["todo","watch"].map(tag=>{
            const items=pocket.filter(x=>x.tag===tag);
            const cfg=tag==="todo"?{emoji:"🗒️",label:"待分類任務",dot:"#EF9F27",dotBg:"#FAEEDA"}:{emoji:"🔭",label:"觀望業務",dot:"#5DCAA5",dotBg:"#E1F5EE"};
            return(
              <div key={tag} style={{marginBottom:18}}>
                <div style={{fontSize:12,fontWeight:500,color:"#9a88cc",marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
                  {cfg.emoji} {cfg.label}<span style={{background:tag==="todo"?"#FAEEDA":"#E1F5EE",color:tag==="todo"?"#854F0B":"#0F6E56",borderRadius:8,padding:"1px 7px",fontSize:10}}>{items.length}</span>
                </div>
                {items.length===0&&<div style={{fontSize:12,color:"#c4b5f0",padding:"4px 0"}}>空的 🌸</div>}
                {items.map(item=>(
                  <div key={item.id} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"11px 14px",marginBottom:6,borderRadius:14,border:"1.5px solid #e0d9f5",background:"#fff"}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:cfg.dotBg,border:`1.5px solid ${cfg.dot}`,flexShrink:0,marginTop:4}}/>
                    <div style={{flex:1}}><div style={{fontSize:13,fontWeight:500,color:"#2a2060"}}>{item.name}</div>{item.note&&<div style={{fontSize:11,color:"#9a88cc",marginTop:2}}>{item.note}</div>}<div style={{fontSize:11,color:"#c4b5f0",marginTop:2}}>{item.createdAt}</div></div>
                    <select style={{padding:"5px 8px",fontSize:12,borderRadius:10,border:"1.5px solid #e0d9f5",background:"#fff",color:"#2a2060",cursor:"pointer"}} defaultValue="" onChange={e=>{const pid=parseInt(e.target.value);if(pid)movePocket(item,pid);}}>
                      <option value="">移至專案...</option>
                      {activeProjects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <button onClick={()=>setPocket(pocket.filter(x=>x.id!==item.id))} style={{background:"none",border:"none",cursor:"pointer",color:"#c4b5f0",fontSize:16,padding:"0 2px"}}>×</button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {tab==="小結"&&(
        <div style={card}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <div><div style={{fontSize:15,fontWeight:500,color:"#2a2060"}}>✨ 今日工作小結</div><div style={{fontSize:12,color:"#9a88cc",marginTop:2}}>由 AI 分析任務狀況並給出建議</div></div>
            <button onClick={()=>runAI("summary")} style={{padding:"8px 14px",fontSize:12,borderRadius:10,border:"none",background:"#7A9E87",color:"#fff",cursor:"pointer",fontWeight:500}}>重新生成</button>
          </div>
          {aiLoading&&<div style={{display:"flex",alignItems:"center",gap:10,padding:"1.5rem",color:"#9A9088",fontSize:13}}><div style={{width:14,height:14,borderRadius:"50%",border:"2px solid #7A9E87",borderTopColor:"transparent",animation:"spin 0.8s linear infinite"}}/>AI 分析中...</div>}
          {aiResult&&!aiLoading&&<div style={{background:"#F7F5F0",borderRadius:14,padding:"16px 18px",fontSize:13,lineHeight:1.9,color:"#3A3530",whiteSpace:"pre-wrap",border:"1px solid #E8E4DC"}}>{aiResult}</div>}
          {!aiLoading&&!aiResult&&<div style={{textAlign:"center",padding:"2.5rem 1rem",color:"#9A9088",fontSize:13}}>點右上角「今日小結」或「重新生成」讓 AI 幫你回顧今天 ✨</div>}
        </div>
      )}

      {aiResult&&tab!=="小結"&&!aiLoading&&(
        <div style={{marginTop:14,...card}}><div style={{fontSize:11,fontWeight:500,color:"#534AB7",marginBottom:8,letterSpacing:1}}>✨ AI 建議</div><div style={{fontSize:13,lineHeight:1.9,color:"#2a2060",whiteSpace:"pre-wrap"}}>{aiResult}</div></div>
      )}

      {editTask&&(
        <div style={{position:"fixed",inset:0,background:"rgba(42,32,96,0.25)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999}}>
          <div style={{background:"#fff",borderRadius:20,padding:"24px 26px",width:340,border:"1.5px solid #e0d9f5",animation:"pop 0.15s ease"}}>
            <div style={{fontSize:15,fontWeight:500,color:"#2a2060",marginBottom:14}}>✎ 編輯任務</div>
            <div style={{fontSize:11,color:"#9a88cc",marginBottom:4}}>任務名稱</div>
            <input style={{...inp,marginBottom:10}} value={editForm.name} onChange={e=>setEditForm({...editForm,name:e.target.value})} autoFocus/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
              <div><div style={{fontSize:11,color:"#9a88cc",marginBottom:4}}>截止日期 📅</div><input style={inp} type="date" value={editForm.due} onChange={e=>setEditForm({...editForm,due:e.target.value})}/></div>
              <div><div style={{fontSize:11,color:"#9a88cc",marginBottom:4}}>預估時數 ⏱</div><input style={inp} type="number" min="0.5" step="0.5" value={editForm.est} onChange={e=>setEditForm({...editForm,est:e.target.value})}/></div>
            </div>
            <div style={{fontSize:11,color:"#9a88cc",marginBottom:4}}>說明備註 📝（選填）</div>
            <textarea style={{...inp,resize:"vertical",minHeight:60,lineHeight:1.6,marginBottom:14}} placeholder="補充細節說明..." value={editForm.note} onChange={e=>setEditForm({...editForm,note:e.target.value})}/>
            <div style={{display:"flex",gap:8}}>
              <button style={{flex:1,padding:"8px 0",fontSize:13,borderRadius:10,border:"none",background:"#534AB7",color:"#fff",cursor:"pointer",fontWeight:500}} onClick={saveEditT}>儲存</button>
              <button style={{flex:1,padding:"8px 0",fontSize:13,borderRadius:10,border:"1.5px solid #e0d9f5",background:"transparent",color:"#9a88cc",cursor:"pointer"}} onClick={()=>setEditTask(null)}>取消</button>
            </div>
          </div>
        </div>
      )}

      {confirmDel&&(
        <div style={{position:"fixed",inset:0,background:"rgba(42,32,96,0.25)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999}}>
          <div style={{background:"#fff",borderRadius:20,padding:"24px 28px",width:300,border:"1.5px solid #e0d9f5",animation:"pop 0.15s ease"}}>
            <div style={{fontSize:15,fontWeight:500,color:"#2a2060",marginBottom:8}}>🗑️ 刪除專案</div>
            <div style={{fontSize:13,color:"#9a88cc",marginBottom:20,lineHeight:1.7}}>確定要刪除「{projects.find(p=>p.id===confirmDel)?.name}」？所有任務也會一併刪除，無法復原。</div>
            <div style={{display:"flex",gap:8}}>
              <button style={{flex:1,padding:"8px 0",fontSize:13,borderRadius:10,background:"#FCEBEB",color:"#A32D2D",border:"1.5px solid #F7C1C1",cursor:"pointer",fontWeight:500}} onClick={delP}>確定刪除</button>
              <button style={{flex:1,padding:"8px 0",fontSize:13,borderRadius:10,border:"1.5px solid #e0d9f5",background:"transparent",color:"#9a88cc",cursor:"pointer"}} onClick={()=>setConfirmDel(null)}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}