// AI Personal Tutor 90+ - 3D Animated Robot & Personalized Tutors

const GROQ_API_KEY = window.APP_CONFIG.GROQ_API_KEY;
const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const lessonStatus = document.getElementById('lesson-status');
const studyTimer = document.getElementById('study-timer');
const mainXpBar = document.getElementById('main-xp-bar');
const headerLevel = document.getElementById('header-level');
const robotNameBadge = document.getElementById('robot-name-badge');

let chatHistory = JSON.parse(localStorage.getItem('tutorHistory')) || [];
let lessonMaterial = localStorage.getItem('tutorLesson') || null;
let isProcessing = false;
let timerInterval = null;
let secondsElapsed = 0;
let currentMode = 'chat';

// --- TUTOR SELECTION ---
let currentTutor = JSON.parse(localStorage.getItem('tutorProfile')) || { name: 'Nova', style: 'friendly and encouraging', color: '#87CEEB' };
robotNameBadge.textContent = currentTutor.name;

function selectTutor(name, style, color) {
    currentTutor = { name, style, color };
    localStorage.setItem('tutorProfile', JSON.stringify(currentTutor));
    robotNameBadge.textContent = name;
    alert(`You have chosen ${name} as your tutor!`);
    showScreen('chat-screen');
}

// --- 3D ROBOT ENGINE (Three.js) ---
let scene, camera, renderer, robotGroup, head, leftEye, rightEye, mouth, leftArm, rightArm;
let clock = new THREE.Clock();

function init3DRobot() {
    const canvas = document.getElementById('robot-canvas');
    const container = document.getElementById('robot-container');
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 8);
    
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    scene.add(directionalLight);
    const pointLight = new THREE.PointLight(0x00ffff, 1, 20);
    pointLight.position.set(0, 0, 5);
    scene.add(pointLight);

    // Create Robot Group
    robotGroup = new THREE.Group();
    
    // Body
    const bodyGeo = new THREE.CylinderGeometry(1.2, 1, 2, 32);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.2, metalness: 0.5 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = -0.5;
    robotGroup.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(1.1, 32, 32);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.2, metalness: 0.5 });
    head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.5;
    robotGroup.add(head);

    // Visor (Face screen)
    const visorGeo = new THREE.BoxGeometry(1.6, 0.8, 0.2);
    const visorMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.8 });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 1.5, 1.05);
    robotGroup.add(visor);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.15, 16, 16);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.4, 1.6, 1.15);
    robotGroup.add(leftEye);
    rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.4, 1.6, 1.15);
    robotGroup.add(rightEye);

    // Mouth (for lip-sync)
    const mouthGeo = new THREE.BoxGeometry(0.4, 0.05, 0.1);
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    mouth = new THREE.Mesh(mouthGeo, mouthMat);
    mouth.position.set(0, 1.25, 1.15);
    robotGroup.add(mouth);

    // Arms
    const armGeo = new THREE.CylinderGeometry(0.15, 0.15, 1.5);
    const armMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee });
    leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-1.4, 0, 0);
    leftArm.rotation.z = 0.5;
    robotGroup.add(leftArm);
    rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(1.4, 0, 0);
    rightArm.rotation.z = -0.5;
    robotGroup.add(rightArm);

    scene.add(robotGroup);
    animate3D();
}

function animate3D() {
    requestAnimationFrame(animate3D);
    const time = clock.getElapsedTime();

    // Idle floating
    robotGroup.position.y = Math.sin(time * 2) * 0.1;
    head.rotation.y = Math.sin(time * 0.5) * 0.2; // Look around
    head.rotation.x = Math.sin(time * 0.8) * 0.1;

    // Blinking (simulate by scaling eyes)
    const blink = Math.sin(time * 3) > 0.95 ? 0.1 : 1;
    leftEye.scale.y = blink;
    rightEye.scale.y = blink;

    // Wave arm occasionally
    if (Math.sin(time * 0.5) > 0.9) {
        rightArm.rotation.z = -1.5 + Math.sin(time * 10) * 0.5;
    } else {
        rightArm.rotation.z = -0.5;
    }

    renderer.render(scene, camera);
}

// --- SPEAKING ANIMATION ---
function animateMouth(isSpeaking) {
    if (isSpeaking) {
        mouth.scale.y = Math.random() * 2 + 1; // Random mouth movement
        setTimeout(() => animateMouth(isSpeaking), 100);
    } else {
        mouth.scale.y = 1; // Reset
    }
}

// --- GAMIFICATION (XP & LEVELS) ---
let userXP = parseInt(localStorage.getItem('tutorXP')) || 0;
let userLevel = parseInt(localStorage.getItem('tutorLevel')) || 1;

