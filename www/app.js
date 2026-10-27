// AI EduSchool - Phase 2: Exam Center

const GEMINI_URL = 'https://gemini-web2api-for-edu.onrender.com/v1/chat/completions';
const GEMINI_MODEL = 'gemini-3.6-flash';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'openai/gpt-oss-20b';

let profile = JSON.parse(localStorage.getItem('eduProfile')) || null;
let currentSheetTarget = null;
let selectedFiles = { general: null, tutor: null };
let isProcessing = false;
let textbookChunks = JSON.parse(localStorage.getItem('textbookChunks')) || [];

// --- EXAM STATE ---
let examQuestions = [];
let examAnswers = {};
let currentQuestionIndex = 0;
let examTimer = null;
let timeLeft = 900; // 15 minutes in seconds
let lastExamScore = localStorage.getItem('lastExamScore') || 'N/A';
let lastExamSubject = localStorage.getItem('lastExamSubject') || 'Physics';

// --- WIZARD LOGIC ---
function nextStep(step) {
    if (step === 2 && !document.getElementById('input-name').value.trim()) return alert("Please enter your name");
    document.querySelectorAll('.wizard-step').forEach(s => s.classList.add('hidden'));
    document.getElementById(`step-${step}`).classList.remove('hidden');
    document.getElementById('wizard-progress-bar').style.width = `${(step / 3) * 100}%`;
}

function finishOnboarding() {
    profile = { name: document.getElementById('input-name').value.trim(), grade: document.getElementById('input-grade').value, curriculum: document.getElementById('input-curriculum').value, xp: 0, level: 1 };
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
    
    document.getElementById('last-exam-score').textContent = lastExamScore;
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

// --- CHAT & RAG LOGIC (PHASE 1) ---
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

function openSheet(target) { currentSheetTarget = target; document.getElementById('bottom-sheet').classList.remove('hidden'); }
function closeSheet() { document.getElementById('bottom-sheet').classList.add('hidden'); }
function triggerUpload(type) {
    if (type === 'camera') document.getElementById('cameraInput').click();
    if (type === 'gallery') document.getElementById('galleryInput').click();
    if (type === 'file') document.getElementById('fileInput').click();
    if (type === 'textbook') document.getElementById('textbookInput').click();
    closeSheet();
}

document.getElementById('cameraInput').addEventListener('change', (e) => handleFileSelect(e, 'image'));
document.getElementById('galleryInput').addEventListener('change', (e) => handleFileSelect(e, 'image'));
document.getElementById('fileInput').addEventListener('change', (e) => handleFileSelect(e, 'file'));

document.getElementById('textbookInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const text = event.target.result;
        const chunks = text.match(/[\s\S]{1,1500}/g) || [];
        if (chunks.length > 3000) { alert("⚠️ Textbook too large (max 4MB)."); return; }
        textbookChunks = chunks;
        try { localStorage.setItem('textbookChunks', JSON.stringify(textbookChunks)); alert(`📚 Textbook loaded: ${chunks.length} sections.`); } 
        catch (err) { alert("⚠️ Device memory full."); textbookChunks = []; }
    };
    reader.readAsText(file);
});

function handleFileSelect(event, type) {
    const file = event.target.files[0];
    if (!file) return;
    const target = currentSheetTarget;
    const reader = new FileReader();
    reader.onload = (e) => { selectedFiles[target] = { type: type, data: e.target.result, name: file.name }; renderChip(target); };
    if (type === 'image') reader.readAsDataURL(file); else reader.readAsText(file);
}

function renderChip(target) {
    const container = document.getElementById(`${target}-chips`);
    container.innerHTML = '';
    const fileData = selectedFiles[target];
    if (!fileData) return;
    const chip = document.createElement('div'); chip.className = 'chip';
    if (fileData.type === 'image') chip.innerHTML = `<img src="${fileData.data}"> <span>Image</span> <button onclick="clearChip('${target}')">✕</button>`;
    else chip.innerHTML = `<span>📄 ${fileData.name}</span> <button onclick="clearChip('${target}')">✕</button>`;
    container.appendChild(chip);
}

function clearChip(target) {
    selectedFiles[target] = null;
    document.getElementById(`${target}-chips`).innerHTML = '';
    document.getElementById(`${target === 'general' ? 'general' : 'file'}Input`).value = '';
}

function addMessage(text, sender, container) {
    const msgDiv = document.createElement('div'); msgDiv.className = `message ${sender}`;
    const avatar = sender === 'ai' ? '✦' : '👤';
    let formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/```([\s\S]*?)```/g, '<pre>$1</pre>').replace(/\n/g, '<br>');
    msgDiv.innerHTML = `<div class="avatar">${avatar}</div><div class="bubble">${formattedText}</div>`;
    container.appendChild(msgDiv); container.scrollTop = container.scrollHeight;
}

