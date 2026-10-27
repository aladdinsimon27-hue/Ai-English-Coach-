// AI EduSchool - Pure Gemini Proxy, Fixed Input, Image Previews

const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const mainNav = document.getElementById('main-nav');
const bottomSheet = document.getElementById('bottom-sheet-overlay');

let profile = JSON.parse(localStorage.getItem('eduProfile')) || null;
let currentSubject = 'General';
let chatHistory = [];
let isProcessing = false;
let isThinkHarder = false;
let selectedImageBase64 = null; // Holds image until sent

// --- SUBJECT HISTORY ---
function loadHistoryForSubject(subject) {
    currentSubject = subject;
    chatHistory = JSON.parse(localStorage.getItem(`tutorHistory_${subject}`)) || [];
    renderHistory();
}
function saveHistory() { localStorage.setItem(`tutorHistory_${currentSubject}`, JSON.stringify(chatHistory)); }

// --- MENU & UI ---
function toggleBottomSheet() {
    bottomSheet.classList.toggle('hidden');
}
function triggerUpload(id) {
    document.getElementById(id).click();
    toggleBottomSheet();
}
function toggleThinkHarder() {
    isThinkHarder = !isThinkHarder;
    const btn = document.getElementById('think-harder-btn');
    if (isThinkHarder) { btn.classList.add('active'); btn.innerHTML = '<span>🧠</span> Think ON'; } 
    else { btn.classList.remove('active'); btn.innerHTML = '<span>🧠</span> Think'; }
    toggleBottomSheet();
}

// --- IMAGE PREVIEW ---
function handleImageSelect(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        selectedImageBase64 = e.target.result;
        document.getElementById('preview-img').src = selectedImageBase64;
        document.getElementById('preview-area').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}
function clearPreview() {
    selectedImageBase64 = null;
    document.getElementById('preview-area').classList.add('hidden');
    document.getElementById('camera-upload').value = '';
    document.getElementById('gallery-upload').value = '';
}
document.getElementById('camera-upload').addEventListener('change', handleImageSelect);
document.getElementById('gallery-upload').addEventListener('change', handleImageSelect);

document.getElementById('file-upload').addEventListener('change', (event) => {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        userInput.value = `I have uploaded a text file. Please teach me this material:\n\n${e.target.result}`;
        // We don't send immediately, let the user hit send!
    };
    reader.readAsText(file);
});

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

// --- INITIALIZATION ---
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
    profile = { name, grade: document.getElementById('onboard-grade').value, curriculum: document.getElementById('onboard-curriculum').value, xp: 0, level: 1 };
    localStorage.setItem('eduProfile', JSON.stringify(profile));
    checkAppState();
}
function loadDashboard() {
    document.getElementById('dash-name').textContent = profile.name;
    document.getElementById('dash-context').textContent = `Grade ${profile.grade} • ${profile.curriculum}`;
    document.getElementById('dash-level').textContent = profile.level;
    document.getElementById('prof-name').textContent = profile.name;
    document.getElementById('prof-grade').textContent = profile.grade;
    updateXPUI();
}
function updateXPUI() { if (!profile) return; document.getElementById('dash-xp-bar').style.width = `${(profile.xp % (profile.level * 100)) / (profile.level * 100) * 100}%`; }
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
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    
    if(tabId === 'dashboard-screen') document.getElementById('nav-home').classList.add('active');
    if(tabId === 'planner-screen') document.getElementById('nav-planner').classList.add('active');
    if(tabId === 'profile-screen') document.getElementById('nav-profile').classList.add('active');

    if (tabId === 'tutor-screen') { 
        mainNav.classList.add('hidden'); 
    } else { 
        mainNav.classList.remove('hidden'); 
    }
}

function openTutor(subject) {
    loadHistoryForSubject(subject);
    document.getElementById('current-subject-title').textContent = subject;
    switchTab('tutor-screen');
    if (chatHistory.length === 0) { 
        // Don't auto-send, let the user type first. Just show welcome message.
        renderHistory();
    }
}

