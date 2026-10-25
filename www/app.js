// AI EduSchool - New Chat UI, Subject Separation, Plus Menu

const GROQ_API_KEY = window.APP_CONFIG ? window.APP_CONFIG.GROQ_API_KEY : 'NO_KEY';
const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const ttsAudio = document.getElementById('tts-audio');
const stopVoiceBtn = document.getElementById('stop-voice-btn');
const plusMenu = document.getElementById('plus-menu');

let profile = JSON.parse(localStorage.getItem('eduProfile')) || null;
let currentSubject = 'General';
let chatHistory = [];
let isProcessing = false;
let isThinkHarder = false;
let timerInterval = null, secondsElapsed = 0;

// --- SUBJECT-SPECIFIC HISTORY ---
function loadHistoryForSubject(subject) {
    currentSubject = subject;
    chatHistory = JSON.parse(localStorage.getItem(`tutorHistory_${subject}`)) || [];
    renderHistory();
}
function saveHistory() {
    localStorage.setItem(`tutorHistory_${currentSubject}`, JSON.stringify(chatHistory));
}

// --- MENU & UI ---
function toggleMenu() {
    plusMenu.classList.toggle('hidden');
}
function triggerUpload(id) {
    document.getElementById(id).click();
    toggleMenu();
}
function toggleThinkHarder() {
    isThinkHarder = !isThinkHarder;
    const btn = document.getElementById('think-harder-btn');
    if (isThinkHarder) {
        btn.classList.add('active');
        btn.textContent = '🧠 Think Harder (ON)';
        alert("Deep Reasoning mode activated. The AI will think longer for complex problems.");
    } else {
        btn.classList.remove('active');
        btn.textContent = '🧠 Think Harder';
    }
    toggleMenu();
}

