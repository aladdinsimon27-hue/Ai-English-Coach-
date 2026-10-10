// AI Personal Tutor 90+ - Gamified & Advanced

const GROQ_API_KEY = window.APP_CONFIG.GROQ_API_KEY;
const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const makeNotesBtn = document.getElementById('make-notes-btn');
const quizBtn = document.getElementById('quiz-btn');
const feynmanBtn = document.getElementById('feynman-btn');
const fileUpload = document.getElementById('file-upload');
const lessonStatus = document.getElementById('lesson-status');
const studyTimer = document.getElementById('study-timer');
const mainXpBar = document.getElementById('main-xp-bar');
const headerLevel = document.getElementById('header-level');

let chatHistory = JSON.parse(localStorage.getItem('tutorHistory')) || [];
let lessonMaterial = localStorage.getItem('tutorLesson') || null;
let isProcessing = false;
let timerInterval = null;
let secondsElapsed = 0;
let currentMode = 'chat'; // chat, quiz, feynman

// --- GAMIFICATION (XP & LEVELS) ---
let userXP = parseInt(localStorage.getItem('tutorXP')) || 0;
let userLevel = parseInt(localStorage.getItem('tutorLevel')) || 1;

function updateXPUI() {
    const xpNeeded = userLevel * 100;
    const progress = (userXP % xpNeeded) / xpNeeded * 100;
    mainXpBar.style.width = `${progress}%`;
    headerLevel.textContent = userLevel;
    
    // Level up logic
    if (userXP >= xpNeeded) {
        userLevel++;
        userXP = 0;
        localStorage.setItem('tutorXP', userXP);
        localStorage.setItem('tutorLevel', userLevel);
        alert(`🎉 LEVEL UP! You are now Level ${userLevel}. Keep going!`);
        updateXPUI();
    }
}

function addXP(amount) {
    userXP += amount;
    localStorage.setItem('tutorXP', userXP);
    updateXPUI();
}

// --- TIMER LOGIC ---
function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    secondsElapsed = 0;
    timerInterval = setInterval(() => {
        secondsElapsed++;
        const h = String(Math.floor(secondsElapsed / 3600)).padStart(2, '0');
        const m = String(Math.floor((secondsElapsed % 3600) / 60)).padStart(2, '0');
        const s = String(secondsElapsed % 60).padStart(2, '0');
        studyTimer.textContent = `⏱️ ${h}:${m}:${s}`;
    }, 1000);
}

// --- NAVIGATION ---
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
    if (screenId === 'chat-screen') startTimer();
    else clearInterval(timerInterval);
}

// --- FILE UPLOAD ---
fileUpload.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        lessonMaterial = e.target.result;
        localStorage.setItem('tutorLesson', lessonMaterial);
        lessonStatus.textContent = `📄 ${file.name} loaded`;
        showScreen('chat-screen');
        chatContainer.innerHTML = '';
        chatHistory = [];
        saveMemory();
        currentMode = 'chat';
        handleSend(`I have uploaded a file named "${file.name}". Please act as my teacher and teach me this material step-by-step. Start by introducing the topic.`);
    };
    reader.readAsText(file);
});

// --- UI & MEMORY ---
function renderHistory() {
    chatContainer.innerHTML = '';
    chatHistory.forEach(msg => addMessageToUI(msg.text, msg.sender));
    if (lessonMaterial) lessonStatus.textContent = "📄 Lesson loaded";
}

