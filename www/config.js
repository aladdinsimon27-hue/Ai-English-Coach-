window.APP_CONFIG = {
    primaryApiUrl: 'https://gemini-web2api-for-edu.onrender.com/v1/chat/completions',
    backupApiUrl: 'https://api.groq.com/openai/v1/chat/completions',
    primaryModel: 'gemini-3.6-flash',
    backupModel: 'llama-3.1-8b-instant',
    groqApiKey: localStorage.getItem('groq_api_key') || ''
};