// --- RENDER UI ---
function renderHistory() {
    chatContainer.innerHTML = '';
    if (chatHistory.length === 0) {
        const div = document.createElement('div');
        div.className = 'message ai-message';
        div.innerHTML = `Hello! I am your ${currentSubject} tutor. Ask me a question, upload an image, or tap + for tools.`;
        chatContainer.appendChild(div);
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

function handleQuickAction(action) {
    toggleBottomSheet();
    if (action === 'quiz') { userInput.value = "Quiz me on this subject. Give me 3 multiple-choice questions."; sendBtn.click(); }
    if (action === 'feynman') { userInput.value = "Let's use the Feynman technique. I will explain the current topic to you, and you act like a confused student asking me questions."; sendBtn.click(); }
}

// --- AI BRAIN ---
async function handleSend() {
    if (isProcessing || !profile) return;
    const text = userInput.value.trim(); 
    if (!text && !selectedImageBase64) return; // Prevent empty sends

    isProcessing = true; 
    addXP(5);
    bottomSheet.classList.add('hidden');
    sendBtn.style.opacity = '0.5'; // Show it's locked

    // Add User Message
    let displayText = text;
    if (selectedImageBase64) displayText = text ? `[Image Uploaded] ${text}` : `[Image Uploaded] Solve this.`;
    
    addMessageToUI(displayText, 'user'); 
    chatHistory.push({ text: displayText, sender: 'user' });
    
    // Clear input & preview immediately
    const currentImage = selectedImageBase64;
    userInput.value = ''; 
    clearPreview(); 
    saveHistory();

    // Show Thinking Indicator
    const think = document.createElement('div');
    think.className = 'message ai-message'; think.textContent = 'Thinking...'; think.id = 'think';
    chatContainer.appendChild(think); chatContainer.scrollTop = chatContainer.scrollHeight;

    // Build Prompts
    let systemPrompt = `You are ${profile.tutor || 'Nova'}, an expert AI ${currentSubject} tutor for a Grade ${profile.grade} student in the ${profile.curriculum}. Tone: friendly.`;
    if (isThinkHarder) systemPrompt += ` \nCRITICAL: This is a complex problem. Think step-by-step, verify your math/logic internally before answering.`;
    systemPrompt += ` \nCRITICAL FORMATTING RULES: 1. NEVER use Markdown tables. 2. Use bold text for key terms. 3. Include fun emojis. 4. Use plain text math (e.g., 'x^2'). 5. Links must use [Title](URL).`;

    let messages = [{ role: 'system', content: systemPrompt }];
    chatHistory.slice(-8).forEach(m => messages.push({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }));

    // Attach Image if present
    if (currentImage) {
        messages.push({ 
            role: 'user', 
            content: [
                { type: "text", text: text || "Solve the problem in this image." }, 
                { type: "image_url", image_url: { url: currentImage } }
            ] 
        });
    } else {
        messages.push({ role: 'user', content: text });
    }

    // Select Model
    let modelToUse = 'gemini-3.7-flash'; 
    if (currentImage) modelToUse = 'llama-3.2-11b-vision-instruct'; // Vision model for images
    else if (isThinkHarder) modelToUse = 'gemini-3.5-flash-thinking'; 

    try {
        // Fetch from Render proxy
        const res = await fetch('https://gemini-web2api-for-edu.onrender.com/v1/chat/completions', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: modelToUse, messages, temperature: 0.7, max_tokens: 2000 })
        });

        const data = await res.json();
        document.getElementById('think').remove();
        
        if (!res.ok || data.error) { 
            const errorMsg = data.error ? data.error.message : "Server is waking up. Wait 50s and try again.";
            addMessageToUI(`⚠️ Error: ${errorMsg}`, 'ai'); 
            return; 
        }

        const aiResponse = data.choices[0].message.content;
        
        addMessageToUI(aiResponse, 'ai', true);
        chatHistory.push({ text: aiResponse, sender: 'ai' }); saveHistory();

        if (aiResponse.toLowerCase().includes("correct")) addXP(15);

    } catch (e) {
        document.getElementById('think').remove();
        addMessageToUI("⚠️ Network Error. The Render server might be asleep. Please wait 1 minute and try again.", 'ai');
    } finally {
        // ALWAYS unlock the button, no matter what happens
        isProcessing = false; 
        sendBtn.style.opacity = '1';
    }
}

// --- EVENTS ---
sendBtn.addEventListener('click', handleSend);
userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSend(); });
function resetApp() { if (confirm("Erase all data?")) { localStorage.clear(); location.reload(); } }

checkAppState();
