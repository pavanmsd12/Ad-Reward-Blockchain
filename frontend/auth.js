(async function() {
const BACKEND_URL = "http://localhost:3001";
let authMode = 'signin';
let activePhone = '';

if (localStorage.getItem('adreward_phone') && localStorage.getItem('adreward_wallet')) {
  window.location.href = 'index.html';
}

function switchTab(mode) {
  authMode = mode;
  document.getElementById('tab-signin').classList.toggle('active', mode === 'signin');
  document.getElementById('tab-signup').classList.toggle('active', mode === 'signup');
  document.getElementById('form-title').textContent = mode === 'signin' ? 'Welcome Back' : 'Create Account';
  document.getElementById('form-desc').textContent = mode === 'signin' ? 'Enter your phone number to sign in.' : 'Register your phone to start earning ad rewards.';
  showStep('step-phone');
  clearErrors();
}

function showStep(stepId) {
  document.querySelectorAll('.auth-step').forEach(s => s.classList.remove('active'));
  document.getElementById(stepId).classList.add('active');
}

function clearErrors() {
  document.getElementById('authError').style.display = 'none';
  document.getElementById('authSuccess').style.display = 'none';
}

function showError(msg) {
  const el = document.getElementById('authError');
  el.textContent = msg; el.style.display = 'block';
  document.getElementById('authSuccess').style.display = 'none';
}

function showSuccess(msg) {
  const el = document.getElementById('authSuccess');
  el.textContent = msg; el.style.display = 'block';
  document.getElementById('authError').style.display = 'none';
}

async function submitPhone() {
  clearErrors();
  const phone = document.getElementById('authPhone').value;
  if (!phone || phone.length < 10) return showError("Enter a valid phone number.");

  try {
    const route = authMode === 'signup' ? '/auth/send-otp-signup' : '/auth/send-otp-signin';
    const res = await fetch(`${BACKEND_URL}${route}`, {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ phone })
    });
    
    if (!res.ok) throw new Error((await res.json()).error);
    
    activePhone = phone;
    showStep('step-otp');
    showSuccess("OTP sent to terminal! Please check.");
  } catch (e) { showError(e.message); }
}

async function submitOtp() {
  clearErrors();
  const otp = document.getElementById('authOtp').value;
  if (!otp) return showError("Enter the OTP.");

  try {
    const route = authMode === 'signup' ? '/auth/verify-signup' : '/auth/verify-signin';
    const res = await fetch(`${BACKEND_URL}${route}`, {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ phone: activePhone, otp })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    if (authMode === 'signup') {
      showStep('step-wallet');
      document.querySelector('.auth-tabs').style.display = 'none';
      showSuccess("Phone verified! Please map your MetaMask wallet.");
    } else {
      localStorage.setItem('adreward_phone', activePhone);
      localStorage.setItem('adreward_wallet', data.linkedWallet);
      window.location.href = 'index.html';
    }
  } catch (e) { showError(e.message); }
}

async function connectWallet() {
  clearErrors();
  if (!window.ethereum) return showError("MetaMask is not installed.");
  
  try {
    await window.ethereum.request({
      method: "wallet_requestPermissions",
      params: [{ eth_accounts: {} }]
    });
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    const wallet = accounts[0];
    await linkWalletToBackend(wallet);
  } catch (e) { showError("Wallet connection failed or was rejected."); }
}

async function linkManualWallet() {
  clearErrors();
  const wallet = document.getElementById('manualWallet').value;
  if (!/^0x[a-fA-F0-9]{40}$/.test(String(wallet))) return showError("Invalid Ethereum Address.");
  await linkWalletToBackend(wallet);
}

async function linkWalletToBackend(wallet) {
  try {
    const res = await fetch(`${BACKEND_URL}/auth/link-wallet`, {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ phone: activePhone, user: wallet })
    });
    if (!res.ok) throw new Error((await res.json()).error);
    
    localStorage.setItem('adreward_phone', activePhone);
    localStorage.setItem('adreward_wallet', wallet);
    showSuccess("Wallet linked! Redirecting...");
    setTimeout(() => { window.location.href = 'index.html'; }, 1000);
  } catch(e) { showError(e.message); }
}

// Bind DOM handlers inside IIFE
document.getElementById('tab-signin').addEventListener('click', () => switchTab('signin'));
document.getElementById('tab-signup').addEventListener('click', () => switchTab('signup'));
document.getElementById('btn-submitPhone').addEventListener('click', submitPhone);
document.getElementById('btn-submitOtp').addEventListener('click', submitOtp);
document.getElementById('connectMetaMaskBtn').addEventListener('click', connectWallet);
document.getElementById('btn-linkManualWallet').addEventListener('click', linkManualWallet);

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
