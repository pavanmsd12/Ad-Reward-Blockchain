// Paste addresses after Hardhat deployment here!
(async function() {
const config = {
  tokenAddress: "0x9a63583b0e3A99d11A8af77378921753772739Db",
  campaignManagerAddress: "0xd6e365B1994Fd86889fDCD2B2A3129a9c72a625a",
  adInteractionAddress: "0x009d89D007731E9cAEd14a72AfC4B35C1c7c6781",
  tokenSaleAddress: "0x1696f5a23eEDD33b86b0212DfD96b003d5C4DD90",
  backendUrl: "http://localhost:3001"
};

let sessionPhone = localStorage.getItem('adreward_phone');
let currentAccount = localStorage.getItem('adreward_wallet');

// Strict Dashboard Guard!! If no identity, kick back to auth.html immediately.
if (!sessionPhone || !currentAccount) {
  window.location.href = 'auth.html';
}

const tokenABI = [
  "function owner() view returns (address)",
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)"
];

const campaignManagerABI = [
  "function campaignCount() view returns (uint256)",
  "function createCampaign(string,string,uint256,uint256)",
  "function setCampaignActive(uint256,bool)",
  "function campaigns(uint256) view returns (address advertiser,string adName,string videoUrl,uint256 rewardPerView,uint256 remainingBudget,bool active)",
  "function getCampaign(uint256) view returns (address advertiser,string memory adName,string memory videoUrl,uint256 rewardPerView,uint256 remainingBudget,bool active)",
  "function withdrawRemainingBudget(uint256 campaignId)"
];

const adInteractionABI = [
  "function claimReward(uint256 campaignId, bytes calldata signature)",
  "function hasClaimed(address,uint256) view returns (bool)",
  "event AdClaimed(address indexed user, uint256 indexed campaignId, uint256 reward)"
];

const tokenSaleABI = [
  "function buyTokens() payable",
  "function sellTokens(uint256 tokenAmount)",
  "function tokensPerEth() view returns (uint256)",
  "function getSaleTokenBalance() view returns (uint256)",
  "function getSaleEthBalance() view returns (uint256)"
];

let tokenSale, provider, signer, rewardToken, campaignManager, adInteraction;
let currentCampaignId = null;

const UI = {
  accountValue: document.getElementById("accountValue"),
  balanceValue: document.getElementById("balanceValue"),
  statusBox: document.getElementById("status"),
  campaignList: document.getElementById("campaignList"),
  historyBox: document.getElementById("history"),
  historySummary: document.getElementById("historySummary"),
  totalEarned: document.getElementById("totalEarned"),
  watchPlaceholder: document.getElementById("watchPlaceholder"),
  adSection: document.getElementById("adSection"),
  watchingTag: document.getElementById("watchingTag"),
  timer: document.getElementById("timer"),
  claimBtn: document.getElementById("claimBtn"),
  adVideo: document.getElementById("adVideo"),
  tokenRateValue: document.getElementById("tokenRateValue"),
  saleBalanceValue: document.getElementById("saleBalanceValue"),
  myCampaignList: document.getElementById("myCampaignList"),
};

function showSection(id) {
  document.querySelectorAll(".section").forEach(s => s.classList.toggle("active", s.id === id));
  document.querySelectorAll("[data-tab-btn]").forEach(b => b.classList.toggle("active", b.dataset.tabBtn === id));
}

function setStatus(msg, type = "") {
  UI.statusBox.className = type ? `status ${type}` : "status";
  UI.statusBox.textContent = msg;
}

function ensureReady() {
  if (!window.ethereum) { setStatus("MetaMask is missing.", "error"); return false; }
  if (!rewardToken) { setStatus("Dashboard syncing...", "error"); return false; }
  return true;
}

function shortAddr(addr) { return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "None"; }
function escapeHtml(v) { return String(v).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]); }
function formatART(amount) { return ethers.formatEther(amount); }
function parseART(amount) { return ethers.parseEther(amount.toString()); }

function renderHeaderAuth() {
  const nav = document.getElementById('authNav');
  nav.innerHTML = `
    <span class="tag" style="margin:0; padding:6px 12px; background:rgba(99,102,241,0.2); color:var(--accent);">💎 <span id="headerBal">0</span> ART</span>
    <span class="tag" style="margin:0; padding:6px 12px; background:rgba(16,185,129,0.2); color:var(--success);">📱 ${sessionPhone} | ${shortAddr(currentAccount)}</span>
    <button class="btn-secondary" style="padding: 6px 12px;" onclick="logOut()">Sign Out</button>
  `;
}

