const API_URL = 'https://gemini-web2api-for-edu.onrender.com/v1/chat/completions';

let profile = JSON.parse(localStorage.getItem('eduProfile')) || null;
let generalImageBase64 = null;
let tutorImageBase64 = null;
let currentSubject = 'Physics';
let isProcessing = false;
let activeMenuTarget = null;

// --- INIT ---
function checkAppState() {
    if (!profile) {
        document.getElementById('onboarding-screen').style.display = 'block';
        document.getElementById('app-shell').classList.add('hidden');
    } else {
        document.getElementById('onboarding-screen').style.display = 'none';
        document.getElementById('app-shell').classList.remove('hidden');
        loadDashboard();
        switchTab('dashboard-screen', document.getElementById('nav-home'));
    }
}

function finishOnboarding() {
    const name = document.getElementById('onboard-name').value.trim() || 'Student';
    profile = { name, grade: document.getElementById('onboard-grade').value, curriculum: document.getElementById('onboard-curriculum').value, xp: 0, level: 1 };
    localStorage.setItem('eduProfile', JSON.stringify(profile));
    checkAppState();
}

function loadDashboard() {
    document.getElementById('dash-name').textContent = profile.name;
    document.getElementById('dash-context').textContent = `Grade ${profile.grade} • ${profile.curriculum}`;
    document.getElementById('dash-level').textContent = profile.level;
    document.getElementById('prof-name-display').textContent = profile.name;
    document.getElementById('dash-xp-bar').style.width = `${(profile.xp % (profile.level * 100)) / (profile.level * 100) * 100}%`;
}

function resetApp() { if (confirm("Erase all data?")) { localStorage.clear(); location.reload(); } }

// --- NAVIGATION (FIXED TO HIDE NAV IN CHAT) ---
function switchTab(screenId, btn) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
    
    // Hide Bottom Nav in Chat Screens
    if (screenId === 'general-chat-screen' || screenId === 'tutor-screen') {
        document.getElementById('main-nav').classList.add('hidden');
    } else {
        document.getElementById('main-nav').classList.remove('hidden');
        if(btn) {
            document.querySelectorAll('.nav-button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        }
    }
}

// --- ACTION MENU (+ BUTTON) ---
function toggleMenu(type) {
    activeMenuTarget = type;
    document.getElementById('action-menu').classList.remove('hidden');
}
function closeMenu() {
    document.getElementById('action-menu').classList.add('hidden');
}
function triggerUpload(type, inputId) {
    document.getElementById(inputId).click();
    closeMenu();
}

// --- SUBJECT LOGIC ---
function openSubject(sub) {
    currentSubject = sub;
    document.getElementById('subject').value = sub;
    document.getElementById('current-subject-title').textContent = sub;
    switchTab('tutor-screen');
    
    const container = document.getElementById('tutor-chat-container');
    if (container.innerHTML.trim() === '' || container.querySelector('.date-label')) {
        container.innerHTML = `<div class="date-label">NEW SESSION</div>`;
        addMessage(`Hello! I am your ${sub} tutor. Ask me a question or upload an image to begin.`, 'ai', container);
    }
}

function changeSubject(sub) {
    currentSubject = sub;
    document.getElementById('current-subject-title').textContent = sub;
    document.getElementById('tutor-chat-container').innerHTML = `<div class="date-label">NEW SESSION</div>`;
    addMessage(`Let's study ${sub}. What do you want to learn?`, 'ai', document.getElementById('tutor-chat-container'));
}

// --- CHAT UI ---
function addMessage(text, sender, container) {
    const article = document.createElement("article");
    article.className = "message";
    if (sender === "user") article.classList.add("user-message");

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = sender === "ai" ? "✦" : "●";

    const bubble = document.createElement("div");
    bubble.className = "bubble";

    if (sender === "ai") {
        const label = document.createElement("div");
        label.className = "message-label";
        label.textContent = "EDUSCHOOL TUTOR";
        bubble.appendChild(label);
    }

    const paragraph = document.createElement("p");
    paragraph.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    bubble.appendChild(paragraph);

    if (sender === "ai") article.append(avatar, bubble);
    else article.appendChild(bubble);

    container.appendChild(article);
    container.scrollTop = container.scrollHeight;
}

// --- IMAGE HANDLING ---
function setupImageListener(inputId, type) {
    document.getElementById(inputId).addEventListener("change", function() {
        const file = this.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            if (type === 'general') {
                generalImageBase64 = e.target.result;
                document.getElementById('general-preview-img').src = generalImageBase64;
                document.getElementById('general-attachment').classList.remove('hidden');
            } else {
                tutorImageBase64 = e.target.result;
                document.getElementById('tutor-preview-img').src = tutorImageBase64;
                document.getElementById('tutor-attachment').classList.remove('hidden');
            }
        };
        reader.readAsDataURL(file);
    });
}
setupImageListener('generalImageInput', 'general');
setupImageListener('tutorImageInput', 'tutor');

