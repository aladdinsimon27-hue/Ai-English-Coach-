// AI EduSchool - Bulletproof Build with Smart Fallback

const GEMINI_URL = 'https://gemini-web2api-for-edu.onrender.com/v1/chat/completions';
const GEMINI_MODEL = 'gemini-3.6-flash';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'openai/gpt-oss-20b'; // Reliable fast model

let profile = JSON.parse(localStorage.getItem('eduProfile')) || null;
let currentSheetTarget = null;
let selectedFiles = { general: null, tutor: null };
let isProcessing = false;

// --- WIZARD LOGIC ---
function nextStep(step) {
    if (step === 2 && !document.getElementById('input-name').value.trim()) return alert("Please enter your name");
    document.querySelectorAll('.wizard-step').forEach(s => s.classList.add('hidden'));
    document.getElementById(`step-${step}`).classList.remove('hidden');
    document.getElementById('wizard-progress-bar').style.width = `${(step / 3) * 100}%`;
}

function finishOnboarding() {
    profile = {
        name: document.getElementById('input-name').value.trim(),
        grade: document.getElementById('input-grade').value,
        curriculum: document.getElementById('input-curriculum').value,
        xp: 0, level: 1
    };
    localStorage.setItem('eduProfile', JSON.stringify(profile));
    checkAppState();
}

// --- APP INIT ---
function checkAppState() {
    if (!profile) {
        document.getElementById('onboarding').style.display = 'flex';
        document.getElementById('app-shell').classList.add('hidden');
    } else {
        document.getElementById('onboarding').style.display = 'none';
        document.getElementById('app-shell').classList.remove('hidden');
        loadDashboard();
        switchTab('dashboard-screen', document.getElementById('nav-home'));
    }
}

function loadDashboard() {
    document.getElementById('dash-name').textContent = profile.name;
    document.getElementById('dash-context').textContent = `Grade ${profile.grade} • ${profile.curriculum}`;
    document.getElementById('dash-level').textContent = profile.level;
    document.getElementById('dash-xp-bar').style.width = `${(profile.xp % (profile.level * 100)) / (profile.level * 100) * 100}%`;
    
    document.getElementById('prof-name-display').textContent = profile.name;
    document.getElementById('prof-grade-display').textContent = `Grade ${profile.grade} • ${profile.curriculum}`;
}

function resetApp() { if (confirm("Erase all data?")) { localStorage.clear(); location.reload(); } }

// --- NAVIGATION ---
function switchTab(screenId, btn) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
    
    if (screenId === 'general-chat-screen' || screenId === 'tutor-chat-screen') {
        document.getElementById('main-nav').classList.add('hidden');
    } else {
        document.getElementById('main-nav').classList.remove('hidden');
        if (btn) {
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        }
    }
}

function closeChat(returnScreen) {
    document.getElementById('general-chat-screen').classList.add('hidden');
    document.getElementById('tutor-chat-screen').classList.add('hidden');
    switchTab(returnScreen, document.getElementById('nav-home'));
}

// --- SUBJECT LOGIC ---
function openSubject(sub) {
    document.getElementById('subject-selector').value = sub;
    document.getElementById('tutor-subject-title').textContent = sub;
    document.getElementById('tutor-chat-screen').classList.remove('hidden');
    document.getElementById('main-nav').classList.add('hidden'); 
    
    const area = document.getElementById('tutor-chat-area');
    if (area.innerHTML.trim() === '') {
        area.innerHTML = `<div class="date-label">NEW SESSION</div>`;
        addMessage(`Hello! I am your ${sub} tutor. Ask me a question or upload an image to begin.`, 'ai', area);
    }
}

function changeSubject(sub) {
    document.getElementById('tutor-subject-title').textContent = sub;
    document.getElementById('tutor-chat-area').innerHTML = `<div class="date-label">NEW SESSION</div>`;
    addMessage(`Let's study ${sub}. What do you want to learn?`, 'ai', document.getElementById('tutor-chat-area'));
}

// --- BOTTOM SHEET & UPLOADS ---
function openSheet(target) {
    currentSheetTarget = target;
    document.getElementById('bottom-sheet').classList.remove('hidden');
}
function closeSheet() { document.getElementById('bottom-sheet').classList.add('hidden'); }
function triggerUpload(type) {
    if (type === 'camera') document.getElementById('cameraInput').click();
    if (type === 'gallery') document.getElementById('galleryInput').click();
    if (type === 'file') document.getElementById('fileInput').click();
    closeSheet();
}

document.getElementById('cameraInput').addEventListener('change', (e) => handleFileSelect(e, 'image'));
document.getElementById('galleryInput').addEventListener('change', (e) => handleFileSelect(e, 'image'));
document.getElementById('fileInput').addEventListener('change', (e) => handleFileSelect(e, 'file'));

function handleFileSelect(event, type) {
    const file = event.target.files[0];
    if (!file) return;
    const target = currentSheetTarget;
    const reader = new FileReader();
    
    reader.onload = (e) => {
        selectedFiles[target] = { type: type, data: e.target.result, name: file.name };
        renderChip(target);
    };
    
    if (type === 'image') reader.readAsDataURL(file);
    else reader.readAsText(file);
}

