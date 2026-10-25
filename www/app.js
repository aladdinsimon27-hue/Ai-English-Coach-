// AI EduSchool - Professional Markdown, Fast TTS, Voice Selector, Upgraded Robot

const GROQ_API_KEY = window.APP_CONFIG ? window.APP_CONFIG.GROQ_API_KEY : 'NO_KEY';
const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const ttsAudio = document.getElementById('tts-audio');

let profile = JSON.parse(localStorage.getItem('eduProfile')) || null;
let chatHistory = JSON.parse(localStorage.getItem('tutorHistory')) || [];
let isProcessing = false;
let currentMode = 'chat';
let timerInterval = null, secondsElapsed = 0;
let selectedTutor = 'Nova';

// --- MARKDOWN PARSER (Makes text look professional) ---
function parseMarkdown(text) {
    let html = text
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>')
        .replace(/^\s*\d+\.\s+(.*$)/gim, '<li>$1</li>')
        .replace(/\n/g, '<br>');
    
    // Wrap lists
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    return html;
}

// --- SMART AUDIO QUEUE (Faster playback) ---
let speechQueue = [];
let isSpeaking = false;

function animateMouth(moving) {
    if (moving) {
        mouth.scale.y = Math.random() * 2.5 + 0.5;
        if (isSpeaking) setTimeout(() => animateMouth(true), 100);
    } else {
        mouth.scale.y = 1;
    }
}

// Strips markdown for TTS so she doesn't read symbols
function cleanTextForTTS(text) {
    return text.replace(/[*#_|>]/g, '').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Increased chunk size to ~600 chars for faster generation
function splitTextIntoChunks(text) {
    let cleanText = cleanTextForTTS(text);
    let sentences = cleanText.match(/[^.!?]+[.!?]+/g) || [cleanText];
    let chunks = [];
    let currentChunk = "";

    sentences.forEach(sentence => {
        if ((currentChunk + sentence).length < 600) {
            currentChunk += sentence + " ";
        } else {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = sentence + " ";
        }
    });
    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks;
}

async function playGroqTTS(text) {
    ttsAudio.pause();
    speechQueue = splitTextIntoChunks(text);
    isSpeaking = true;
    
    if (speechQueue.length > 0) {
        animateMouth(true);
        playNextChunk();
    }
}

async function playNextChunk() {
    if (!isSpeaking || speechQueue.length === 0) {
        isSpeaking = false;
        animateMouth(false);
        return;
    }

    const chunk = speechQueue.shift();
    const voice = profile.voice || 'diana'; // Use selected voice
    
    try {
        const response = await fetch('https://api.groq.com/openai/v1/audio/speech', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'canopylabs/orpheus-v1-english', input: chunk, voice: voice, response_format: 'wav' })
        });

        if (!response.ok) throw new Error('TTS Network error');
        const audioBlob = await response.blob();
        
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
            ttsAudio.src = reader.result;
            ttsAudio.play().catch(e => { isSpeaking = false; animateMouth(false); });
        };
    } catch (error) {
        isSpeaking = false;
        animateMouth(false);
    }
}