// --- MARKDOWN PARSER ---
function parseMarkdown(text) {
    let html = text
        .replace(/\\\((.*?)\\\)/g, '<span class="math-block">$1</span>')
        .replace(/\\frac\{(.*?)\}\{(.*?)\}/g, '($1 / $2)')
        .replace(/\\Delta/g, 'Δ')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>')
        .replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>')
        .replace(/\n/g, '<br>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    return html;
}

// --- FAST TTS ---
let speechQueue = [];
let isSpeaking = false;
function cleanTextForTTS(text) {
    return text.replace(/\\\((.*?)\\\)/g, '$1').replace(/\\frac\{(.*?)\}\{(.*?)\}/g, '$1 over $2').replace(/[*#_|>]/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
}
function splitTextIntoChunks(text) {
    let sentences = cleanTextForTTS(text).match(/[^.!?]+[.!?]+/g) || [cleanTextForTTS(text)];
    let chunks = [], currentChunk = "";
    sentences.forEach(s => {
        if ((currentChunk + s).length < 400) currentChunk += s + " ";
        else { if (currentChunk) chunks.push(currentChunk.trim()); currentChunk = s + " "; }
    });
    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks;
}
async function playGroqTTS(text) {
    ttsAudio.pause(); speechQueue = splitTextIntoChunks(text);
    if (speechQueue.length > 0) { isSpeaking = true; stopVoiceBtn.classList.remove('hidden'); playNextChunk(); }
}
function stopVoice() { isSpeaking = false; speechQueue = []; ttsAudio.pause(); stopVoiceBtn.classList.add('hidden'); }
async function playNextChunk() {
    if (!isSpeaking || speechQueue.length === 0) { stopVoice(); return; }
    const chunk = speechQueue.shift();
    const voice = profile.voice || 'diana';
    try {
        const res = await fetch('https://api.groq.com/openai/v1/audio/speech', {
            method: 'POST', headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'canopylabs/orpheus-v1-english', input: chunk, voice: voice, response_format: 'wav' })
        });
        if (!res.ok) throw new Error('TTS Error');
        const audioBlob = await res.blob();
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => { if(isSpeaking) { ttsAudio.src = reader.result; ttsAudio.play().catch(stopVoice); } };
    } catch (error) { stopVoice(); }
}
ttsAudio.onended = () => { if (isSpeaking) playNextChunk(); };

// --- APP INITIALIZATION ---
function checkAppState() {
    if (!profile) {
        document.getElementById('onboarding-screen').classList.remove('hidden');
        document.getElementById('app-shell').classList.add('hidden');
    } else {
        document.getElementById('onboarding-screen').classList.add('hidden');
        document.getElementById('app-shell').classList.remove('hidden');
        loadDashboard(); switchTab('dashboard-screen');
    }
}
function finishOnboarding() {
    const name = document.getElementById('onboard-name').value.trim() || 'Student';
    profile = { name, grade: document.getElementById('onboard-grade').value, curriculum: document.getElementById('onboard-curriculum').value, tutor: 'Nova', voice: 'diana', xp: 0, level: 1, memory: '' };
    localStorage.setItem('eduProfile', JSON.stringify(profile));
    checkAppState();
}
function saveSettings() {
    profile.memory = document.getElementById('ai-memory-input').value.trim();
    profile.voice = document.getElementById('voice-selector').value;
    profile.tutor = document.getElementById('tutor-selector').value;
    localStorage.setItem('eduProfile', JSON.stringify(profile));
    alert("Settings Saved!");
}
function loadDashboard() {
    document.getElementById('dash-name').textContent = profile.name;
    document.getElementById('dash-context').textContent = `Grade ${profile.grade} • ${profile.curriculum}`;
    document.getElementById('dash-level').textContent = profile.level;
    document.getElementById('prof-name').textContent = profile.name;
    document.getElementById('prof-grade').textContent = profile.grade;
    document.getElementById('prof-tutor').textContent = profile.tutor;
    document.getElementById('ai-memory-input').value = profile.memory || '';
    document.getElementById('voice-selector').value = profile.voice || 'diana';
    document.getElementById('tutor-selector').value = profile.tutor || 'Nova';
    updateXPUI();
}
function updateXPUI() {
    if (!profile) return;
    document.getElementById('dash-xp-bar').style.width = `${(profile.xp % (profile.level * 100)) / (profile.level * 100) * 100}%`;
}
function addXP(amount) {
    if (!profile) return;
    profile.xp += amount;
    if (profile.xp >= profile.level * 100) { profile.level++; profile.xp = 0; alert(`🎉 LEVEL UP! Level ${profile.level}.`); }
    localStorage.setItem('eduProfile', JSON.stringify(profile)); loadDashboard();
}

// --- NAVIGATION ---
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
    
    // Update active bottom nav
    document.querySelectorAll('.bottom-nav button').forEach(b => b.style.color = '#94a3b8');
    if(tabId === 'dashboard-screen') document.getElementById('nav-home').style.color = '#3b82f6';
    if(tabId === 'tutor-screen') document.getElementById('nav-tutor').style.color = '#3b82f6';
    if(tabId === 'planner-screen') document.getElementById('nav-planner').style.color = '#3b82f6';
    if(tabId === 'profile-screen') document.getElementById('nav-profile').style.color = '#3b82f6';

    if (tabId === 'tutor-screen') { startTimer(); } 
    else { clearInterval(timerInterval); stopVoice(); }
}

function openTutor(subject) {
    loadHistoryForSubject(subject);
    document.getElementById('current-subject-title').textContent = subject;
    switchTab('tutor-screen');
    // If chat is empty, start the lesson
    if (chatHistory.length === 0) {
        handleSend(`Let's study ${subject} for Grade ${profile.grade}. Introduce the topic we should start with.`);
    }
}
function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    secondsElapsed = 0;
    timerInterval = setInterval(() => {
        secondsElapsed++;
        const m = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
        const s = String(secondsElapsed % 60).padStart(2, '0');
        document.getElementById('study-timer').textContent = `⏱️ ${m}:${s}`;
    }, 1000);
}

