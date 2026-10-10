// AI Personal Tutor - Advanced Teacher Mode with File Upload & Timer

const GROQ_API_KEY = window.APP_CONFIG.GROQ_API_KEY;
const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const makeNotesBtn = document.getElementById('make-notes-btn');
const fileUpload = document.getElementById('file-upload');
const lessonStatus = document.getElementById('lesson-status');
const studyTimer = document.getElementById('study-timer');

let chatHistory = JSON.parse(localStorage.getItem('tutorHistory')) || [];
let lessonMaterial = localStorage.getItem('tutorLesson') || null;
let isProcessing = false;
let timerInterval = null;
let secondsElapsed = 0;

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
    if (screenId === 'chat-screen') {
        startTimer(); // Timer starts when entering chat
    } else {
        clearInterval(timerInterval); // Pause timer when leaving
    }
}

// --- FILE UPLOAD LOGIC ---
fileUpload.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        lessonMaterial = e.target.result;
        localStorage.setItem('tutorLesson', lessonMaterial);
        lessonStatus.textContent = `📄 ${file.name} loaded`;
        
        // Switch to chat screen and start teacher mode
        showScreen('chat-screen');
        chatContainer.innerHTML = ''; // Clear UI for new lesson
        chatHistory = []; // Reset history for new lesson
        saveMemory();
        
        const introMsg = `I have uploaded a file named "${file.name}". Please act as my teacher and teach me this material step-by-step. Start by introducing the topic and asking me what I already know.`;
        handleSend(introMsg);
    };
    reader.readAsText(file);
});

// --- UI & MEMORY ---
function renderHistory() {
    chatContainer.innerHTML = '';
    chatHistory.forEach(msg => addMessageToUI(msg.text, msg.sender));
    if (lessonMaterial) {
        lessonStatus.textContent = "📄 Lesson file loaded";
    }
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

    let systemPrompt = "You are an expert, patient, and highly intelligent personal tutor. Your goal is to teach the student deeply. Use simple analogies, step-by-step explanations, and encourage critical thinking.";

    // TEACHER MODE: If lesson material is loaded, use it!
    if (lessonMaterial) {
        systemPrompt = `You are an expert teacher. The student has uploaded the following lesson material: \n\n---\n${lessonMaterial}\n---\n\nYour task is to teach this material to the student step-by-step. Do not just summarize it. Introduce the topic, teach one concept at a time, ask questions to check their understanding, and correct their mistakes gently. Keep responses structured and encouraging.`;
    }

    if (customPrompt && customPrompt.includes("Make Notes")) {
        systemPrompt = `You are an expert note-taker. Based on the conversation history, create a structured, easy-to-study set of notes for the student. Use headings, bullet points, and a summary.`;
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
                temperature: 0.6,
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

    } catch (error) {
        document.getElementById('thinking-indicator').remove();
        addMessageToUI("Network error. Please check your internet connection.", 'ai');
        console.error(error);
    }
    isProcessing = false;
}

// --- EVENT LISTENERS ---
sendBtn.addEventListener('click', () => handleSend());
userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSend(); });

makeNotesBtn.addEventListener('click', () => {
    if (chatHistory.length === 0) {
        alert("Chat with your tutor first so I have something to make notes from!");
        return;
    }
    handleSend("Please make structured study notes from our conversation so far. Make it easy to review.");
});

document.getElementById('clear-memory-chat').addEventListener('click', () => {
    if (confirm("Erase all memory and start a new session?")) {
        chatHistory = [];
        lessonMaterial = null;
        localStorage.clear();
        renderHistory();
        lessonStatus.textContent = "No file uploaded";
    }
});

renderHistory();