ttsAudio.onended = () => { if (isSpeaking) playNextChunk(); else animateMouth(false); };
ttsAudio.onerror = () => { isSpeaking = false; animateMouth(false); };

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
function finishOnboarding() {
    const name = document.getElementById('onboard-name').value.trim() || 'Student';
    const grade = document.getElementById('onboard-grade').value;
    const curriculum = document.getElementById('onboard-curriculum').value;
    profile = { name, grade, curriculum, tutor: selectedTutor, voice: 'diana', xp: 0, level: 1, memory: '' };
    localStorage.setItem('eduProfile', JSON.stringify(profile));
    checkAppState();
}
function selectOnboardTutor(name, el) {
    document.querySelectorAll('.tutor-opt').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    selectedTutor = name;
}
function saveSettings() {
    profile.memory = document.getElementById('ai-memory-input').value.trim();
    profile.voice = document.getElementById('voice-selector').value;
    localStorage.setItem('eduProfile', JSON.stringify(profile));
    alert("Settings Saved! Voice updated.");
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
    document.getElementById('voice-selector').value = profile.voice || 'diana';
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
    localStorage.setItem('eduProfile', JSON.stringify(profile));
    loadDashboard();
}
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
    if (tabId === 'tutor-screen') { startTimer(); if (!renderer) init3DRobot(); } else { clearInterval(timerInterval); }
}
function openTutor(subject) {
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

// --- 3D ROBOT (EXACT MATCH TO YOUR IMAGE) ---
let scene, camera, renderer, robotGroup, head, leftEye, rightEye, mouth, leftArm, rightArm, clock = new THREE.Clock();
function init3DRobot() {
    const canvas = document.getElementById('robot-canvas');
    const container = document.getElementById('robot-container');
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 1, 9);
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9); dir.position.set(5, 10, 7); scene.add(dir);

    robotGroup = new THREE.Group();
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.1, metalness: 0.2 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.2, metalness: 0.8 });
    const cyanGlow = new THREE.MeshBasicMaterial({ color: 0x00ffff });

    // HEAD
    head = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 1.2), whiteMat);
    head.position.y = 2.5; robotGroup.add(head);
    
    // VISOR (Black Screen)
    const visor = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 0.1), darkMat);
    visor.position.set(0, 2.5, 0.6); robotGroup.add(visor);

    // EYES (Cyan Half-Spheres for the happy look)
    leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16, 0, Math.PI), cyanGlow); leftEye.rotation.x = Math.PI/2; leftEye.position.set(-0.4, 2.6, 0.66); robotGroup.add(leftEye);
    rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16, 0, Math.PI), cyanGlow); rightEye.rotation.x = Math.PI/2; rightEye.position.set(0.4, 2.6, 0.66); robotGroup.add(rightEye);

    // MOUTH (Cyan Smile)
    mouth = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 8, 16, Math.PI), cyanGlow);
    mouth.rotation.x = Math.PI; mouth.position.set(0, 2.35, 0.66); robotGroup.add(mouth);

    // BODY
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.8, 1.6, 32), whiteMat);
    body.position.y = 0.9; robotGroup.add(body);

    // CHEST (Ring & Glow)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 16, 32), darkMat);
    ring.position.set(0, 1.1, 1.05); robotGroup.add(ring);
    const chestGlow = new THREE.Mesh(new THREE.CircleGeometry(0.2, 32), cyanGlow);
    chestGlow.position.set(0, 1.1, 1.06); robotGroup.add(chestGlow);

    // ARMS
    const armGeo = new THREE.CylinderGeometry(0.15, 0.15, 1, 16);
    const jointGeo = new THREE.SphereGeometry(0.2, 16, 16);
    
    // Left Arm
    leftArm = new THREE.Group();
    const lUpper = new THREE.Mesh(armGeo, whiteMat); lUpper.position.y = 0.5; leftArm.add(lUpper);
    const lJoint = new THREE.Mesh(jointGeo, darkMat); leftArm.add(lJoint);
    const lFore = new THREE.Mesh(armGeo, whiteMat); lFore.position.y = -0.5; leftArm.add(lFore);
    leftArm.position.set(-1.3, 1.4, 0); leftArm.rotation.z = 0.6; robotGroup.add(leftArm);

    // Right Arm (Waving)
    rightArm = new THREE.Group();
    const rUpper = new THREE.Mesh(armGeo, whiteMat); rUpper.position.y = 0.5; rightArm.add(rUpper);
    const rJoint = new THREE.Mesh(jointGeo, darkMat); rightArm.add(rJoint);
    const rFore = new THREE.Mesh(armGeo, whiteMat); rFore.position.y = -0.5; rightArm.add(rFore);
    rightArm.position.set(1.3, 1.4, 0); rightArm.rotation.z = -0.6; robotGroup.add(rightArm);

    // LEGS
    const legGeo = new THREE.CylinderGeometry(0.25, 0.25, 1.2, 16);
    const footGeo = new THREE.BoxGeometry(0.5, 0.3, 0.8);
    const leftLeg = new THREE.Mesh(legGeo, whiteMat); leftLeg.position.set(-0.5, -0.4, 0); robotGroup.add(leftLeg);
    const leftFoot = new THREE.Mesh(footGeo, whiteMat); leftFoot.position.set(-0.5, -1.1, 0.1); robotGroup.add(leftFoot);
    const rightLeg = new THREE.Mesh(legGeo, whiteMat); rightLeg.position.set(0.5, -0.4, 0); robotGroup.add(rightLeg);
    const rightFoot = new THREE.Mesh(footGeo, whiteMat); rightFoot.position.set(0.5, -1.1, 0.1); robotGroup.add(rightFoot);

    scene.add(robotGroup);
    animate3D();
}