function updateXPUI() {
    const xpNeeded = userLevel * 100;
    const progress = (userXP % xpNeeded) / xpNeeded * 100;
    mainXpBar.style.width = `${progress}%`;
    headerLevel.textContent = userLevel;
    if (userXP >= xpNeeded) {
        userLevel++; userXP = 0;
        localStorage.setItem('tutorXP', userXP);
        localStorage.setItem('tutorLevel', userLevel);
        alert(`🎉 LEVEL UP! You are now Level ${userLevel}.`);
        updateXPUI();
    }
}
function addXP(amount) { userXP += amount; localStorage.setItem('tutorXP', userXP); updateXPUI(); }

// --- TIMER ---
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
        startTimer();
        if (!renderer) init3DRobot(); // Initialize 3D on first load
    } else {
        clearInterval(timerInterval);
    }
}

// --- FILE UPLOAD ---
document.getElementById('file-upload').addEventListener('change', (event) => {
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
        handleSend(`I have uploaded a file named "${file.name}". Please act as my ${currentTutor.name} and teach me this material step-by-step.`);
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
function saveMemory() { localStorage.setItem('tutorHistory', JSON.stringify(chatHistory)); }

// --- THE BRAIN ---
async function handleSend(customPrompt = null) {
    if (isProcessing) return;
    const text = customPrompt || userInput.value.trim();
    if (!text) return;
    isProcessing = true;
    addXP(5);

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

    let systemPrompt = `You are ${currentTutor.name}, a tutor whose teaching style is ${currentTutor.style}. Teach the student step-by-step. Encourage critical thinking.`;

    if (lessonMaterial) {
        systemPrompt = `You are ${currentTutor.name} (style: ${currentTutor.style}). The student has uploaded this material: \n\n---\n${lessonMaterial}\n---\n\nTeach this material step-by-step. Introduce the topic, teach one concept at a time, and ask questions to check understanding.`;
    }
    if (currentMode === 'quiz') {
        systemPrompt = `You are an examiner. Create a 3-question multiple-choice quiz based on the current lesson. Provide options A, B, C, D. DO NOT reveal the correct answers yet.`;
        currentMode = 'chat';
    } else if (currentMode === 'feynman') {
        systemPrompt = `You are a curious student. The user will explain a concept to you. Ask probing questions to find gaps in their understanding. DO NOT give them the answer, make them teach you.`;
        currentMode = 'chat';
    } else if (customPrompt && customPrompt.includes("Make Notes")) {
        systemPrompt = `You are an expert note-taker. Create structured, easy-to-study notes.`;
        addXP(20);
    }

    const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...chatHistory.map(msg => ({ role: msg.sender === 'user' ? 'user' : 'assistant', content: msg.text }))
    ];

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'openai/gpt-oss-120b', messages: apiMessages, temperature: 0.7, max_tokens: 2000 })
        });

        const data = await response.json();
        document.getElementById('thinking-indicator').remove();

        if (data.error) { addMessageToUI(`Error: ${data.error.message}`, 'ai'); isProcessing = false; return; }

        const aiResponse = data.choices[0].message.content;
        addMessageToUI(aiResponse, 'ai');
        chatHistory.push({ text: aiResponse, sender: 'ai' });
        saveMemory();

        if (aiResponse.toLowerCase().includes("correct") || aiResponse.toLowerCase().includes("excellent") || aiResponse.toLowerCase().includes("great job")) addXP(15);

        // Trigger speaking animation
        animateMouth(true);
        setTimeout(() => animateMouth(false), 3000); // Stop after 3 seconds

    } catch (error) {
        document.getElementById('thinking-indicator').remove();
        addMessageToUI("Network error.", 'ai');
    }
    isProcessing = false;
}

// --- EVENT LISTENERS ---
sendBtn.addEventListener('click', () => handleSend());
userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSend(); });

document.getElementById('quiz-btn').addEventListener('click', () => {
    if (chatHistory.length === 0) { alert("Chat first!"); return; }
    currentMode = 'quiz'; handleSend("Quiz me. Give me 3 multiple-choice questions.");
});
document.getElementById('feynman-btn').addEventListener('click', () => {
    if (chatHistory.length === 0) { alert("Chat first!"); return; }
    currentMode = 'feynman'; handleSend("I want to use the Feynman Technique. Act like a confused student and let me explain this topic to you.");
});
document.getElementById('make-notes-btn').addEventListener('click', () => {
    if (chatHistory.length === 0) { alert("Chat first!"); return; }
    handleSend("Please make structured study notes from our conversation so far.");
});
document.getElementById('clear-memory-chat').addEventListener('click', () => {
    if (confirm("Erase all memory?")) {
        chatHistory = []; lessonMaterial = null; localStorage.clear();
        renderHistory(); lessonStatus.textContent = "No file uploaded";
        userXP = 0; userLevel = 1; updateXPUI();
    }
});

// Initialize
updateXPUI();
renderHistory();
