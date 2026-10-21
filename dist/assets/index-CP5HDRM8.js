(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))c(a);new MutationObserver(a=>{for(const o of a)if(o.type==="childList")for(const l of o.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&c(l)}).observe(document,{childList:!0,subtree:!0});function s(a){const o={};return a.integrity&&(o.integrity=a.integrity),a.referrerPolicy&&(o.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?o.credentials="include":a.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function c(a){if(a.ep)return;a.ep=!0;const o=s(a);fetch(a.href,o)}})();const G="gamestreamer_state_v1",W={activeMatch:{id:"demo-live",isLive:!1,date:"Today",opponent:"Lincoln High",teamUs:"Wildcats",teamThem:"Lincoln",courtSideUs:"left",scoreUs:18,scoreThem:16,setsUs:1,setsThem:0,currentSet:2,lastScoreTimestamp:Date.now()-15e3,viewers:3},matches:[{id:"demo-live",date:"Today",opponent:"Lincoln High",isLive:!1,setsUs:1,setsThem:0,currentSet:2,scoreUs:18,scoreThem:16,highlights:[{id:"h_1",set:1,score:"14 - 12",label:"🔥 Ace!",videoUrl:"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",isUploading:!1,timestamp:Date.now()-18e5},{id:"h_2",set:1,score:"24 - 23",label:"💪 Big Block!",videoUrl:"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",isUploading:!1,timestamp:Date.now()-9e5},{id:"h_3",set:2,score:"18 - 16",label:"💣 Crazy Kill",videoUrl:"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",isUploading:!0,timestamp:Date.now()-6e4}]},{id:"match-oct-18",date:"Oct 18, 2026",opponent:"West High",isLive:!1,setsUs:2,setsThem:1,currentSet:3,scoreUs:15,scoreThem:11,highlights:[{id:"h_w1",set:1,score:"19 - 17",label:"⛏️ Amazing Dig",videoUrl:"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4",isUploading:!1,timestamp:17292672e5},{id:"h_w2",set:3,score:"14 - 11",label:"🎯 Cool Set",videoUrl:"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",isUploading:!1,timestamp:17292708e5}]},{id:"match-oct-11",date:"Oct 11, 2026",opponent:"East High",isLive:!1,setsUs:2,setsThem:0,currentSet:2,scoreUs:25,scoreThem:21,highlights:[{id:"h_e1",set:2,score:"24 - 21",label:"Highlight",videoUrl:"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",isUploading:!1,timestamp:17286624e5}]}],chat:[{id:"c1",sender:"Grandma",text:"Watching from Ohio! Let's go Wildcats! 🏐",timestamp:Date.now()-12e4},{id:"c2",sender:"Aunt Sarah",text:"Great defense! 💪",timestamp:Date.now()-6e4}],recentCheerPill:null};class X{constructor(){this.listeners=new Set,this.state=this.loadState()}loadState(){try{const e=localStorage.getItem(G);if(e)return{...W,...JSON.parse(e)}}catch(e){console.warn("Could not load stored state, using defaults:",e)}return W}saveState(){try{localStorage.setItem(G,JSON.stringify(this.state))}catch(e){console.warn("Could not save state to localStorage:",e)}this.notify()}subscribe(e){return this.listeners.add(e),()=>this.listeners.delete(e)}notify(){for(const e of this.listeners)e(this.state)}getState(){return this.state}adjustScore(e,s){if(this.state.activeMatch.courtSideUs===e){const a=Math.max(0,this.state.activeMatch.scoreUs+s);this.state.activeMatch.scoreUs=a}else{const a=Math.max(0,this.state.activeMatch.scoreThem+s);this.state.activeMatch.scoreThem=a}this.state.activeMatch.lastScoreTimestamp=Date.now(),this.triggerHaptic(s>0?"light":"double"),this.saveState()}swapSides(){const e=this.state.activeMatch.courtSideUs;this.state.activeMatch.courtSideUs=e==="left"?"right":"left",this.triggerHaptic("medium"),this.saveState()}advanceSet(){const e=this.state.activeMatch;e.scoreUs>e.scoreThem?e.setsUs+=1:e.scoreThem>e.scoreUs&&(e.setsThem+=1),e.currentSet+=1,e.scoreUs=0,e.scoreThem=0,e.lastScoreTimestamp=Date.now(),this.triggerHaptic("heavy"),this.saveState()}triggerHighlight(e=null){const s=this.state.activeMatch,c=this.state.recentCheerPill,a=c?c.text:"Highlight",o={id:"h_"+Date.now(),set:s.currentSet,score:`${s.scoreUs} - ${s.scoreThem}`,label:a,videoUrl:e||"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",isUploading:!0,timestamp:Date.now()};let l=this.state.matches.find(n=>n.id===s.id);return l||(l={id:s.id,date:s.date,opponent:s.opponent,isLive:s.isLive,setsUs:s.setsUs,setsThem:s.setsThem,currentSet:s.currentSet,scoreUs:s.scoreUs,scoreThem:s.scoreThem,highlights:[]},this.state.matches.unshift(l)),l.highlights.push(o),this.triggerHaptic("double"),this.saveState(),setTimeout(()=>{o.isUploading=!1,this.saveState()},4e3),o}postCheerPill(e){const s=this.state.activeMatch,c={id:"c_"+Date.now(),sender:"Broadcaster",text:e,set:s.currentSet,score:`${s.scoreUs} - ${s.scoreThem}`,timestamp:Date.now(),isCheer:!0};this.state.recentCheerPill=c,this.state.chat.push(c),this.triggerHaptic("light"),this.saveState(),setTimeout(()=>{this.state.recentCheerPill===c&&(this.state.recentCheerPill=null)},2e4)}postChatMessage(e,s){!s||!s.trim()||(this.state.chat.push({id:"c_"+Date.now(),sender:e||"Viewer",text:s.trim(),timestamp:Date.now()}),this.saveState())}startBroadcast(e="Opponent"){this.state.activeMatch.opponent=e,this.state.activeMatch.isLive=!0,this.state.activeMatch.date="Today",this.state.activeMatch.scoreUs=0,this.state.activeMatch.scoreThem=0,this.state.activeMatch.setsUs=0,this.state.activeMatch.setsThem=0,this.state.activeMatch.currentSet=1,this.state.activeMatch.viewers=1;const s=this.state.matches.find(c=>c.id===this.state.activeMatch.id);s?(s.isLive=!0,s.opponent=e,s.date="Today"):this.state.matches.unshift({id:this.state.activeMatch.id,date:"Today",opponent:e,isLive:!0,setsUs:0,setsThem:0,currentSet:1,scoreUs:0,scoreThem:0,highlights:[]}),this.saveState()}stopBroadcast(){this.state.activeMatch.isLive=!1;const e=this.state.matches.find(s=>s.id===this.state.activeMatch.id);e&&(e.isLive=!1),this.saveState()}triggerHaptic(e="light"){try{navigator.vibrate&&(e==="light"?navigator.vibrate(20):e==="medium"?navigator.vibrate(40):e==="double"?navigator.vibrate([25,40,25]):e==="heavy"&&navigator.vibrate(70))}catch{}}}const d=new X;class Z{constructor(e,s){this.clip=e,this.onClose=s,this.currentSpeed=1,this.isPlaying=!0,this.element=null,this.video=null,this.render()}render(){this.element=document.createElement("div"),this.element.className="replay-modal-backdrop",this.element.innerHTML=`
      <div class="replay-modal">
        <div class="replay-header">
          <div>
            <span class="highlight-badge">Set ${this.clip.set} (${this.clip.score})</span>
            <span class="highlight-label" style="margin-left: 8px;">${this.clip.label||"Highlight"}</span>
          </div>
          <button class="apple-btn" id="btn-close-replay" style="padding: 4px 10px; font-size: 13px;">✕ Close</button>
        </div>

        <div class="replay-video-box">
          <video class="replay-video" id="replay-video-elem" playsinline autoplay>
            <source src="${this.clip.videoUrl}" type="video/mp4" />
          </video>
        </div>

        <div class="replay-controls">
          <div class="replay-button-row">
            <div class="replay-actions-left">
              <button class="apple-btn" id="btn-play-pause">⏸</button>
              <button class="apple-btn" id="btn-seek-back">⏮ 10s</button>
              <button class="apple-btn" id="btn-seek-forward">10s ⏭</button>
            </div>

            <!-- Always visible segmented speed toggles, default 1x -->
            <div class="speed-toggle-group" id="speed-toggle-group">
              <button class="speed-btn active" data-speed="1.0">1x</button>
              <button class="speed-btn" data-speed="0.5">0.5x</button>
              <button class="speed-btn" data-speed="0.25">0.25x</button>
            </div>
          </div>
        </div>
      </div>
    `,document.body.appendChild(this.element),this.video=this.element.querySelector("#replay-video-elem"),this.video.playbackRate=this.currentSpeed,this.setupListeners()}setupListeners(){const e=this.element.querySelector("#btn-close-replay"),s=this.element.querySelector("#btn-play-pause"),c=this.element.querySelector("#btn-seek-back"),a=this.element.querySelector("#btn-seek-forward"),o=this.element.querySelectorAll(".speed-btn");e.onclick=()=>this.destroy(),this.element.onclick=l=>{l.target===this.element&&this.destroy()},s.onclick=()=>{this.video.paused?(this.video.play(),s.textContent="⏸"):(this.video.pause(),s.textContent="▶")},c.onclick=()=>{this.video.currentTime=Math.max(0,this.video.currentTime-10)},a.onclick=()=>{this.video.currentTime=Math.min(this.video.duration||999,this.video.currentTime+10)},o.forEach(l=>{l.onclick=()=>{const n=parseFloat(l.dataset.speed);this.currentSpeed=n,this.video.playbackRate=n,o.forEach(r=>r.classList.remove("active")),l.classList.add("active")}}),this.video.onended=()=>{s.textContent="▶"}}destroy(){this.element&&this.element.parentNode&&(this.video&&this.video.pause(),this.element.parentNode.removeChild(this.element)),this.onClose&&this.onClose()}}function Q(t,e){function s(){const c=d.getState(),a=c.activeMatch;t.innerHTML=`
      <div class="hub-container">
        <!-- Header -->
        <header class="hub-header">
          <div class="hub-brand">
            <span style="font-size: 24px;">🏐</span>
            <h1>Wildcats Streamer</h1>
          </div>
          <button class="apple-btn" id="btn-go-live-header">🎥 Go Live</button>
        </header>

        <!-- Live Hero Section (Displayed only when active) -->
        ${a.isLive?`
          <div class="live-hero-card frosted-glass">
            <div class="live-hero-header">
              <span class="live-badge"><span class="pulse-dot"></span> Live Now</span>
              <span class="tabular-nums" style="font-size: 13px; color: var(--text-secondary);">${a.viewers} watching</span>
            </div>

            <div class="live-matchup-title">vs. ${a.opponent}</div>

            <div class="live-score-strip tabular-nums">
              <span>${a.scoreUs}</span>
              <span style="color: var(--text-tertiary); font-weight: 300;">-</span>
              <span>${a.scoreThem}</span>
              <span class="live-score-sets">(Set ${a.currentSet} • Sets: ${a.setsUs}-${a.setsThem})</span>
            </div>

            <button class="apple-btn apple-btn-primary btn-watch-live" id="btn-watch-live">
              ▶ Tap to Watch Live Game
            </button>
          </div>
        `:`
          <div class="frosted-glass" style="border-radius: 16px; padding: 18px 20px; text-align: center; color: var(--text-secondary); font-size: 14px;">
            ⚪ No live game streaming right now. Explore past match highlights below.
          </div>
        `}

        <!-- Unified Match Archive -->
        <section class="archive-section">
          <div class="archive-header">
            <h2>Match Archive & Highlights</h2>
          </div>

          <div class="match-list" id="match-archive-list">
            ${c.matches.map(n=>`
              <div class="match-card frosted-glass">
                <div class="match-card-header" data-id="${n.id}">
                  <div class="match-info-main">
                    <div class="match-title">
                      ${n.date} vs. ${n.opponent}
                    </div>
                    <div class="match-meta tabular-nums">
                      ${n.highlights.length} Highlight${n.highlights.length===1?"":"s"} • Sets: ${n.setsUs}-${n.setsThem}
                    </div>
                  </div>
                  <div>
                    ${n.isLive?`
                      <span class="match-result-badge live">🔴 In Progress</span>
                    `:n.setsUs>n.setsThem?`
                      <span class="match-result-badge win">Won ${n.setsUs}-${n.setsThem}</span>
                    `:`
                      <span class="match-result-badge">${n.setsUs}-${n.setsThem}</span>
                    `}
                  </div>
                </div>

                <!-- Chronological Flat List of Highlights -->
                <div class="highlight-sublist" id="sublist-${n.id}">
                  ${n.highlights.length===0?`
                    <div style="font-size: 13px; color: var(--text-tertiary); padding: 8px;">No highlights clipped yet.</div>
                  `:n.highlights.map(r=>`
                    <div class="highlight-row">
                      <div class="highlight-left">
                        <span class="highlight-badge tabular-nums">Set ${r.set} (${r.score})</span>
                        <span class="highlight-label">${r.label||"Highlight"}</span>
                      </div>
                      <div>
                        ${r.isUploading?`
                          <span class="highlight-uploading">⏳ Uploading...</span>
                        `:`
                          <button class="apple-btn btn-play-clip" data-clip-id="${r.id}" data-match-id="${n.id}">▶</button>
                        `}
                      </div>
                    </div>
                  `).join("")}
                </div>
              </div>
            `).join("")}
          </div>
        </section>
      </div>
    `;const o=t.querySelector("#btn-watch-live");o&&(o.onclick=()=>e("/watch"));const l=t.querySelector("#btn-go-live-header");l&&(l.onclick=()=>ee(e)),t.querySelectorAll(".btn-play-clip").forEach(n=>{n.onclick=()=>{const r=n.dataset.matchId,y=n.dataset.clipId,b=c.matches.find(g=>g.id===r);if(b){const g=b.highlights.find(S=>S.id===y);g&&new Z(g)}}})}return s(),d.subscribe(s)}function ee(t){const e=document.createElement("div");e.className="simple-modal-backdrop",e.innerHTML=`
    <div class="simple-modal">
      <h3>Start Live Broadcast</h3>
      <p style="font-size: 13px; color: var(--text-secondary);">Enter the opponent school/club name to begin streaming.</p>
      
      <input type="text" class="simple-input" id="input-opponent" placeholder="Opponent Name (e.g. Lincoln High)" value="Lincoln High" />
      <input type="password" class="simple-input" id="input-pin" placeholder="Broadcaster PIN (Default: 1234)" value="1234" maxlength="4" />

      <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 8px;">
        <button class="apple-btn" id="btn-cancel-modal">Cancel</button>
        <button class="apple-btn apple-btn-primary" id="btn-confirm-go-live">Start Stream 🎥</button>
      </div>
    </div>
  `,document.body.appendChild(e);const s=e.querySelector("#btn-cancel-modal"),c=e.querySelector("#btn-confirm-go-live"),a=e.querySelector("#input-opponent"),o=e.querySelector("#input-pin");s.onclick=()=>e.remove(),c.onclick=()=>{if(o.value!=="1234"){alert("Incorrect PIN. Default is 1234.");return}const l=a.value.trim()||"Opponent";d.startBroadcast(l),e.remove(),t("/stream")}}function te(t,e){let s=null,c=null,a=!1,o=null,l=!1;t.innerHTML=`
    <div class="streamer-container" id="streamer-root">
      <!-- Fullscreen Camera Preview (or simulation canvas) -->
      <video class="camera-preview" id="camera-feed" autoplay playsinline muted></video>
      <canvas class="camera-preview" id="simulated-canvas" style="display: none;"></canvas>

      <!-- Invisible Split Screen Gesture Zones -->
      <div class="split-gesture-overlay" id="split-overlay">
        <div class="gesture-zone" id="zone-left">
          <div class="gesture-zone-hint" id="hint-left">+1 POINT</div>
        </div>
        <div class="gesture-zone" id="zone-right">
          <div class="gesture-zone-hint" id="hint-right">+1 POINT</div>
        </div>
      </div>

      <!-- Top Row Controls -->
      <header class="streamer-top-bar">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="streamer-pill frosted-glass tabular-nums" style="display: flex; align-items: center; gap: 6px;">
            <span class="pulse-dot"></span>
            <span>LIVE</span>
            <span id="txt-viewer-count" style="color: var(--text-secondary);">(3)</span>
          </div>
          <button class="apple-btn" id="btn-end-stream" style="padding: 6px 12px; font-size: 12px;">✕ End</button>
        </div>

        <button class="apple-btn frosted-glass tabular-nums" id="btn-set-counter" style="font-weight: 700; font-size: 14px;">
          SET 1
        </button>

        <button class="apple-btn btn-highlight" id="btn-trigger-highlight">
          ⚡ HIGHLIGHT
        </button>
      </header>

      <!-- Bottom Score Row with Midline Swap Button -->
      <footer class="streamer-bottom-bar">
        <!-- Left Team Card -->
        <div class="streamer-score-card frosted-glass" id="card-left">
          <div>
            <div class="score-team-label" id="lbl-team-left">US</div>
            <div class="score-digit tabular-nums" id="digit-left">18</div>
          </div>
        </div>

        <!-- Midline Swap Sides Button -->
        <button class="apple-btn frosted-glass btn-swap-sides" id="btn-swap-sides" title="Swap Court Sides">
          ⇄
        </button>

        <!-- Right Team Card -->
        <div class="streamer-score-card frosted-glass" id="card-right">
          <div style="text-align: right;">
            <div class="score-team-label" id="lbl-team-right">THEM</div>
            <div class="score-digit tabular-nums" id="digit-right">16</div>
          </div>
        </div>
      </footer>

      <!-- Expandable (+) Cheer Drawer & Voice Mic -->
      <div class="streamer-cheer-shelf">
        <div class="cheer-pill-list" id="cheer-drawer" style="display: none;">
          <button class="apple-btn btn-cheer-pill" data-cheer="⛏️ Amazing Dig">⛏️ Amazing Dig</button>
          <button class="apple-btn btn-cheer-pill" data-cheer="💣 Crazy Kill">💣 Crazy Kill</button>
          <button class="apple-btn btn-cheer-pill" data-cheer="🔥 Ace!">🔥 Ace!</button>
          <button class="apple-btn btn-cheer-pill" data-cheer="💪 Big Block!">💪 Big Block!</button>
          <button class="apple-btn btn-cheer-pill" data-cheer="🎯 Cool Set">🎯 Cool Set</button>
        </div>

        <div style="display: flex; gap: 8px;">
          <button class="apple-btn frosted-glass btn-voice-mic" id="btn-voice-mic" title="Voice-to-Text Comment">
            🎙️
          </button>
          <button class="apple-btn frosted-glass btn-plus-cheer" id="btn-toggle-cheer" title="Cheer Pills">
            +
          </button>
        </div>
      </div>
    </div>
  `;const n=t.querySelector("#camera-feed"),r=t.querySelector("#simulated-canvas"),y=t.querySelector("#zone-left"),b=t.querySelector("#zone-right"),g=t.querySelector("#hint-left"),S=t.querySelector("#hint-right"),w=t.querySelector("#btn-set-counter"),v=t.querySelector("#btn-trigger-highlight"),C=t.querySelector("#btn-swap-sides"),M=t.querySelector("#btn-end-stream"),p=t.querySelector("#btn-toggle-cheer"),L=t.querySelector("#cheer-drawer"),u=t.querySelector("#btn-voice-mic"),B=t.querySelector("#lbl-team-left"),z=t.querySelector("#digit-left"),E=t.querySelector("#lbl-team-right"),D=t.querySelector("#digit-right"),_=t.querySelector("#card-left"),Y=t.querySelector("#card-right"),j=t.querySelector("#txt-viewer-count");async function K(){try{s=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}},audio:!0}),n.srcObject=s,n.style.display="block",r.style.display="none"}catch(i){console.warn("Real camera not available, falling back to simulated volleyball court:",i),se(r),n.style.display="none",r.style.display="block"}try{"wakeLock"in navigator&&(c=await navigator.wakeLock.request("screen"))}catch(i){console.log("Wake Lock request ignored or unsupported:",i)}}function O(){const i=d.getState().activeMatch;w.textContent=`SET ${i.currentSet}`,j.textContent=`(${i.viewers})`,i.courtSideUs==="left"?(B.textContent=i.teamUs,z.textContent=i.scoreUs,E.textContent=i.teamThem,D.textContent=i.scoreThem):(B.textContent=i.teamThem,z.textContent=i.scoreThem,E.textContent=i.teamUs,D.textContent=i.scoreUs)}function I(i,h,m,q){let N=0,F=0,k=!1;i.addEventListener("touchstart",T=>{N=T.touches[0].clientY,F=Date.now(),k=!1},{passive:!0}),i.addEventListener("touchmove",T=>{T.touches[0].clientY-N>45&&!k&&(k=!0,d.adjustScore(h,-1),x(m,"-1 POINT","red"),$(q,"down"))},{passive:!0}),i.addEventListener("touchend",T=>{const V=Date.now()-F;!k&&V<350&&(d.adjustScore(h,1),x(m,"+1 POINT","white"),$(q,"up"))}),i.addEventListener("click",T=>{"ontouchstart"in window||(d.adjustScore(h,1),x(m,"+1 POINT","white"),$(q,"up"))})}function x(i,h,m){i.textContent=h,i.style.color=m==="red"?"var(--accent-red)":"var(--text-primary)",i.style.opacity="1",setTimeout(()=>{i.style.opacity="0"},450)}function $(i,h){i.style.transform=h==="up"?"scale(1.08)":"translateY(6px) scale(0.96)",setTimeout(()=>{i.style.transform="scale(1)"},150)}I(y,"left",g,_),I(b,"right",S,Y),C.onclick=i=>{i.stopPropagation(),d.swapSides()},w.onclick=i=>{i.stopPropagation();const h=d.getState().activeMatch;confirm(`Finish Set ${h.currentSet} and advance to Set ${h.currentSet+1}? Current points will reset to 0-0.`)&&d.advanceSet()},v.onclick=i=>{i.stopPropagation(),d.triggerHighlight(),v.style.transform="scale(1.2)",v.textContent="✓ SAVED!",setTimeout(()=>{v.style.transform="scale(1)",v.textContent="⚡ HIGHLIGHT"},1200)},M.onclick=i=>{i.stopPropagation(),confirm("End the live broadcast and return to Home Hub?")&&(d.stopBroadcast(),A(),e("/"))},p.onclick=i=>{i.stopPropagation(),l=!l,L.style.display=l?"flex":"none",p.textContent=l?"✕":"+"},t.querySelectorAll(".btn-cheer-pill").forEach(i=>{i.onclick=h=>{h.stopPropagation();const m=i.dataset.cheer;d.postCheerPill(m),l=!1,L.style.display="none",p.textContent="+",x(g,m,"gold")}});const R=window.SpeechRecognition||window.webkitSpeechRecognition;R?(o=new R,o.continuous=!1,o.interimResults=!1,o.lang="en-US",o.onresult=i=>{const h=i.results[0][0].transcript;h&&(d.postChatMessage("Broadcaster",h),x(g,`"${h}"`,"white"))},o.onend=()=>{a=!1,u.classList.remove("listening")},u.onclick=i=>{if(i.stopPropagation(),a)o.stop();else try{o.start(),a=!0,u.classList.add("listening")}catch(h){console.warn("Speech recognition error:",h)}}):u.style.display="none";function A(){s&&s.getTracks().forEach(i=>i.stop()),c&&c.release().catch(()=>{})}K(),O();const J=d.subscribe(O);return()=>{A(),J()}}function se(t){const e=t.getContext("2d");let s=0;function c(){t.width=window.innerWidth,t.height=window.innerHeight}c(),window.addEventListener("resize",c);function a(){s++,e.fillStyle="#0f141c",e.fillRect(0,0,t.width,t.height);const o=t.height*.25,l=t.height*.65;e.fillStyle="#1c2430",e.fillRect(40,o,t.width-80,l),e.strokeStyle="#475569",e.lineWidth=3,e.strokeRect(40,o,t.width-80,l),e.strokeStyle="#94a3b8",e.setLineDash([8,6]),e.beginPath(),e.moveTo(t.width/2,o),e.lineTo(t.width/2,o+l),e.stroke(),e.setLineDash([]);const n=t.width/2+Math.sin(s*.04)*(t.width*.35),r=o+l*.5-Math.abs(Math.cos(s*.04))*(l*.3);e.fillStyle="#fef08a",e.beginPath(),e.arc(n,r,14,0,Math.PI*2),e.fill(),e.strokeStyle="#ca8a04",e.lineWidth=2,e.stroke(),requestAnimationFrame(a)}a()}function ie(t,e){let s=!0;t.innerHTML=`
    <div class="watcher-container">
      <!-- Main Video Area (Automatically resizes when sidebar opens) -->
      <div class="watcher-main" id="watcher-main">
        <div class="watcher-video-wrapper">
          <video class="watcher-video" id="live-player" autoplay playsinline muted loop>
            <!-- Sample high quality volleyball loop for demo testing -->
            <source src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" type="video/mp4" />
          </video>

          <!-- Top-Left Live Score Overlay -->
          <div class="watcher-score-overlay frosted-glass">
            <span class="live-badge"><span class="pulse-dot"></span> LIVE</span>
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: 13px; font-weight: 600;" id="w-opponent">vs. Lincoln High</span>
              <span class="tabular-nums" style="font-size: 20px; font-weight: 800;" id="w-score-line">18 - 16</span>
            </div>
            <div style="font-size: 12px; color: var(--text-secondary);" id="w-set-info">
              Set 2 • Sets: 1-0
            </div>
          </div>

          <!-- Top-Right Actions -->
          <div class="watcher-top-actions">
            <button class="apple-btn frosted-glass" id="btn-toggle-chat">
              💬 Chat
            </button>
            <button class="apple-btn frosted-glass" id="btn-back-hub">
              ✕ Exit
            </button>
          </div>
        </div>
      </div>

      <!-- Resizing Chat Sidebar (Shrinks video rather than overlaying) -->
      <aside class="watcher-sidebar" id="watcher-sidebar">
        <div class="chat-header">
          <h3>Family Cheering</h3>
          <button class="apple-btn" id="btn-close-sidebar" style="padding: 4px 10px; font-size: 12px;">✕</button>
        </div>

        <div class="chat-message-list" id="chat-messages">
          <!-- Chat bubbles populated dynamically -->
        </div>

        <div class="chat-input-row">
          <input type="text" class="chat-input" id="input-chat-msg" placeholder="Cheer for the team..." />
          <button class="apple-btn apple-btn-primary" id="btn-send-chat" style="padding: 8px 14px;">Send</button>
        </div>
      </aside>
    </div>
  `;const c=t.querySelector("#watcher-sidebar"),a=t.querySelector("#btn-toggle-chat"),o=t.querySelector("#btn-close-sidebar"),l=t.querySelector("#btn-back-hub"),n=t.querySelector("#chat-messages"),r=t.querySelector("#input-chat-msg"),y=t.querySelector("#btn-send-chat"),b=t.querySelector("#w-opponent"),g=t.querySelector("#w-score-line"),S=t.querySelector("#w-set-info");function w(){const p=d.getState().activeMatch;b.textContent=`vs. ${p.opponent}`,g.textContent=`${p.scoreUs} - ${p.scoreThem}`,S.textContent=`Set ${p.currentSet} • Sets: ${p.setsUs}-${p.setsThem}`;const L=d.getState().chat;n.innerHTML=L.map(u=>`
      <div class="chat-bubble">
        <div class="sender">${u.sender} ${u.score?`(Set ${u.set} • ${u.score})`:""}</div>
        <div style="font-weight: ${u.isCheer?"700":"400"}; color: ${u.isCheer?"var(--accent-gold)":"inherit"};">
          ${u.text}
        </div>
      </div>
    `).join(""),n.scrollTop=n.scrollHeight}function v(p){s=p,s?(c.classList.remove("collapsed"),a.style.display="none"):(c.classList.add("collapsed"),a.style.display="flex")}a.onclick=()=>v(!0),o.onclick=()=>v(!1),l.onclick=()=>e("/");function C(){const p=r.value.trim();p&&(d.postChatMessage("Family Viewer",p),r.value="")}y.onclick=C,r.onkeydown=p=>{p.key==="Enter"&&C()},w();const M=d.subscribe(w);return()=>{M()}}const U=document.getElementById("app");let f=null;function H(t){window.location.hash=t}function P(){const t=window.location.hash.slice(1)||"/";f&&(f(),f=null),U.innerHTML="",t==="/stream"?f=te(U,H):t==="/watch"?f=ie(U,H):f=Q(U,H)}window.addEventListener("hashchange",P);window.addEventListener("DOMContentLoaded",P);P();
