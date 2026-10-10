// AI English Coach - Architecture Compliant Logic

const GROQ_API_KEY = window.APP_CONFIG.GROQ_API_KEY;
const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const micBtn = document.getElementById('mic-btn');
const voiceStatus = document.getElementById('voice-status');
const characterFace = document.querySelector('.character-face');
const chooseVoiceBtn = document.getElementById('choose-voice-btn');

let chatHistory = JSON.parse(localStorage.getItem('englishCoachHistory')) || [];
let recognition;
let isListening = false;

// --- THE STATE CONTROLLER (Fixes the spam bug) ---
let appState = 'IDLE'; // IDLE, LISTENING, THINKING, SPEAKING

function setState(newState) {
    appState = newState;
    console.log("State changed to: " + appState);

    // Lock/Unlock controls based on state
    if (appState === 'THINKING' || appState === 'SPEAKING') {
        sendBtn.disabled = true;
        micBtn.disabled = true;
        sendBtn.style.opacity = '0.5';
        micBtn.style.opacity = '0.5';
    } else {
        sendBtn.disabled = false;
        micBtn.disabled = false;
        sendBtn.style.opacity = '1';
        micBtn.style.opacity = '1';
    }

    // Update UI status
    if (appState === 'THINKING') voiceStatus.textContent = '🧠 Thinking...';
    if (appState === 'SPEAKING') voiceStatus.textContent = '🔊 AI is speaking...';
    if (appState === 'LISTENING') voiceStatus.textContent = '🎙️ Listening... Speak now.';
    if (appState === 'IDLE') voiceStatus.textContent = 'Your turn...';
}

// --- SPEECH RECOGNITION (STT) ---
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        isListening = true;
        setState('LISTENING');
    };

    recognition.onresult = (event) => {
        userInput.value = event.results[0][0].transcript;
        handleSend();
    };

    recognition.onerror = (event) => {
        setState('IDLE');
    };

    recognition.onend = () => {
        isListening = false;
        if (appState === 'LISTENING') setState('IDLE');
    };
}

// --- NATURAL VOICE (GROQ TTS) ---
async function playNaturalVoice(text) {
    setState('SPEAKING');
    characterFace.classList.add('speaking');

    try {
        // Request high-quality audio from Groq
        const response = await fetch('https://api.groq.com/openai/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'canopylabs/orpheus-v1-english',
                input: text,
                voice: 'tara', // Natural female voice. Can be changed to 'leah', 'jess', 'leo', 'dan'
                response_format: 'wav'
            })
        });

        if (!response.ok) {
            throw new Error("TTS API failed");
        }

        // Convert the response to an audio file and play it
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);

        audio.onended = () => {
            characterFace.classList.remove('speaking');
            setState('IDLE');
        };

        audio.play();

    } catch (error) {
        console.error("TTS Error:", error);
        voiceStatus.textContent = 'Voice error, reading text.';
        characterFace.classList.remove('speaking');
        setState('IDLE');
    }
}

// --- UI & MEMORY ---
function renderHistory() {
    chatContainer.innerHTML = '';
    chatHistory.forEach(msg => addMessageToUI(msg.text, msg.sender));
}

function addMessageToUI(text, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender === 'user' ? 'user-message' : 'ai-message');
    msgDiv.textContent = text;
    chatContainer.appendChild(msgDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function saveMemory() {
    localStorage.setItem('englishCoachHistory', JSON.stringify(chatHistory));
}

// --- API CALL (LLM) ---
async function handleSend() {
    if (appState === 'THINKING' || appState === 'SPEAKING') return; // Double safety

    const text = userInput.value.trim();
    if (!text) return;

    setState('THINKING');
    addMessageToUI(text, 'user');
    chatHistory.push({ text: text, sender: 'user' });
    userInput.value = '';
    saveMemory();

    const thinkingMsg = document.createElement('div');
    thinkingMsg.classList.add('message', 'ai-message');
    thinkingMsg.textContent = '...';
    thinkingMsg.id = 'thinking-indicator';
    chatContainer.appendChild(thinkingMsg);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    const apiMessages = [
        { role: 'system', content: 'You are an expert English AI Coach. Correct grammar mistakes gently, explain new vocabulary, and encourage the user to speak naturally. Keep responses concise and conversational. Do not use markdown formatting.' },
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
                max_tokens: 300
            })
        });

        const data = await response.json();
        document.getElementById('thinking-indicator').remove();

        if (data.error) {
            addMessageToUI(`Error: ${data.error.message}`, 'ai');
            setState('IDLE');
            return;
        }

        const aiResponse = data.choices[0].message.content;
        addMessageToUI(aiResponse, 'ai');
        chatHistory.push({ text: aiResponse, sender: 'ai' });
        saveMemory();

        // Play the natural voice
        await playNaturalVoice(aiResponse);

    } catch (error) {
        document.getElementById('thinking-indicator').remove();
        addMessageToUI("Network error.", 'ai');
        setState('IDLE');
    }
}

// --- NAVIGATION & EVENT LISTENERS ---
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
    if (screenId === 'voice-screen') setState('IDLE');
}

sendBtn.addEventListener('click', handleSend);
userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSend(); });

micBtn.addEventListener('click', () => {
    if (appState !== 'IDLE') return; // Don't listen if busy
    if (isListening) recognition.stop();
    else recognition.start();
});

chooseVoiceBtn.addEventListener('click', () => {
    alert("Voice selection menu: Tara, Leah, Jess, Leo, Dan (Coming soon!)");
});

document.getElementById('clear-memory-chat').addEventListener('click', () => {
    if (confirm("Erase all memory?")) {
        chatHistory = [];
        localStorage.clear();
        renderHistory();
        setState('IDLE');
    }
});

renderHistory();
setState('IDLE');
