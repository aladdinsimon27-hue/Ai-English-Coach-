// AI Personal Tutor - Multi-Subject & Note Maker

const GROQ_API_KEY = window.APP_CONFIG.GROQ_API_KEY;
const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const subjectSelector = document.getElementById('subject-selector');
const makeNotesBtn = document.getElementById('make-notes-btn');

let chatHistory = JSON.parse(localStorage.getItem('tutorHistory')) || [];
let isProcessing = false;

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
}

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
    localStorage.setItem('tutorHistory', JSON.stringify(chatHistory));
}

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

    const subject = subjectSelector.value;
    
    let systemPrompt = `You are an expert, patient, and highly intelligent ${subject} tutor. Your goal is to teach the student deeply, not just give answers. Use simple analogies, step-by-step explanations, and encourage critical thinking.`;
    
    if (customPrompt && customPrompt.includes("Make Notes")) {
        systemPrompt = `You are an expert note-taker. Based on the conversation history, create a structured, easy-to-study set of notes for a ${subject} student. Use headings, bullet points, and a summary. Format it beautifully with text only.`;
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
                max_tokens: 1500
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
        localStorage.clear();
        renderHistory();
    }
});

renderHistory();