function logOut() {
  localStorage.removeItem('adreward_phone');
  localStorage.removeItem('adreward_wallet');
  window.location.href = 'auth.html';
}

async function bootDashboard() {
  try {
    if (!window.ethereum) throw new Error("Please install MetaMask to interact with the blockchain.");

    // STRICT IDENTITY GUARD: Ensure the active wallet perfectly matches their session identity
    const activeAccs = await window.ethereum.request({ method: "eth_accounts" });
    if (!activeAccs.length || activeAccs[0].toLowerCase() !== currentAccount.toLowerCase()) {
      alert(`Identity Mismatch! Please switch your MetaMask back to your Verified Wallet: ${shortAddr(currentAccount)}`);
      return logOut();
    }

    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner(currentAccount);

    rewardToken = new ethers.Contract(config.tokenAddress, tokenABI, signer);
    campaignManager = new ethers.Contract(config.campaignManagerAddress, campaignManagerABI, signer);
    adInteraction = new ethers.Contract(config.adInteractionAddress, adInteractionABI, signer);
    tokenSale = new ethers.Contract(config.tokenSaleAddress, tokenSaleABI, signer);

    UI.accountValue.textContent = shortAddr(currentAccount);
    setStatus("Dashboard Synced & Authenticated via Phone", "success");
    renderHeaderAuth();
    await refreshDashboard();
  } catch (e) {
    setStatus("Dashboard failed to boot: " + e.message, "error");
  }
}

async function refreshDashboard() {
  if (!ensureReady()) return;
  await Promise.all([checkBalance(), loadTokenSaleInfo(), loadCampaigns(), loadMyCampaigns(), loadHistory()]);
}

async function checkBalance() {
  const bal = await rewardToken.balanceOf(currentAccount);
  UI.balanceValue.textContent = `${formatART(bal)} ART`;

  const headerBal = document.getElementById("headerBal");
  if (headerBal) headerBal.textContent = formatART(bal);
}

async function loadTokenSaleInfo() {
  try {
    const rate = await tokenSale.tokensPerEth();
    UI.tokenRateValue.textContent = `${rate.toString()} ART/ETH`;
    UI.saleBalanceValue.textContent = `${formatART(await tokenSale.getSaleTokenBalance())} ART`;
  } catch (e) { }
}

async function buyTokens() {
  if (!ensureReady()) return;
  const amount = document.getElementById("buyEthAmount").value;
  if (!amount || amount <= 0) return setStatus("Invalid ETH", "error");
  try {
    setStatus("Approving transaction...");
    const tx = await tokenSale.buyTokens({ value: ethers.parseEther(amount) });
    await tx.wait();
    setStatus("ART purchased!", "success");
    await refreshDashboard();
  } catch (e) { setStatus(e.reason || "Purchase failed", "error"); }
}

async function sendTokens() {
  if (!ensureReady()) return;
  const to = document.getElementById("fundAddress").value;
  const amt = document.getElementById("fundAmount").value;
  try {
    setStatus("Sending ART...");
    const tx = await rewardToken.transfer(to, parseART(amt));
    await tx.wait();
    setStatus("Tokens sent!", "success");
    await refreshDashboard();
  } catch (e) { setStatus(e.reason || "Send failed", "error"); }
}

async function approveSellTokens() {
  if (!ensureReady()) return;
  const amt = document.getElementById("sellTokenAmount").value;
  try {
    const tx = await rewardToken.approve(config.tokenSaleAddress, parseART(amt));
    setStatus("Approving...", "");
    await tx.wait();
    setStatus("Approved!", "success");
  } catch (e) { setStatus(e.reason || "Approve failed", "error"); }
}

async function sellTokens() {
  if (!ensureReady()) return;
  const amt = document.getElementById("sellTokenAmount").value;
  try {
    const tx = await tokenSale.sellTokens(parseART(amt));
    setStatus("Selling...", "");
    await tx.wait();
    setStatus("Sold for ETH!", "success");
    await refreshDashboard();
  } catch (e) { setStatus(e.reason || "Sell failed", "error"); }
}

async function approveBudget() {
  if (!ensureReady()) return;
  const bg = document.getElementById("budget").value;
  try {
    setStatus("Approving Budget...");
    const tx = await rewardToken.approve(config.campaignManagerAddress, parseART(bg));
    await tx.wait();
    setStatus("Budget Approved!", "success");
  } catch (e) { setStatus(e.reason || "Approve failed", "error"); }
}