function animate3D() {
    requestAnimationFrame(animate3D);
    if (!robotGroup) return;
    const time = clock.getElapsedTime();
    robotGroup.position.y = Math.sin(time * 2) * 0.1;
    head.rotation.y = Math.sin(time * 0.5) * 0.1;
    
    const blink = Math.sin(time * 3) > 0.95 ? 0.1 : 1;
    leftEye.scale.y = blink; rightEye.scale.y = blink;
    
    if (Math.sin(time * 0.5) > 0.8) {
        rightArm.rotation.z = -1.5 + Math.sin(time * 10) * 0.3;
    } else {
        rightArm.rotation.z = -0.6;
    }
    
    renderer.render(scene, camera);
}

// --- FILE / IMAGE UPLOAD ---
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
    reader.onload = (e) => handleSend("I have uploaded an image of a problem. Please read it carefully and solve it step-by-step.", e.target.result);
    reader.readAsDataURL(file);
});

// --- AI BRAIN ---
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
        addMessageToUI(customPrompt, 'user');
    }

    const think = document.createElement('div');
    think.className = 'message ai-message'; think.textContent = 'Analyzing...'; think.id = 'think';
    chatContainer.appendChild(think); chatContainer.scrollTop = chatContainer.scrollHeight;

    let systemPrompt = `You are ${profile.tutor}, an expert AI tutor for a Grade ${profile.grade} student in the ${profile.curriculum}. Tone: ${profile.tutor === 'Nova' ? 'friendly' : profile.tutor === 'Atlas' ? 'strict' : 'funny'}.`;
    if (profile.memory) systemPrompt += ` \nCRITICAL STUDENT MEMORY: ${profile.memory}. Adapt your teaching to this.`;
    
    // Instruct AI to use Markdown clearly
    systemPrompt += ` \nFormat your response beautifully using Markdown (use ** for bold, ## for headers, and bullet points).`;

    if (currentMode === 'quiz') { systemPrompt += ` \nGenerate a 3-question quiz.`; currentMode = 'chat'; }
    if (currentMode === 'feynman') { systemPrompt += ` \nAct confused. Let the student explain to you.`; currentMode = 'chat'; }

    let messages = [{ role: 'system', content: systemPrompt }];
    chatHistory.forEach(m => messages.push({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }));

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

    const modelToUse = imageBase64 ? 'llama-3.2-11b-vision-instruct' : 'openai/gpt-oss-120b';

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
        
        // Render Markdown in UI, but send clean text to TTS
        addMessageToUI(aiResponse, 'ai', true);
        chatHistory.push({ text: aiResponse, sender: 'ai' });
        localStorage.setItem('tutorHistory', JSON.stringify(chatHistory));

        if (aiResponse.toLowerCase().includes("correct") || aiResponse.toLowerCase().includes("great job")) addXP(15);

        playGroqTTS(aiResponse);

    } catch (e) {
        document.getElementById('think').remove();
        addMessageToUI("Network error.", 'ai');
        animateMouth(false);
    }
    isProcessing = false;
}

function addMessageToUI(text, sender, isMarkdown = false) {
    const div = document.createElement('div');
    div.className = `message ${sender === 'user' ? 'user-message' : 'ai-message'}`;
    if (isMarkdown && sender === 'ai') {
        div.innerHTML = parseMarkdown(text);
    } else {
        div.textContent = text;
    }
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// --- EVENTS ---
sendBtn.addEventListener('click', () => handleSend());
userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSend(); });
document.getElementById('quiz-btn').addEventListener('click', () => { currentMode = 'quiz'; handleSend("Quiz me."); });
document.getElementById('feynman-btn').addEventListener('click', () => { currentMode = 'feynman'; handleSend("Let me teach you."); });
document.getElementById('clear-chat').addEventListener('click', () => { 
    if(confirm("Clear chat?")) { 
        chatHistory = []; localStorage.removeItem('tutorHistory'); chatContainer.innerHTML = ''; 
        ttsAudio.pause(); isSpeaking = false; if(mouth) animateMouth(false);
    } 
});
function resetApp() { if (confirm("Erase all data?")) { localStorage.clear(); location.reload(); } }

checkAppState();