// --- RENDER & UI ---
function renderHistory() {
    chatContainer.innerHTML = '';
    if (chatHistory.length === 0) {
        chatContainer.innerHTML = `<div class="message ai-message">Hello! I am your ${currentSubject} tutor. Ask me a question, upload an image of a problem, or tap <b>+</b> for tools.</div>`;
    } else {
        chatHistory.forEach(msg => addMessageToUI(msg.text, msg.sender, msg.sender === 'ai'));
    }
}
function addMessageToUI(text, sender, isMarkdown = false) {
    const div = document.createElement('div');
    div.className = `message ${sender === 'user' ? 'user-message' : 'ai-message'}`;
    if (isMarkdown && sender === 'ai') div.innerHTML = parseMarkdown(text);
    else div.textContent = text;
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// --- UPLOADS ---
document.getElementById('file-upload').addEventListener('change', (event) => {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => handleSend(`I have uploaded a text file. Please teach me this material: \n\n${e.target.result}`);
    reader.readAsText(file);
});
document.getElementById('image-upload').addEventListener('change', (event) => {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => handleSend("I have uploaded an image of a problem. Please read it carefully and solve it step-by-step.", e.target.result);
    reader.readAsDataURL(file);
});

function handleQuickAction(action) {
    toggleMenu(); // close menu
    if (action === 'quiz') handleSend("Quiz me on this subject. Give me 3 multiple-choice questions.");
    if (action === 'feynman') handleSend("Let's use the Feynman technique. I will explain the current topic to you, and you act like a confused student asking me questions.");
    if (action === 'notes') handleSend("Generate a structured study note from our conversation so far.");
}

// --- AI BRAIN ---
async function handleSend(customPrompt = null, imageBase64 = null) {
    if (isProcessing || !profile) return;
    const text = customPrompt || userInput.value.trim(); if (!text) return;
    isProcessing = true; addXP(5); stopVoice();
    plusMenu.classList.add('hidden'); // Close menu if open

    if (!customPrompt) {
        addMessageToUI(text, 'user'); chatHistory.push({ text: text, sender: 'user' });
        userInput.value = ''; saveHistory();
    } else { addMessageToUI(customPrompt, 'user'); }

    const think = document.createElement('div');
    think.className = 'message ai-message'; think.textContent = 'Thinking...'; think.id = 'think';
    chatContainer.appendChild(think); chatContainer.scrollTop = chatContainer.scrollHeight;

    let systemPrompt = `You are ${profile.tutor}, an expert AI ${currentSubject} tutor for a Grade ${profile.grade} student in the ${profile.curriculum}. Tone: ${profile.tutor === 'Nova' ? 'friendly' : profile.tutor === 'Atlas' ? 'strict' : 'funny'}.`;
    if (profile.memory) systemPrompt += ` \nCRITICAL STUDENT MEMORY: ${profile.memory}. Adapt your teaching to this.`;
    
    // Think Harder logic
    if (isThinkHarder) systemPrompt += ` \nCRITICAL: This is a complex problem. Think step-by-step, verify your math/logic internally before answering, and provide a highly detailed, flawless explanation.`;
    
    systemPrompt += ` \nFormat your response beautifully using Markdown. Links for videos must use [Title](URL). Do not use complex LaTeX. Use plain text math (e.g., 'x^2').`;

    let messages = [{ role: 'system', content: systemPrompt }];
    chatHistory.slice(-10).forEach(m => messages.push({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }));

    if (imageBase64) {
        messages.push({ role: 'user', content: [{ type: "text", text: "Solve the problem in this image." }, { type: "image_url", image_url: { url: imageBase64 } }] });
    } else {
        messages.push({ role: 'user', content: text });
    }

    const modelToUse = imageBase64 ? 'llama-3.2-11b-vision-instruct' : 'openai/gpt-oss-120b';

    try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST', headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: modelToUse, messages, temperature: 0.6, max_tokens: 2000 })
        });

        const data = await res.json();
        document.getElementById('think').remove();
        if (data.error) { addMessageToUI(`Error: ${data.error.message}`, 'ai'); isProcessing = false; return; }

        const aiResponse = data.choices[0].message.content;
        
        addMessageToUI(aiResponse, 'ai', true);
        chatHistory.push({ text: aiResponse, sender: 'ai' }); saveHistory();

        if (aiResponse.toLowerCase().includes("correct") || aiResponse.toLowerCase().includes("great job")) addXP(15);
        playGroqTTS(aiResponse);

    } catch (e) {
        document.getElementById('think').remove();
        addMessageToUI("Network error.", 'ai');
    }
    isProcessing = false;
}

// --- EVENTS ---
sendBtn.addEventListener('click', () => handleSend());
userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSend(); });
function resetApp() { if (confirm("Erase all data?")) { localStorage.clear(); location.reload(); } }

checkAppState();