async function createCampaign() {
  if (!ensureReady()) return;
  const n = document.getElementById("adName").value;
  const v = document.getElementById("videoUrl").value;
  const r = document.getElementById("reward").value;
  const b = document.getElementById("budget").value;
  try {
    setStatus("Deploying campaign...");
    const tx = await campaignManager.createCampaign(n, v, parseART(r), parseART(b));
    await tx.wait();
    setStatus("Campaign Active!", "success");
    await refreshDashboard();
  } catch (e) { setStatus(e.reason || "Campaign sync failed", "error"); }
}

function buildCardHtml(i, c, isOwn, claimed) {
  let action = `<button data-campaign-id="${i}" class="btn-primary watch-btn" style="width:100%">Watch & Earn</button>`;
  if (!c.active) action = `<button disabled style="width:100%">Ended</button>`;
  else if (isOwn) action = `<button data-campaign-id="${i}" class="btn-secondary deactivate-btn" style="width:100%">Deactivate</button>`;
  else if (claimed) action = `<button disabled style="width:100%">Claimed</button>`;

  return `
    <div class="campaign-card">
      <div class="tag">#${i} ${isOwn ? '(Yours)' : ''}</div>
      <h3 style="margin-top:0">${escapeHtml(c.adName)}</h3>
      <div class="campaign-meta" style="margin: 15px 0;">
         <div><strong>Value</strong>${formatART(c.rewardPerView)} ART</div>
         <div><strong>Pool</strong>${formatART(c.remainingBudget)} ART</div>
      </div>
      ${action}
    </div>
  `;
}

async function loadCampaigns() {
  const count = Number(await campaignManager.campaignCount());
  const cList = [];
  for (let i = 1; i <= count; i++) {
    const c = await campaignManager.campaigns(i);
    if (!c.active) continue;
    const isOwn = c.advertiser.toLowerCase() === currentAccount.toLowerCase();
    const claimed = await adInteraction.hasClaimed(currentAccount, i);
    cList.push(buildCardHtml(i, c, isOwn, claimed));
  }
  UI.campaignList.innerHTML = cList.length ? cList.join('') : `<div class="empty">No campaigns</div>`;
}

async function loadMyCampaigns() {
  const count = Number(await campaignManager.campaignCount());
  const cList = [];
  for (let i = 1; i <= count; i++) {
    const c = await campaignManager.campaigns(i);
    if (c.advertiser.toLowerCase() !== currentAccount.toLowerCase()) continue;

    const action = c.active
      ? `<button class="btn-secondary" style="width:100%" onclick="deactivateCampaign(${i})">Stop Campaign</button>`
      : `<button class="btn-primary" style="width:100%" onclick="withdrawRemainingBudget(${i})">Reclaim Budget</button>`;

    cList.push(`
      <div class="campaign-card">
        <div class="tag">#${i}</div>
        <h3 style="margin-top:0">${escapeHtml(c.adName)}</h3>
        <div class="campaign-meta" style="margin: 15px 0;">
          <div><strong>Value</strong>${formatART(c.rewardPerView)} ART</div>
          <div><strong>Left</strong>${formatART(c.remainingBudget)} ART</div>
        </div>
        ${action}
      </div>
    `);
  }
  UI.myCampaignList.innerHTML = cList.length ? cList.join('') : `<div class="empty">No campaigns found</div>`;
}

async function deactivateCampaign(id) {
  if (!ensureReady()) return;
  const tx = await campaignManager.setCampaignActive(id, false);
  setStatus("Deactivating...", ""); await tx.wait(); refreshDashboard();
}

async function withdrawRemainingBudget(id) {
  if (!ensureReady()) return;
  try {
    setStatus("Withdrawing budget...", "");
    const tx = await campaignManager.withdrawRemainingBudget(id);
    await tx.wait();
    setStatus("Budget withdrawn successfully!", "success");
    await refreshDashboard();
  } catch (e) {
    setStatus(e.reason || e.message || "Withdrawal failed", "error");
  }
}