function showTyping(container) {
    const id = 'typing-' + Date.now();
    const msgDiv = document.createElement('div'); msgDiv.className = `message ai`; msgDiv.id = id;
    msgDiv.innerHTML = `<div class="avatar">✦</div><div class="bubble"><span class="typing-dots">...</span></div>`;
    container.appendChild(msgDiv); container.scrollTop = container.scrollHeight; return id;
}

function findRelevantChunk(query) {
    if (!textbookChunks || textbookChunks.length === 0) return null;
    const stopWords = ["the","and","is","in","it","to","of","what","how","why","can","you","me","tell","explain"];
    const queryWords = query.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 3 && !stopWords.includes(w));
    if (queryWords.length === 0) return null;
    let bestChunk = null; let highestScore = 0;
    textbookChunks.forEach(chunk => {
        let score = 0; const chunkLower = chunk.toLowerCase();
        queryWords.forEach(word => { if (chunkLower.includes(word)) score++; });
        if (score > highestScore) { highestScore = score; bestChunk = chunk; }
    });
    return highestScore > 0 ? bestChunk : null;
}

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
    addMessage(text || "Analyze this file.", 'user', area);
    input.value = ''; input.style.height = 'auto'; clearChip(target);
    const typingId = showTyping(area);

    let contextStr = "";
    if (text && textbookChunks.length > 0) {
        const bestChunk = findRelevantChunk(text);
        if (bestChunk) contextStr = `\n\n[TEXTBOOK CONTEXT]:\n${bestChunk}\n\nUse this context.`;
    }

    let sysPrompt = target === 'general' ? "You are a helpful AI." + contextStr : `You are an expert ${document.getElementById('subject-selector').value} tutor for Grade ${profile.grade}.` + contextStr;
    let messages = [{ role: 'system', content: sysPrompt }];
    const history = Array.from(area.querySelectorAll('.message')).slice(-7, -1);
    history.forEach(m => {
        const isUser = m.classList.contains('user');
        const msgText = m.querySelector('.bubble').innerText;
        if (msgText) messages.push({ role: isUser ? 'user' : 'assistant', content: msgText });
    });

    if (file && file.type === 'image') messages.push({ role: 'user', content: [{ type: "text", text: text || "Solve this." }, { type: "image_url", image_url: { url: file.data } }] });
    else messages.push({ role: 'user', content: file && file.type === 'file' ? `${text}\n\nFile:\n${file.data}` : text });

    try {
        const aiReply = await fetchWithFallback(messages);
        document.getElementById(typingId)?.remove();
        addMessage(aiReply, 'ai', area);
    } catch (err) {
        document.getElementById(typingId)?.remove();
        addMessage(`⚠️ **Error:** ${err.message}`, 'ai', area);
    } finally { isProcessing = false; }
}

// --- PHASE 2: EXAM CENTER LOGIC ---
async function startExamSetup() {
    const subject = prompt("Which subject do you want to be tested on? (Physics, Math, Chemistry, Biology)", "Physics");
    if (!subject) return;
    
    const area = document.getElementById('exam-content');
    area.innerHTML = '<div style="text-align:center; color:var(--blue); margin-top:50px;">Generating 10 questions for Grade ' + profile.grade + ' ' + subject + '... Please wait.</div>';
    document.getElementById('exam-screen').classList.remove('hidden');
    document.getElementById('main-nav').classList.add('hidden');
    document.getElementById('exam-subject-title').textContent = subject + " Exam";

    // AI Prompt to generate 10 MCQs in strict JSON format
    const sysPrompt = `You are an examiner. Generate exactly 10 multiple-choice questions for Grade ${profile.grade} ${subject}. 
    Return ONLY a JSON array. DO NOT wrap it in markdown code blocks. 
    Format: [{"q": "Question text", "options": {"A": "Opt 1", "B": "Opt 2", "C": "Opt 3", "D": "Opt 4"}, "answer": "A", "explanation": "Why A is correct"}]
    Make the questions challenging and relevant to the curriculum.`;

    try {
        const res = await fetchWithFallback([{ role: 'system', content: sysPrompt }, { role: 'user', content: "Generate the exam JSON." }]);
        
        // Robust JSON parsing (extract everything between [ and ])
        const jsonStr = res.substring(res.indexOf('['), res.lastIndexOf(']') + 1);
        examQuestions = JSON.parse(jsonStr);

        if (!examQuestions || examQuestions.length === 0) throw new Error("Failed to parse questions.");

        currentQuestionIndex = 0;
        examAnswers = {};
        timeLeft = 900; // 15 mins

        renderExamQuestion();
        startExamTimer();

    } catch (err) {
        alert("Error generating exam: " + err.message);
        closeExam();
    }
}

