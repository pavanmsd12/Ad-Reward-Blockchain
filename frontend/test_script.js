
    // Paste addresses after Hardhat deployment here!
    const config = {
      tokenAddress: "0xe70cFcfF05cA266045dB4CAECa5c7eD339555Ab2",
      campaignManagerAddress: "0x2530CEF4cD30Ad81EbF3EF83310F41552C6FC458",
      adInteractionAddress: "0xEdc9b6F65eD381C3672bB5068c02730352F652a1",
      tokenSaleAddress: "0x8850d5486b38c57bc60eC20806c14531A7821222",
      backendUrl: "http://localhost:3001"
    };

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
    let currentAccount = "";
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
      if (!rewardToken) { setStatus("Connect wallet first.", "error"); return false; }
      return true;
    }

    function shortAddr(addr) { return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "None"; }
    function escapeHtml(v) { return String(v).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]); }
    function formatART(amount) { return ethers.formatEther(amount); }
    function parseART(amount) { return ethers.parseEther(amount.toString()); }

    let sessionPhone = localStorage.getItem('adreward_phone');
    let authMode = 'signup';
    let currentAccountTemp = "";

    function initAuthUI() {
      const nav = document.getElementById('authNav');
      if (sessionPhone) {
        nav.innerHTML = `<span class="tag" style="margin:0; padding:6px 12px; background:rgba(16,185,129,0.2); color:var(--success);">📱 ${sessionPhone}</span>
                         <button class="btn-secondary" style="padding: 6px 12px;" onclick="logOut()">Sign Out</button>`;
      } else {
        nav.innerHTML = `<button class="btn-secondary" style="padding: 6px 12px;" onclick="openAuthModal('signin')">Sign In</button>
                         <button class="btn-primary" style="padding: 6px 12px;" onclick="openAuthModal('signup')">Sign Up</button>`;
      }
    }

    function logOut() {
      localStorage.removeItem('adreward_phone');
      sessionPhone = null; currentAccount = "";
      UI.accountValue.textContent = "Not connected";
      UI.statusBox.textContent = "Logged out securely.";
      initAuthUI();
    }

    function openAuthModal(mode) {
      if (sessionPhone) return setStatus("You are already signed in.", "error");
      authMode = mode;
      document.getElementById('authModal').classList.add('active');
      document.getElementById('authViewPhone').style.display = 'block';
      document.getElementById('authViewOtp').style.display = 'none';
      document.getElementById('authError').style.display = 'none';

      document.getElementById('authTitle').textContent = mode === 'signup' ? 'Sign Up' : 'Sign In';
      document.getElementById('authDesc').textContent = mode === 'signup' ? 'Create account & link MetaMask.' : 'Log in to your existing account.';
      document.getElementById('authSendBtn').textContent = mode === 'signup' ? 'Connect Wallet & Send OTP' : 'Send Login OTP';
    }

    function closeAuthModal() { document.getElementById('authModal').classList.remove('active'); }

    async function connectWallet() {
      if (!sessionPhone) return openAuthModal('signup');

      // Secondary check if they hit connect wallet to sync the state
      if (!window.ethereum) return setStatus("Install MetaMask", "error");
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (currentAccount && accounts[0].toLowerCase() !== currentAccount.toLowerCase()) {
        return setStatus(`Please switch your MetaMask back to ${shortAddr(currentAccount)}`, "error");
      }
      if (!currentAccount) return setStatus("Please Sign Out and Sign back in.", "error");
      await finalizeConnect(currentAccount);
    }

    async function submitAuthPhone() {
      const phone = document.getElementById('authPhone').value;
      const errEl = document.getElementById('authError'); errEl.style.display = 'none';

      try {
        if (authMode === 'signup') {
          if (!window.ethereum) throw new Error("Please install MetaMask to sign up.");
          provider = new ethers.BrowserProvider(window.ethereum);
          const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
          currentAccountTemp = accounts[0];

          setStatus("Linking wallet & requesting OTP...");
          const res = await fetch(`${config.backendUrl}/auth/send-otp-signup`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone, user: currentAccountTemp })
          });
          if (!res.ok) throw new Error((await res.json()).error);
        } else {
          const res = await fetch(`${config.backendUrl}/auth/send-otp-signin`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone })
          });
          if (!res.ok) throw new Error((await res.json()).error);
        }

        document.getElementById('authViewPhone').style.display = 'none';
        document.getElementById('authViewOtp').style.display = 'block';
        setStatus("Check backend terminal for OTP!", "success");
      } catch (e) { errEl.textContent = e.message; errEl.style.display = 'block'; }
    }

    async function submitAuthOtp() {
      const phone = document.getElementById('authPhone').value;
      const otp = document.getElementById('authOtp').value;
      const errEl = document.getElementById('authError'); errEl.style.display = 'none';

      try {
        if (authMode === 'signup') {
          const res = await fetch(`${config.backendUrl}/auth/verify-signup`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone, otp })
          });
          if (!res.ok) throw new Error((await res.json()).error);

          sessionPhone = phone;
          localStorage.setItem('adreward_phone', sessionPhone);
          localStorage.setItem('adreward_wallet', currentAccountTemp);
          closeAuthModal();
          await finalizeConnect(currentAccountTemp);
        } else {
          const res = await fetch(`${config.backendUrl}/auth/verify-signin`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone, otp })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);

          sessionPhone = phone;
          localStorage.setItem('adreward_phone', sessionPhone);
          localStorage.setItem('adreward_wallet', data.linkedWallet);
          closeAuthModal();
          // Log them in using the wallet tied securely to their phone from the DB!
          await finalizeConnect(data.linkedWallet);
        }
      } catch (e) { errEl.textContent = e.message; errEl.style.display = 'block'; }
    }

    async function finalizeConnect(walletAddr) {
      currentAccount = walletAddr;
      provider = new ethers.BrowserProvider(window.ethereum);
      signer = await provider.getSigner(currentAccount);

      rewardToken = new ethers.Contract(config.tokenAddress, tokenABI, signer);
      campaignManager = new ethers.Contract(config.campaignManagerAddress, campaignManagerABI, signer);
      adInteraction = new ethers.Contract(config.adInteractionAddress, adInteractionABI, signer);
      tokenSale = new ethers.Contract(config.tokenSaleAddress, tokenSaleABI, signer);

      UI.accountValue.textContent = shortAddr(currentAccount);
      setStatus("Wallet Authenticated via Phone", "success");
      initAuthUI();
      await refreshDashboard();
    }

    async function refreshDashboard() {
      if (!ensureReady()) return;
      await Promise.all([checkBalance(), loadTokenSaleInfo(), loadCampaigns(), loadMyCampaigns(), loadHistory()]);
    }

    async function checkBalance() {
      const bal = await rewardToken.balanceOf(currentAccount);
      UI.balanceValue.textContent = `${formatART(bal)} ART`;
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
      let action = `<button class="btn-primary" style="width:100%" onclick="watchAd(${i})">Watch & Earn</button>`;
      if (!c.active) action = `<button disabled style="width:100%">Ended</button>`;
      else if (isOwn) action = `<button class="btn-secondary" style="width:100%" onclick="deactivateCampaign(${i})">Deactivate</button>`;
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
      // Removed restriction for testnet: allow users to watch their own ads

      currentCampaignId = id; UI.watchingTag.textContent = c.adName; UI.claimBtn.disabled = true;
      UI.timer.textContent = "Verifying view integrity...";

      try {
        await fetch(`${config.backendUrl}/watch/start`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user: currentAccount, campaignId: id })
        });

        UI.watchPlaceholder.style.display = "none"; UI.adSection.style.display = "block";
        UI.adVideo.src = c.videoUrl; UI.adVideo.load(); await UI.adVideo.play();
        showSection("rewards");

        UI.adVideo.onended = async () => {
          await fetch(`${config.backendUrl}/watch/complete`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user: currentAccount, campaignId: id })
          });
          UI.claimBtn.disabled = false; UI.timer.textContent = "Proof-of-View Secured. Claim Ready.";
          setStatus("Video Complete", "success");
        };
      } catch (e) { setStatus("Start error", "error"); }
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
      try {
        const res = await fetch(`${config.backendUrl}/history/${currentAccount}`);
        const rows = res.ok ? await res.json() : [];
        if (!rows.length) { UI.historySummary.style.display = "none"; UI.historyBox.innerHTML = ''; return; }

        let t = 0n; const hList = [];

        // Render rows dynamically
        for (const r of rows) {
          // Parse string directly to BigInt to avoid float conversion data loss on 18 decimals
          let val = 0n;
          try {
            // Remove decimals if any exist from PG numeric response, then cast to BigInt directly
            val = BigInt(r.reward.toString().split('.')[0]);
            t += val;
          } catch (e) { }

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
      } catch (e) { }
    }

    window.ethereum?.on("accountsChanged", () => location.reload());

    // Initialize Auth UI on load
    initAuthUI();
    if (sessionPhone) finalizeConnect(localStorage.getItem('adreward_wallet'));
  
