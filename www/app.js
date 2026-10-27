const chat = document.getElementById("chat");
const input = document.getElementById("messageInput");
const form = document.getElementById("chatForm");
const subject = document.getElementById("subject");
const attachmentDiv = document.getElementById("attachment");
const imageInput = document.getElementById("imageInput");

let profile = JSON.parse(localStorage.getItem('eduProfile')) || null;
let selectedImageBase64 = null;
let currentSubject = "Physics";

// --- INITIALIZATION ---
function checkAppState() {
    if (!profile) {
        document.getElementById('onboarding-screen').classList.remove('hidden');
        document.getElementById('app-shell').classList.add('hidden');
    } else {
        document.getElementById('onboarding-screen').classList.add('hidden');
        document.getElementById('app-shell').classList.remove('hidden');
        loadDashboard();
        switchTab('dashboard-screen', document.querySelector('.nav-button'));
    }
}

function finishOnboarding() {
    const name = document.getElementById('onboard-name').value.trim() || 'Student';
    profile = { 
        name, 
        grade: document.getElementById('onboard-grade').value, 
        curriculum: document.getElementById('onboard-curriculum').value,
        xp: 0, level: 1 
    };
    localStorage.setItem('eduProfile', JSON.stringify(profile));
    checkAppState();
}

function loadDashboard() {
    document.getElementById('dash-name').textContent = profile.name;
    document.getElementById('dash-context').textContent = `Grade ${profile.grade} • ${profile.curriculum}`;
    document.getElementById('dash-level').textContent = profile.level;
    document.getElementById('prof-name').textContent = profile.name;
    document.getElementById('prof-grade').textContent = profile.grade;
}

function resetApp() {
    if (confirm("Erase all data?")) { localStorage.clear(); location.reload(); }
}

// --- NAVIGATION ---
function switchTab(screenId, btn) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
    
    if(btn) {
        document.querySelectorAll('.nav-button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
}

function openTutor(sub) {
    currentSubject = sub;
    subject.value = sub;
    document.getElementById('current-subject-title').textContent = sub;
    switchTab('tutor-screen');
    
    // Auto-start lesson if empty
    if (chat.innerHTML.trim() === '') {
        addMessage(`Let's study ${sub} for Grade ${profile.grade}. Introduce the topic we should start with.`, "user");
        sendToAI(`Let's study ${sub} for Grade ${profile.grade}. Introduce the topic we should start with.`, null);
    }
}

// --- CHAT UI ---
function addMessage(text, sender = "user") {
    const article = document.createElement("article");
    article.className = "message";

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = sender === "ai" ? "✦" : "●";

    const bubble = document.createElement("div");
    bubble.className = "bubble";

    if (sender === "user") {
        article.classList.add("user-message");
        bubble.innerHTML = "";
        bubble.style.borderRadius = "17px 5px 17px 17px";
    } else {
        const label = document.createElement("div");
        label.className = "message-label";
        label.textContent = "EDUSCHOOL TUTOR";
        bubble.appendChild(label);
    }

    const paragraph = document.createElement("p");
    paragraph.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // Basic bold parsing
    bubble.appendChild(paragraph);

    const time = document.createElement("div");
    time.className = "timestamp";
    time.textContent = sender === "ai" ? "AI tutor" : "Just now";
    bubble.appendChild(time);

    if (sender === "ai") {
        article.append(avatar, bubble);
    } else {
        article.appendChild(bubble);
    }

    chat.appendChild(article);
    article.scrollIntoView({ behavior: "smooth", block: "end" });
}

// --- IMAGE UPLOAD LOGIC ---
imageInput.addEventListener("change", function() {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        selectedImageBase64 = e.target.result;
        attachmentDiv.hidden = false;
        attachmentDiv.textContent = "📎 Image attached. Ask a question or hit send!";
    };
    reader.readAsDataURL(file);
});

// --- FORM SUBMIT & AI FETCH ---
form.addEventListener("submit", async function(event) {
    event.preventDefault();
    const message = input.value.trim();
    if (!message && !selectedImageBase64) return;

    const displayMsg = message || "Solve this image.";
    addMessage(displayMsg, "user");
    
    input.value = "";
    input.style.height = "auto";
    attachmentDiv.hidden = true;
    
    const imgToSend = selectedImageBase64;
    selectedImageBase64 = null;
    imageInput.value = "";

    await sendToAI(message, imgToSend);
});

async function sendToAI(message, imageBase64) {
    const loadingId = "loading-" + Date.now();
    const loading = document.createElement("article");
    loading.className = "message";
    loading.id = loadingId;
    loading.innerHTML = `<div class="avatar">✦</div><div class="bubble"><p>Thinking...</p></div>`;
    chat.appendChild(loading);
    chat.scrollTop = chat.scrollHeight;

    let systemPrompt = `You are an expert AI ${currentSubject} tutor for a Grade ${profile.grade} student in the ${profile.curriculum}. Tone: friendly, modern, and encouraging.`;
    systemPrompt += ` \nCRITICAL: Use Markdown for formatting (bold, bullet points). Do not use tables.`;

    let messages = [{ role: 'system', content: systemPrompt }];
    // Add recent chat history
    const historyMsgs = Array.from(chat.querySelectorAll('.message')).slice(-6);
    historyMsgs.forEach(msg => {
        const isUser = msg.classList.contains('user-message');
        const text = msg.querySelector('.bubble p')?.innerText || "";
        if(text) messages.push({ role: isUser ? 'user' : 'assistant', content: text });
    });

    if (imageBase64) {
        messages.push({
            role: 'user',
            content: [
                { type: "text", text: message || "Solve the problem in this image." },
                { type: "image_url", image_url: { url: imageBase64 } }
            ]
        });
    } else {
        messages.push({ role: 'user', content: message });
    }

    // FIXING THE UNKNOWN MODEL ERROR: Use standard Gemini models via the proxy
    const modelToUse = imageBase64 ? 'gemini-3.7-flash' : 'gemini-3.7-flash'; 

    try {
        const res = await fetch('https://gemini-web2api-for-edu.onrender.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: modelToUse, messages, temperature: 0.7, max_tokens: 2000 })
        });

        const data = await res.json();
        document.getElementById(loadingId)?.remove();

        if (!res.ok || data.error) {
            throw new Error(data.error?.message || "Server is waking up. Wait 50s and try again.");
        }

        const aiReply = data.choices[0].message.content;
        addMessage(aiReply, "ai");

    } catch (error) {
        document.getElementById(loadingId)?.remove();
        addMessage(`⚠️ **Error:** ${error.message}`, "ai");
    }
}

// --- UTILS ---
function usePrompt(text) { input.value = text; input.focus(); }
function showMore() { alert("Settings menu coming soon!"); }
input.addEventListener("input", function() { this.style.height = "auto"; this.style.height = Math.min(this.scrollHeight, 100) + "px"; });
subject.addEventListener("change", function() { currentSubject = this.value; });

checkAppState();