async function watchAd(id) {
  if (!ensureReady()) return;
  const c = await campaignManager.campaigns(id);

  currentCampaignId = id; UI.watchingTag.textContent = c.adName; UI.claimBtn.disabled = true;
  UI.timer.textContent = "Verifying view integrity...";

  try {
    const res = await fetch(`${config.backendUrl}/watch/start`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: currentAccount, campaignId: id })
    });
    
    if (!res.ok) {
      const errPayload = await res.json();
      throw new Error("Backend Refused: " + errPayload.error);
    }

    UI.watchPlaceholder.style.display = "none"; UI.adSection.style.display = "block";
    UI.adVideo.src = c.videoUrl; UI.adVideo.load(); 
    
    showSection("rewards");

    // Force strict fullscreen upon play
    try {
      if (UI.adVideo.requestFullscreen) await UI.adVideo.requestFullscreen();
      else if (UI.adVideo.webkitRequestFullscreen) await UI.adVideo.webkitRequestFullscreen();
    } catch (e) { console.log('Fullscreen initialization warning: ', e); }

    await UI.adVideo.play();

    // Anti-Cheat Cryptographic Time Profiler
    let trackedTime = 0;
    let lastTimeObj = 0;
    let trackingValid = true;

    const timeTracker = () => {
      if (!trackingValid || UI.adVideo.paused) return;
      const t = UI.adVideo.currentTime;
      const diff = t - lastTimeObj;
      if (diff > 0 && diff <= 1.0) {
        trackedTime += diff;
      } else if (diff > 1.0) {
        trackingValid = false;
        UI.adVideo.pause();
        setStatus("Anti-Cheat: Time skip logic override detected. Refresh.", "error");
      }
      lastTimeObj = t;
    };

    const seekHandler = () => { lastTimeObj = UI.adVideo.currentTime; };
    UI.adVideo.addEventListener("timeupdate", timeTracker);
    UI.adVideo.addEventListener("seeked", seekHandler);

    // Attach strict anti-cheat handlers
    const antiCheatHandler = () => {
      const activeFocus = document.hasFocus();
      if (document.hidden || !document.fullscreenElement || !activeFocus) {
        UI.adVideo.pause();
        setStatus("Playback Paused: Keep video maximized and actively focused.", "error");
      } else if (document.fullscreenElement && !document.hidden && activeFocus && !UI.adVideo.ended) {
        UI.adVideo.play().then(() => setStatus("Playback Resumed.", "success")).catch(()=>{});
      }
    };

    const enforceFullscreenPlay = () => {
      if (!document.fullscreenElement || !document.hasFocus()) {
        UI.adVideo.pause();
        setStatus("Anti-Cheat: Please Maximize and focus the player to resume.", "error");
      }
    };

    document.addEventListener("visibilitychange", antiCheatHandler);
    document.addEventListener("fullscreenchange", antiCheatHandler);
    window.addEventListener("blur", antiCheatHandler);
    window.addEventListener("focus", antiCheatHandler);
    UI.adVideo.addEventListener("play", enforceFullscreenPlay);

    UI.adVideo.onended = async () => {
      UI.adVideo.removeEventListener("timeupdate", timeTracker);
      UI.adVideo.removeEventListener("seeked", seekHandler);
      document.removeEventListener("visibilitychange", antiCheatHandler);
      document.removeEventListener("fullscreenchange", antiCheatHandler);
      window.removeEventListener("blur", antiCheatHandler);
      window.removeEventListener("focus", antiCheatHandler);
      UI.adVideo.removeEventListener("play", enforceFullscreenPlay);
      if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});

      if (!trackingValid || trackedTime < (UI.adVideo.duration - 1.0)) {
        return setStatus("Anti-Cheat: Video event spoofing rejected.", "error");
      }

      const cmpRes = await fetch(`${config.backendUrl}/watch/complete`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: currentAccount, campaignId: id })
      });
      if (!cmpRes.ok) return setStatus("Backend Refused: " + (await cmpRes.json()).error, "error");
      
      UI.claimBtn.disabled = false; UI.timer.textContent = "Proof-of-View Secured. Claim Ready.";
      setStatus("Video Complete", "success");
    };
  } catch (e) { setStatus("Start error: " + e.message, "error"); }
}

async function claimReward() {
  if (!ensureReady()) return;
  setStatus("Requesting Cryptographic Signature...", "");
  try {
    const sigRes = await fetch(`${config.backendUrl}/watch/sign`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: currentAccount, campaignId: currentCampaignId })
    });

    if (!sigRes.ok) throw new Error("PoV Signature Request Failed.");
    const { signature } = await sigRes.json();

    setStatus("Submitting Proof-of-View to Blockchain...", "");
    const tx = await adInteraction.claimReward(currentCampaignId, signature);
    await tx.wait();

    setStatus("Reward Verified & Claimed!", "success");
    UI.claimBtn.disabled = true; currentCampaignId = null;
    UI.adSection.style.display = "none"; UI.watchPlaceholder.style.display = "block";
    await refreshDashboard();
  } catch (e) { setStatus(e.reason || e.message || "Claim Failed", "error"); }
}