function renderChip(target) {
    const container = document.getElementById(`${target}-chips`);
    container.innerHTML = '';
    const fileData = selectedFiles[target];
    if (!fileData) return;

    const chip = document.createElement('div');
    chip.className = 'chip';
    
    if (fileData.type === 'image') {
        chip.innerHTML = `<img src="${fileData.data}"> <span>Image Attached</span> <button onclick="clearChip('${target}')">✕</button>`;
    } else {
        chip.innerHTML = `<span>📄 ${fileData.name}</span> <button onclick="clearChip('${target}')">✕</button>`;
    }
    container.appendChild(chip);
}

function clearChip(target) {
    selectedFiles[target] = null;
    document.getElementById(`${target}-chips`).innerHTML = '';
    document.getElementById(`${target === 'general' ? 'general' : 'file'}Input`).value = '';
}

// --- CHAT UI ---
function addMessage(text, sender, container) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}`;
    
    const avatar = sender === 'ai' ? '✦' : '👤';
    let formattedText = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/```([\s\S]*?)```/g, '<pre>$1</pre>')
        .replace(/\n/g, '<br>');
    
    msgDiv.innerHTML = `
        <div class="avatar">${avatar}</div>
        <div class="bubble">${formattedText}</div>
    `;
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

function showTyping(container) {
    const id = 'typing-' + Date.now();
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ai`;
    msgDiv.id = id;
    msgDiv.innerHTML = `
        <div class="avatar">✦</div>
        <div class="bubble"><span class="typing-dots">...</span></div>
    `;
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
    return id;
}

// --- FORM SUBMISSIONS ---
document.getElementById('generalForm').addEventListener('submit', (e) => { e.preventDefault(); handleSend('general'); });
document.getElementById('tutorForm').addEventListener('submit', (e) => { e.preventDefault(); handleSend('tutor'); });

async function handleSend(target) {
    if (isProcessing) return;
    const input = document.getElementById(`${target}Input`);
    const text = input.value.trim();
    const file = selectedFiles[target];
    if (!text && !file) return;

    isProcessing = true;
    const area = document.getElementById(`${target}-chat-area`);
    
    const displayMsg = text || "Analyze this file.";
    addMessage(displayMsg, 'user', area);
    input.value = ''; input.style.height = 'auto';
    clearChip(target);

    const typingId = showTyping(area);

    let sysPrompt = target === 'general' 
        ? "You are a helpful, intelligent AI assistant."
        : `You are an expert AI ${document.getElementById('subject-selector').value} tutor for Grade ${profile.grade}. Tone: friendly. Use markdown for formatting.`;
        
    let messages = [{ role: 'system', content: sysPrompt }];
    const history = Array.from(area.querySelectorAll('.message')).slice(-7, -1);
    history.forEach(m => {
        const isUser = m.classList.contains('user');
        const msgText = m.querySelector('.bubble').innerText;
        if (msgText) messages.push({ role: isUser ? 'user' : 'assistant', content: msgText });
    });

    if (file && file.type === 'image') {
        messages.push({ 
            role: 'user', 
            content: [
                { type: "text", text: text || "Solve this image." },
                { type: "image_url", image_url: { url: file.data } }
            ] 
        });
    } else {
        const fullText = file && file.type === 'file' ? `${text}\n\nFile Content:\n${file.data}` : text;
        messages.push({ role: 'user', content: fullText });
    }

    try {
        // Try Gemini first, fallback to Groq if it fails
        const aiReply = await fetchWithFallback(messages);
        document.getElementById(typingId)?.remove();
        addMessage(aiReply, 'ai', area);

    } catch (err) {
        document.getElementById(typingId)?.remove();
        addMessage(`⚠️ **Error:** ${err.message}`, 'ai', area);
    } finally {
        isProcessing = false;
    }
}

// --- SMART FALLBACK ENGINE ---
async function fetchWithFallback(messages) {
    // 1. Try Gemini Proxy
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000); // 60s for Render wake up
        
        const res = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: GEMINI_MODEL, messages: messages, temperature: 0.7 }),
            signal: controller.signal
        });
        clearTimeout(timeout);

        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error?.message || `Gemini Error ${res.status}`);

        return data.choices[0].message.content;
    } catch (geminiError) {
        console.warn("Gemini Proxy Failed. Switching to Groq Fallback...", geminiError);
        
        // 2. Fallback to Groq
        const groqKey = window.APP_CONFIG?.GROQ_API_KEY;
        if (!groqKey) throw new Error("Primary server failed and no Groq API key found.");

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const res = await fetch(GROQ_URL, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${groqKey}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ model: GROQ_MODEL, messages: messages, temperature: 0.7 }),
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(`Fallback API Error ${res.status}: ${errData.error?.message || ''}`);
        }

        const data = await res.json();
        return data.choices[0].message.content;
    }
}

// --- UTILS ---
document.querySelectorAll('textarea').forEach(ta => {
    ta.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 100) + 'px';
    });
});

checkAppState();