function addMessageToUI(text, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender === 'user' ? 'user-message' : 'ai-message');
    msgDiv.textContent = text;
    chatContainer.appendChild(msgDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function saveMemory() {
    localStorage.setItem('tutorHistory', JSON.stringify(chatHistory));
}

// --- THE BRAIN ---
async function handleSend(customPrompt = null) {
    if (isProcessing) return;
    const text = customPrompt || userInput.value.trim();
    if (!text) return;

    isProcessing = true;
    addXP(5); // 5 XP for every message

    if (!customPrompt) {
        addMessageToUI(text, 'user');
        chatHistory.push({ text: text, sender: 'user' });
        userInput.value = '';
        saveMemory();
    }

    const thinkingMsg = document.createElement('div');
    thinkingMsg.classList.add('message', 'ai-message');
    thinkingMsg.textContent = 'Thinking...';
    thinkingMsg.id = 'thinking-indicator';
    chatContainer.appendChild(thinkingMsg);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    let systemPrompt = "You are an expert personal tutor. Teach the student step-by-step. Use simple analogies, encourage critical thinking, and be highly intelligent.";

    if (lessonMaterial) {
        systemPrompt = `You are an expert teacher. The student has uploaded this material: \n\n---\n${lessonMaterial}\n---\n\nTeach this material step-by-step. Do not just summarize. Introduce the topic, teach one concept at a time, and ask questions to check understanding.`;
    }

    if (currentMode === 'quiz') {
        systemPrompt = `You are an examiner. Create a 3-question multiple-choice quiz based on the current lesson. Provide options A, B, C, D. DO NOT reveal the correct answers yet. Wait for the student's responses. After they answer, grade them, explain the correct answers, and add a brief encouragement.`;
        currentMode = 'chat'; // Reset mode after setting prompt
    } 
    else if (currentMode === 'feynman') {
        systemPrompt = `You are a curious student. The user will now explain a concept to you. Ask probing questions to find gaps in their understanding. If they are vague, ask for simpler explanations. DO NOT give them the answer, make them teach you.`;
        currentMode = 'chat';
    }
    else if (customPrompt && customPrompt.includes("Make Notes")) {
        systemPrompt = `You are an expert note-taker. Based on the conversation history, create a structured, easy-to-study set of notes. Use headings, bullet points, and a summary.`;
        addXP(20); // Big XP for making notes
    }

    const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...chatHistory.map(msg => ({ role: msg.sender === 'user' ? 'user' : 'assistant', content: msg.text }))
    ];

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'openai/gpt-oss-120b', 
                messages: apiMessages,
                temperature: 0.7,
                max_tokens: 2000
            })
        });

        const data = await response.json();
        document.getElementById('thinking-indicator').remove();

        if (data.error) {
            addMessageToUI(`Error: ${data.error.message}`, 'ai');
            isProcessing = false;
            return;
        }

        const aiResponse = data.choices[0].message.content;
        addMessageToUI(aiResponse, 'ai');
        chatHistory.push({ text: aiResponse, sender: 'ai' });
        saveMemory();

        // Gamified Feedback
        if (aiResponse.toLowerCase().includes("correct") || aiResponse.toLowerCase().includes("excellent") || aiResponse.toLowerCase().includes("great job")) {
            addXP(15); // Bonus XP for correct answers
        }

    } catch (error) {
        document.getElementById('thinking-indicator').remove();
        addMessageToUI("Network error.", 'ai');
        console.error(error);
    }
    isProcessing = false;
}

// --- EVENT LISTENERS ---
sendBtn.addEventListener('click', () => handleSend());
userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSend(); });

quizBtn.addEventListener('click', () => {
    if (chatHistory.length === 0) { alert("Chat with your tutor first!"); return; }
    currentMode = 'quiz';
    handleSend("Quiz me on what we've learned so far. Give me 3 multiple-choice questions.");
});

feynmanBtn.addEventListener('click', () => {
    if (chatHistory.length === 0) { alert("Chat with your tutor first!"); return; }
    currentMode = 'feynman';
    handleSend("I want to use the Feynman Technique. Act like a confused student and let me explain this topic to you. Ask me probing questions.");
});

makeNotesBtn.addEventListener('click', () => {
    if (chatHistory.length === 0) { alert("Chat first!"); return; }
    handleSend("Please make structured study notes from our conversation so far.");
});

document.getElementById('clear-memory-chat').addEventListener('click', () => {
    if (confirm("Erase all memory and start a new session?")) {
        chatHistory = [];
        lessonMaterial = null;
        localStorage.clear();
        renderHistory();
        lessonStatus.textContent = "No file uploaded";
        userXP = 0; userLevel = 1; updateXPUI();
    }
});

// Initialize
updateXPUI();
renderHistory();