// Handle file uploads (TXT/PDF text extraction)
document.getElementById('generalFileInput').addEventListener('change', function() {
    const file = this.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('generalInput').value = `[File Attached: ${file.name}]\n\nPlease analyze this text:\n\n${e.target.result}`;
    };
    reader.readAsText(file);
});
document.getElementById('tutorFileInput').addEventListener('change', function() {
    const file = this.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('tutorInput').value = `[File Attached: ${file.name}]\n\nPlease analyze this text:\n\n${e.target.result}`;
    };
    reader.readAsText(file);
});

function clearImage(type) {
    if (type === 'general') {
        generalImageBase64 = null;
        document.getElementById('general-attachment').classList.add('hidden');
        document.getElementById('generalImageInput').value = "";
    } else {
        tutorImageBase64 = null;
        document.getElementById('tutor-attachment').classList.add('hidden');
        document.getElementById('tutorImageInput').value = "";
    }
}

// --- FORM SUBMISSIONS ---
document.getElementById("generalForm").addEventListener("submit", async function(e) {
    e.preventDefault();
    const input = document.getElementById("generalInput");
    const msg = input.value.trim();
    if (!msg && !generalImageBase64) return;

    const container = document.getElementById('general-chat-container');
    addMessage(msg || "Solve this image.", "user", container);
    
    input.value = ""; input.style.height = "auto";
    const img = generalImageBase64;
    clearImage('general');

    let sysPrompt = `You are a helpful, intelligent AI assistant.`;
    await sendToAI(msg, img, sysPrompt, container);
});

document.getElementById("tutorForm").addEventListener("submit", async function(e) {
    e.preventDefault();
    const input = document.getElementById("tutorInput");
    const msg = input.value.trim();
    if (!msg && !tutorImageBase64) return;

    const container = document.getElementById('tutor-chat-container');
    addMessage(msg || "Solve this image.", "user", container);
    
    input.value = ""; input.style.height = "auto";
    const img = tutorImageBase64;
    clearImage('tutor');

    let sysPrompt = `You are an expert AI ${currentSubject} tutor for a Grade ${profile.grade} student in the ${profile.curriculum}. Tone: friendly and encouraging. Use markdown for lists and bold text.`;
    await sendToAI(msg, img, sysPrompt, container);
});

// --- AI FETCH (WITH 302 FIX) ---
async function sendToAI(message, imageBase64, systemPrompt, container) {
    if (isProcessing) return;
    isProcessing = true;

    const loadingId = "loading-" + Date.now();
    const loading = document.createElement("article");
    loading.className = "message";
    loading.id = loadingId;
    loading.innerHTML = `<div class="avatar">✦</div><div class="bubble"><p>Thinking...</p></div>`;
    container.appendChild(loading);
    container.scrollTop = container.scrollHeight;

    let messages = [{ role: 'system', content: systemPrompt }];
    
    // Get last 6 messages for context
    const historyMsgs = Array.from(container.querySelectorAll('.message')).slice(-7, -1);
    historyMsgs.forEach(m => {
        const isUser = m.classList.contains('user-message');
        const text = m.querySelector('.bubble p')?.innerText || "";
        if(text) messages.push({ role: isUser ? 'user' : 'assistant', content: text });
    });

    if (imageBase64) {
        messages.push({ role: 'user', content: [{ type: "text", text: message || "Solve this." }, { type: "image_url", image_url: { url: imageBase64 } }] });
    } else {
        messages.push({ role: 'user', content: message });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
        // ADDED TRAILING SLASH TO FIX 302 REDIRECT INFINITE LOOP
        const res = await fetch(API_URL + '/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'gemini-3.7-flash', messages, temperature: 0.7, max_tokens: 2000 }),
            signal: controller.signal,
            redirect: 'follow'
        });
        clearTimeout(timeoutId);

        const data = await res.json();
        document.getElementById(loadingId)?.remove();

        if (!res.ok || data.error) {
            throw new Error(data.error?.message || "Server error. Please try again.");
        }

        const aiReply = data.choices[0].message.content;
        addMessage(aiReply, "ai", container);

    } catch (error) {
        document.getElementById(loadingId)?.remove();
        const errMsg = error.name === 'AbortError' ? "Server timed out. Please try again." : error.message;
        addMessage(`⚠️ **Error:** ${errMsg}`, "ai", container);
    } finally {
        isProcessing = false;
    }
}

// --- UTILS ---
function usePrompt(text) {
    const input = document.getElementById("tutorInput");
    input.value = text; input.focus(); input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 100) + "px";
}

document.querySelectorAll('textarea').forEach(ta => {
    ta.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 100) + 'px';
    });
});

checkAppState();
