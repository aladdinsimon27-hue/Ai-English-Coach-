// AI EduSchool - Module 2: Vision, Voice, and Memory

const GROQ_API_KEY = window.APP_CONFIG ? window.APP_CONFIG.GROQ_API_KEY : 'NO_KEY';
const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

let profile = JSON.parse(localStorage.getItem('eduProfile')) || null;
let chatHistory = JSON.parse(localStorage.getItem('tutorHistory')) || [];
let isProcessing = false;
let currentMode = 'chat';
let timerInterval = null, secondsElapsed = 0;
let selectedTutor = 'Nova';
let currentSubject = 'General';

// --- TTS (VOICE) LOGIC ---
function speakText(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel(); // stop previous speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    
    utterance.onstart = () => { if (mouth) animateMouth(true); };
    utterance.onend = () => { if (mouth) animateMouth(false); };

    window.speechSynthesis.speak(utterance);
}

function animateMouth(isSpeaking) {
    if (isSpeaking) {
        mouth.scale.y = Math.random() * 2 + 1;
        setTimeout(() => animateMouth(isSpeaking), 100);
    } else {
        mouth.scale.y = 1;
    }
}

// --- ONBOARDING & MEMORY ---
function selectOnboardTutor(name, el) {
    document.querySelectorAll('.tutor-opt').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    selectedTutor = name;
}

function finishOnboarding() {
    const name = document.getElementById('onboard-name').value.trim() || 'Student';
    const grade = document.getElementById('onboard-grade').value;
    const curriculum = document.getElementById('onboard-curriculum').value;
    profile = { name, grade, curriculum, tutor: selectedTutor, xp: 0, level: 1, memory: '' };
    localStorage.setItem('eduProfile', JSON.stringify(profile));
    checkAppState();
}

function saveMemoryInstructions() {
    const memoryText = document.getElementById('ai-memory-input').value.trim();
    profile.memory = memoryText;
    localStorage.setItem('eduProfile', JSON.stringify(profile));
    alert("AI Memory Saved! The tutor will remember this.");
}

// --- APP INITIALIZATION ---
function checkAppState() {
    if (!profile) {
        document.getElementById('onboarding-screen').classList.remove('hidden');
        document.getElementById('app-shell').classList.add('hidden');
    } else {
        document.getElementById('onboarding-screen').classList.add('hidden');
        document.getElementById('app-shell').classList.remove('hidden');
        loadDashboard();
        switchTab('dashboard-screen');
    }
}

function loadDashboard() {
    document.getElementById('dash-name').textContent = profile.name;
    document.getElementById('dash-context').textContent = `Grade ${profile.grade} • ${profile.curriculum}`;
    document.getElementById('dash-level').textContent = profile.level;
    document.getElementById('robot-name-badge').textContent = profile.tutor;
    document.getElementById('prof-name').textContent = profile.name;
    document.getElementById('prof-grade').textContent = profile.grade;
    document.getElementById('prof-curr').textContent = profile.curriculum;
    document.getElementById('prof-tutor').textContent = profile.tutor;
    document.getElementById('ai-memory-input').value = profile.memory || '';
    updateXPUI();
}

function updateXPUI() {
    if (!profile) return;
    const xpNeeded = profile.level * 100;
    document.getElementById('dash-xp-bar').style.width = `${(profile.xp % xpNeeded) / xpNeeded * 100}%`;
}

function addXP(amount) {
    if (!profile) return;
    profile.xp += amount;
    if (profile.xp >= profile.level * 100) { profile.level++; profile.xp = 0; alert(`🎉 LEVEL UP! Level ${profile.level}.`); }
    localStorage.setItem('eduProfile', JSON.stringify(profile));
    loadDashboard();
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
    if (tabId === 'tutor-screen') { startTimer(); if (!renderer) init3DRobot(); } else { clearInterval(timerInterval); }
}

function openTutor(subject) {
    currentSubject = subject;
    document.getElementById('current-subject-title').textContent = subject;
    switchTab('tutor-screen');
    handleSend(`Let's study ${subject} for Grade ${profile.grade}. Introduce the topic we should start with.`);
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    secondsElapsed = 0;
    timerInterval = setInterval(() => {
        secondsElapsed++;
        const h = String(Math.floor(secondsElapsed / 3600)).padStart(2, '0');
        const m = String(Math.floor((secondsElapsed % 3600) / 60)).padStart(2, '0');
        const s = String(secondsElapsed % 60).padStart(2, '0');
        document.getElementById('study-timer').textContent = `⏱️ ${h}:${m}:${s}`;
    }, 1000);
}