async function loadHistory() {
  UI.historySummary.style.display = "none";
  UI.historyBox.innerHTML = '<div class="empty" style="animation: pulse 1.5s infinite;">Scanning Decentralized Blockchain Ledger...</div>';
  
  try {
    const filter = adInteraction.filters.AdClaimed(currentAccount);
    const events = await adInteraction.queryFilter(filter);
    
    if (!events || events.length === 0) {
      UI.historyBox.innerHTML = '<div class="empty">No past transactions found on-chain.</div>';
      return;
    }

    let t = 0n;
    const hList = [];

    const historyData = await Promise.all(events.map(async (ev) => {
      const block = await provider.getBlock(ev.blockNumber);
      return {
        campaign_id: Number(ev.args[1]),
        reward: ev.args[2],
        tx_hash: ev.transactionHash,
        timestamp: block ? block.timestamp * 1000 : Date.now()
      };
    }));
    
    historyData.sort((a, b) => b.timestamp - a.timestamp);

    for (const r of historyData) {
      t += r.reward;
      
      let adName = "Unknown Campaign";
      try {
        const camp = await campaignManager.campaigns(r.campaign_id);
        adName = camp.adName;
      } catch (err) { }

      const watchDate = new Date(r.timestamp).toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });

      hList.push(`
         <div class="history-card" style="margin-bottom: 15px;">
           <div style="font-size: 13px; color: var(--accent); margin-bottom: 5px; font-weight: bold;">Ad: ${escapeHtml(adName)} (Camp. ID: ${r.campaign_id})</div>
           <div><strong style="color: white; font-size:18px">+ ${formatART(r.reward)} ART</strong></div>
           <div style="color: var(--muted); font-size: 12px; margin-top: 10px; display: flex; justify-content: space-between;">
             <span>Watched: ${watchDate}</span>
             <span>TX: ${shortAddr(r.tx_hash)}</span>
           </div>
         </div>
       `);
    }

    UI.totalEarned.textContent = `${formatART(t)} ART`;
    UI.historySummary.style.display = "block";
    UI.historyBox.innerHTML = hList.join('');
    
  } catch (e) { 
    UI.historyBox.innerHTML = '<div class="empty" style="color: var(--error)">Failed to sync ledger from Blockchain.</div>';
  }
}

window.ethereum?.on("accountsChanged", (accounts) => {
  if (!accounts.length || accounts[0].toLowerCase() !== currentAccount.toLowerCase()) {
    alert("Unauthorized wallet change detected for this session.");
    logOut();
  } else {
    location.reload();
  }
});

// Boot the dashboard immediately
bootDashboard();

// Bind DOM handlers inside IIFE
document.querySelectorAll('[data-tab-btn]').forEach(btn => {
  btn.addEventListener('click', (e) => showSection(e.target.dataset.tabBtn));
});

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('watch-btn')) {
    watchAd(Number(e.target.dataset.campaignId));
  } else if (e.target.classList.contains('deactivate-btn')) {
    deactivateCampaign(Number(e.target.dataset.campaignId));
  }
});

document.getElementById('btn-buyTokens').addEventListener('click', buyTokens);
document.getElementById('btn-sendTokens').addEventListener('click', sendTokens);
document.getElementById('btn-approveSellTokens').addEventListener('click', approveSellTokens);
document.getElementById('btn-sellTokens').addEventListener('click', sellTokens);
document.getElementById('btn-approveBudget').addEventListener('click', approveBudget);
document.getElementById('btn-createCampaign').addEventListener('click', createCampaign);
document.getElementById('btn-refreshNetwork').addEventListener('click', loadCampaigns);
document.getElementById('claimBtn').addEventListener('click', claimReward);
document.getElementById('btn-syncChain').addEventListener('click', loadHistory);

// Cyber Network Background
tsParticles.load('tsparticles', {
  background: { color: { value: 'transparent' } },
  fpsLimit: 60,
  particles: {
    color: { value: '#00ffcc' },
    links: { color: '#6366f1', distance: 150, enable: true, opacity: 0.4, width: 1 },
    move: { enable: true, speed: 1.5, direction: 'none', random: false, straight: false, outModes: 'bounce' },
    number: { density: { enable: true, area: 800 }, value: 60 },
    opacity: { value: 0.5 },
    shape: { type: 'circle' },
    size: { value: { min: 1, max: 3 } }
  },
  detectRetina: true
});

})();