function startExamTimer() {
    if (examTimer) clearInterval(examTimer);
    updateTimerDisplay();
    examTimer = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        if (timeLeft <= 0) {
            clearInterval(examTimer);
            alert("Time is up! Submitting your exam.");
            submitExam();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const s = (timeLeft % 60).toString().padStart(2, '0');
    document.getElementById('exam-timer').textContent = `${m}:${s}`;
}

function renderExamQuestion() {
    const q = examQuestions[currentQuestionIndex];
    document.getElementById('exam-current-q').textContent = currentQuestionIndex + 1;
    const area = document.getElementById('exam-content');
    
    let html = `<div class="exam-q-text">${q.q}</div>`;
    for (const [key, val] of Object.entries(q.options)) {
        const isSelected = examAnswers[currentQuestionIndex] === key ? 'selected' : '';
        html += `<button class="option-btn ${isSelected}" onclick="selectOption('${key}')"><span class="option-label">${key}.</span> ${val}</button>`;
    }
    area.innerHTML = html;

    // Update Next button
    const btn = document.getElementById('exam-next-btn');
    if (currentQuestionIndex === examQuestions.length - 1) {
        btn.textContent = "Submit Exam";
        btn.onclick = submitExam;
    } else {
        btn.textContent = "Next Question →";
        btn.onclick = nextExamQuestion;
    }
}

function selectOption(opt) {
    examAnswers[currentQuestionIndex] = opt;
    renderExamQuestion(); // Re-render to show selection
}

function nextExamQuestion() {
    if (currentQuestionIndex < examQuestions.length - 1) {
        currentQuestionIndex++;
        renderExamQuestion();
    }
}

function submitExam() {
    clearInterval(examTimer);
    let score = 0;
    let resultHtml = `<div style="text-align:center; margin-bottom: 20px;"><h1 style="font-size: 2.5rem; color: var(--blue);">${Math.round((Object.keys(examAnswers).length / examQuestions.length) * 100)}%</h1><p>Completed</p></div>`;

    examQuestions.forEach((q, index) => {
        const userAns = examAnswers[index];
        const isCorrect = userAns === q.answer;
        if (isCorrect) score++;

        resultHtml += `
            <div class="glass-card mt-20" style="border-left: 4px solid ${isCorrect ? '#10b981' : '#ef4444'}">
                <p style="font-weight: bold; margin-bottom: 10px;">Q${index + 1}: ${q.q}</p>
                <div class="option-btn ${isCorrect ? 'correct' : 'wrong'}" style="margin-bottom:5px;">
                    Your Answer: ${userAns ? q.options[userAns] : 'Skipped'}
                </div>
                ${!isCorrect ? `<div class="option-btn correct" style="margin-bottom:5px;">Correct Answer: ${q.options[q.answer]}</div>` : ''}
                <div class="explanation-box">
                    <strong>Explanation:</strong> ${q.explanation}
                </div>
            </div>
        `;
    });

    const finalPercentage = Math.round((score / examQuestions.length) * 100);
    lastExamScore = `${finalPercentage}%`;
    localStorage.setItem('lastExamScore', lastExamScore);
    loadDashboard();

    resultHtml += `<button class="glow-btn mt-20" onclick="closeExam()">Back to Dashboard</button>`;
    
    if (finalPercentage < 50) {
        resultHtml += `<button class="glow-btn mt-10" style="background: #ef4444; margin-top: 10px;" onclick="retryExam()">Review & Retry Exam</button>`;
    }

    document.getElementById('results-content').innerHTML = resultHtml;
    document.getElementById('exam-screen').classList.add('hidden');
    document.getElementById('results-screen').classList.remove('hidden');
}

function retryExam() {
    document.getElementById('results-screen').classList.add('hidden');
    currentQuestionIndex = 0;
    examAnswers = {};
    timeLeft = 900;
    renderExamQuestion();
    document.getElementById('exam-screen').classList.remove('hidden');
    startExamTimer();
}

function closeExam() {
    document.getElementById('exam-screen').classList.add('hidden');
    document.getElementById('results-screen').classList.add('hidden');
    document.getElementById('main-nav').classList.remove('hidden');
    switchTab('dashboard-screen', document.getElementById('nav-home'));
}

// --- SMART FALLBACK ENGINE ---
async function fetchWithFallback(messages) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000); 
        const res = await fetch(GEMINI_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: GEMINI_MODEL, messages, temperature: 0.7 }), signal: controller.signal });
        clearTimeout(timeout);
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error?.message || `Gemini Error`);
        return data.choices[0].message.content;
    } catch (geminiError) {
        console.warn("Gemini Failed. Using Groq...", geminiError);
        const groqKey = window.APP_CONFIG?.GROQ_API_KEY;
        if (!groqKey) throw new Error("Primary server failed and no Groq API key found.");

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); 
        const res = await fetch(GROQ_URL, { method: 'POST', headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: GROQ_MODEL, messages, temperature: 0.7 }), signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) throw new Error(`Fallback API Error ${res.status}`);
        const data = await res.json();
        return data.choices[0].message.content;
    }
}

// --- UTILS ---
document.querySelectorAll('textarea').forEach(ta => {
    ta.addEventListener('input', function() { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 100) + 'px'; });
});

checkAppState();