// --- 3D ROBOT ---
let scene, camera, renderer, robotGroup, head, leftEye, rightEye, mouth, rightArm, clock = new THREE.Clock();
function init3DRobot() {
    const canvas = document.getElementById('robot-canvas');
    const container = document.getElementById('robot-container');
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 8);
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8); dir.position.set(5, 10, 7); scene.add(dir);
    robotGroup = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1, 2, 32), new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.2, metalness: 0.5 }));
    body.position.y = -0.5; robotGroup.add(body);
    head = new THREE.Mesh(new THREE.SphereGeometry(1.1, 32, 32), new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.2, metalness: 0.5 }));
    head.position.y = 1.5; robotGroup.add(head);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.2), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.8 }));
    visor.position.set(0, 1.5, 1.05); robotGroup.add(visor);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), eyeMat); leftEye.position.set(-0.4, 1.6, 1.15); robotGroup.add(leftEye);
    rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), eyeMat); rightEye.position.set(0.4, 1.6, 1.15); robotGroup.add(rightEye);
    mouth = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.1), eyeMat); mouth.position.set(0, 1.25, 1.15); robotGroup.add(mouth);
    rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.5), new THREE.MeshStandardMaterial({ color: 0xeeeeee }));
    rightArm.position.set(1.4, 0, 0); rightArm.rotation.z = -0.5; robotGroup.add(rightArm);
    scene.add(robotGroup);
    animate3D();
}
function animate3D() {
    requestAnimationFrame(animate3D);
    if (!robotGroup) return;
    const time = clock.getElapsedTime();
    robotGroup.position.y = Math.sin(time * 2) * 0.1;
    head.rotation.y = Math.sin(time * 0.5) * 0.2;
    const blink = Math.sin(time * 3) > 0.95 ? 0.1 : 1;
    leftEye.scale.y = blink; rightEye.scale.y = blink;
    if (Math.sin(time * 0.5) > 0.9) rightArm.rotation.z = -1.5 + Math.sin(time * 10) * 0.5;
    else rightArm.rotation.z = -0.5;
    renderer.render(scene, camera);
}

// --- FILE / IMAGE UPLOAD LOGIC ---
document.getElementById('file-upload').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => handleSend(`I have uploaded a text file. Please teach me this material: \n\n${e.target.result}`);
    reader.readAsText(file);
});

document.getElementById('image-upload').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        // Sends a special flag for images
        handleSend("I have uploaded an image of a problem. Please read it and solve it step-by-step.", e.target.result);
    };
    reader.readAsDataURL(file);
});

// --- AI BRAIN (WITH VISION & MEMORY) ---
async function handleSend(customPrompt = null, imageBase64 = null) {
    if (isProcessing || !profile) return;
    const text = customPrompt || userInput.value.trim();
    if (!text) return;
    isProcessing = true;
    addXP(5);

    if (!customPrompt) {
        addMessageToUI(text, 'user');
        chatHistory.push({ text: text, sender: 'user' });
        userInput.value = '';
        localStorage.setItem('tutorHistory', JSON.stringify(chatHistory));
    } else {
        // Show the user's system upload in the chat
        addMessageToUI(customPrompt, 'user');
    }

    const think = document.createElement('div');
    think.className = 'message ai-message'; think.textContent = 'Analyzing...'; think.id = 'think';
    chatContainer.appendChild(think); chatContainer.scrollTop = chatContainer.scrollHeight;

    // Context-Aware System Prompt with Memory!
    let systemPrompt = `You are ${profile.tutor}, an expert AI tutor for a Grade ${profile.grade} student in the ${profile.curriculum}. Tone: ${profile.tutor === 'Nova' ? 'friendly' : profile.tutor === 'Atlas' ? 'strict' : 'funny'}.`;
    if (profile.memory) systemPrompt += ` \nCRITICAL STUDENT MEMORY: ${profile.memory}. Adapt your teaching to this.`;
    
    if (currentMode === 'quiz') { systemPrompt += ` \nGenerate a 3-question quiz.`; currentMode = 'chat'; }
    if (currentMode === 'feynman') { systemPrompt += ` \nAct confused. Let the student explain to you.`; currentMode = 'chat'; }

    // Prepare Messages (Vision vs Text)
    let messages = [{ role: 'system', content: systemPrompt }];
    
    // Add history
    chatHistory.forEach(m => messages.push({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }));

    // Handle Image
    if (imageBase64) {
        messages.push({
            role: 'user',
            content: [
                { type: "text", text: "Solve the problem in this image." },
                { type: "image_url", image_url: { url: imageBase64 } }
            ]
        });
    } else {
        messages.push({ role: 'user', content: text });
    }

    // Use Vision model if there is an image, otherwise standard text model
    const modelToUse = imageBase64 ? 'llama-3.2-11b-vision-preview' : 'openai/gpt-oss-120b';

    try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: modelToUse, messages, temperature: 0.6, max_tokens: 2000 })
        });

        const data = await res.json();
        document.getElementById('think').remove();
        if (data.error) { addMessageToUI(`Error: ${data.error.message}`, 'ai'); isProcessing = false; return; }

        const aiResponse = data.choices[0].message.content;
        addMessageToUI(aiResponse, 'ai');
        chatHistory.push({ text: aiResponse, sender: 'ai' });
        localStorage.setItem('tutorHistory', JSON.stringify(chatHistory));

        if (aiResponse.toLowerCase().includes("correct") || aiResponse.toLowerCase().includes("great job")) addXP(15);

        // Make the AI speak!
        speakText(aiResponse);

    } catch (e) {
        document.getElementById('think').remove();
        addMessageToUI("Network error.", 'ai');
    }
    isProcessing = false;
}

function addMessageToUI(text, sender) {
    const div = document.createElement('div');
    div.className = `message ${sender === 'user' ? 'user-message' : 'ai-message'}`;
    div.textContent = text;
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// --- EVENTS ---
sendBtn.addEventListener('click', () => handleSend());
userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSend(); });
document.getElementById('quiz-btn').addEventListener('click', () => { currentMode = 'quiz'; handleSend("Quiz me."); });
document.getElementById('feynman-btn').addEventListener('click', () => { currentMode = 'feynman'; handleSend("Let me teach you."); });
document.getElementById('clear-chat').addEventListener('click', () => { if(confirm("Clear chat?")) { chatHistory = []; localStorage.removeItem('tutorHistory'); chatContainer.innerHTML = ''; } });

function resetApp() { if (confirm("Erase all data?")) { localStorage.clear(); location.reload(); } }

checkAppState();
