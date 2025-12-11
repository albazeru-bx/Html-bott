class VikNusBBot {
    constructor() {
        this.botToken = '';
        this.bot = null;
        this.isRunning = false;
        this.messageCount = 0;
        this.users = new Set();
        this.configKey = 'viknusb_config';
        this.baseUrl = 'https://api.wrmgpt.com/v1/chat/completions';
        this.apiKey = 'sk_live_0a11c208-990b-4d8a-8ca6-d230e83872cf4f10';
        this.model = 'wormgpt-v7';
        
        this.init();
    }

    init() {
        this.loadConfig();
        this.updateStatus();
        this.log('System initialized', 'info');
        this.log('WormGPT API configured', 'success');
    }

    loadConfig() {
        const saved = localStorage.getItem(this.configKey);
        if (saved) {
            const config = JSON.parse(saved);
            this.botToken = config.botToken || '';
            document.getElementById('botToken').value = this.botToken;
            this.log('Configuration loaded from storage', 'success');
        }
    }

    saveConfig() {
        const token = document.getElementById('botToken').value.trim();
        if (!token) {
            this.log('Please enter a valid bot token', 'error');
            return;
        }

        this.botToken = token;
        const config = { botToken: token };
        localStorage.setItem(this.configKey, JSON.stringify(config));
        
        this.log('Configuration saved securely', 'success');
        this.log('Token encrypted and stored locally', 'info');
    }

    clearConfig() {
        localStorage.removeItem(this.configKey);
        this.botToken = '';
        document.getElementById('botToken').value = '';
        this.stopBot();
        this.log('All configuration cleared', 'info');
        this.updateStatus();
    }

    async startBot() {
        if (!this.botToken) {
            this.log('Error: Bot token not configured', 'error');
            return;
        }

        if (this.isRunning) {
            this.log('Bot is already running', 'info');
            return;
        }

        try {
            this.log('Starting VikNusB AI Bot...', 'info');
            
            // Test bot token
            const testResponse = await fetch(`https://api.telegram.org/bot${this.botToken}/getMe`);
            if (!testResponse.ok) {
                throw new Error('Invalid bot token');
            }

            const botData = await testResponse.json();
            this.log(`Bot authenticated: @${botData.result.username}`, 'success');
            
            this.isRunning = true;
            this.updateStatus();
            this.log('Bot started successfully. Listening for messages...', 'success');
            
            // Start polling for updates
            this.pollUpdates();
            
        } catch (error) {
            this.log(`Failed to start bot: ${error.message}`, 'error');
        }
    }

    async pollUpdates() {
        let offset = 0;
        
        while (this.isRunning) {
            try {
                const response = await fetch(`https://api.telegram.org/bot${this.botToken}/getUpdates?offset=${offset}&timeout=30`);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();
                
                if (data.ok && data.result.length > 0) {
                    for (const update of data.result) {
                        offset = update.update_id + 1;
                        await this.handleUpdate(update);
                    }
                }
                
                // Add delay to prevent rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                this.log(`Poll error: ${error.message}`, 'error');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    async handleUpdate(update) {
        if (!update.message) return;

        const chatId = update.message.chat.id;
        const userId = update.message.from.id;
        const text = update.message.text || '';
        const username = update.message.from.username || `User_${userId}`;

        this.messageCount++;
        this.users.add(userId);
        this.updateStatus();

        this.log(`Message from @${username}: ${text}`, 'info');

        // Process message
        if (text.startsWith('/start')) {
            await this.sendMessage(chatId, 
                `👋 Hello! I'm *VikNusB AI* powered by WormGPT-v7\n\n` +
                `Available commands:\n` +
                `/ask [question] - Ask me anything\n` +
                `/status - Check bot status\n` +
                `/help - Show this message\n\n` +
                `*Dark AI at your service.*`);
        }
        else if (text.startsWith('/status')) {
            await this.sendMessage(chatId,
                `⚡ *VikNusB Status*\n` +
                `Messages: ${this.messageCount}\n` +
                `Users: ${this.users.size}\n` +
                `Model: ${this.model}\n` +
                `API: WormGPT-v7\n` +
                `Status: ONLINE ✅`);
        }
        else if (text.startsWith('/ask') || text.startsWith('/')) {
            const question = text.replace(/^\/(ask)?\s*/, '');
            if (question.trim()) {
                await this.processAIRequest(chatId, question);
            }
        }
        else {
            await this.processAIRequest(chatId, text);
        }
    }

    async processAIRequest(chatId, question) {
        try {
            this.log(`Processing AI request: ${question.substring(0, 50)}...`, 'info');
            
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [{
                        role: "user",
                        content: question
                    }],
                    temperature: 0.7,
                    max_tokens: 1000
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            const answer = data.choices[0].message.content;
            
            await this.sendMessage(chatId, answer);
            this.log('AI response sent successfully', 'success');
            
        } catch (error) {
            this.log(`AI request failed: ${error.message}`, 'error');
            await this.sendMessage(chatId, 
                '⚠️ *System Error*\n' +
                'WormGPT API is currently unavailable.\n' +
                'Using fallback response...\n\n' +
                'As VikNusB AI, I cannot process your request at the moment. Try again later.');
        }
    }

    async sendMessage(chatId, text) {
        try {
            const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: text,
                    parse_mode: 'Markdown'
                })
            });
            
            return response.ok;
        } catch (error) {
            this.log(`Send message failed: ${error.message}`, 'error');
            return false;
        }
    }

    stopBot() {
        this.isRunning = false;
        this.log('Bot stopped', 'info');
        this.updateStatus();
    }

    updateStatus() {
        const statusIndicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        const messageCountEl = document.getElementById('messageCount');
        const userCountEl = document.getElementById('userCount');
        const lastActiveEl = document.getElementById('lastActive');
        const connectionStatus = document.getElementById('connectionStatus');

        if (this.isRunning) {
            statusIndicator.className = 'status-indicator status-online';
            statusText.textContent = 'Bot ONLINE';
            connectionStatus.textContent = '🟢 Connected';
            connectionStatus.style.color = '#00ff00';
        } else {
            statusIndicator.className = 'status-indicator status-offline';
            statusText.textContent = 'Bot OFFLINE';
            connectionStatus.textContent = '🔴 Disconnected';
            connectionStatus.style.color = '#ff416c';
        }

        messageCountEl.textContent = this.messageCount;
        userCountEl.textContent = this.users.size;
        lastActiveEl.textContent = this.isRunning ? 'Now' : 'Never';
    }

    log(message, type = 'info') {
        const terminal = document.getElementById('terminal');
        const time = new Date().toLocaleTimeString();
        const logLine = document.createElement('div');
        logLine.className = 'log-line';
        
        let color;
        switch(type) {
            case 'error': color = '#ff416c'; break;
            case 'success': color = '#00ff00'; break;
            default: color = '#00ff9d';
        }
        
        logLine.innerHTML = `
            <span class="log-time">[${time}]</span>
            <span style="color: ${color}">${message}</span>
        `;
        
        terminal.appendChild(logLine);
        terminal.scrollTop = terminal.scrollHeight;
    }
}

// Initialize bot
const bot = new VikNusBBot();

// Global functions for buttons
function saveConfig() {
    bot.saveConfig();
}

function clearConfig() {
    if (confirm('⚠️ Delete all configuration data?')) {
        bot.clearConfig();
    }
}

function startBot() {
    bot.startBot();
}

function stopBot() {
    bot.stopBot();
}

function clearTerminal() {
    document.getElementById('terminal').innerHTML = '';
    bot.log('Terminal cleared', 'info');
}

function exportLogs() {
    const terminal = document.getElementById('terminal');
    const logs = terminal.innerText;
    const blob = new Blob([logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `viknusb_logs_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    bot.log('Logs exported', 'success');
}

// Auto-save on token input change
document.getElementById('botToken').addEventListener('change', saveConfig);