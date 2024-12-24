class ChatApp {
    constructor() {
        this.socket = io('http://localhost:3000');
        this.currentUser = null;
        this.activeChat = null;
        this.chats = new Map();
        this.initializeElements();
        this.initializeSampleData();
        this.attachEventListeners();
        this.setupSocketListeners();
    }

    initializeElements() {
        // Main containers
        this.chatArea = document.querySelector('.chat-area');
        this.messagesContainer = document.querySelector('.messages-container');
        this.chatItems = document.querySelector('.chat-items');
        this.chatInfo = document.querySelector('.chat-info');
        
        // Input elements
        this.messageInput = document.querySelector('.message-input input');
        this.searchInput = document.querySelector('.search-bar input');
        
        // Buttons
        this.sendButton = document.querySelector('.send-btn');
        this.attachmentButton = document.querySelector('.attachment-btn');
        this.translateButton = document.querySelector('button[title="Translate"]');
        this.backButton = document.querySelector('.back-btn');
        
        // Navigation
        this.navItems = document.querySelectorAll('.sidebar-nav .nav-item');
        
        // Chat elements
        this.chatList = document.querySelector('.chat-list');
        this.groupItems = document.querySelector('.group-items');
        
        // User elements
        this.userAvatar = document.getElementById('userAvatar');
        this.userName = document.getElementById('userName');
        this.userStatus = document.getElementById('userStatus');
        this.userLanguage = document.getElementById('userLanguage');
        
        // Add back button initialization
        this.backButton = document.createElement('button');
        this.backButton.className = 'back-button';
        this.backButton.innerHTML = '<i class="fas fa-arrow-left"></i>';
        
        // Insert back button into chat header
        const chatHeader = document.querySelector('.chat-header');
        chatHeader.insertBefore(this.backButton, chatHeader.firstChild);
    }

    attachEventListeners() {
        // Message sending
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Search functionality
        this.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));

        // Navigation
        this.navItems.forEach(item => {
            item.addEventListener('click', (e) => this.handleNavigation(e));
        });

        // Mobile back button
        if (this.backButton) {
            this.backButton.addEventListener('click', () => {
                this.handleBackNavigation();
            });
        }

        // Translation toggle
        if (this.translateButton) {
            this.translateButton.addEventListener('click', () => this.toggleTranslation());
        }
    }

    handleNavigation(e) {
        const type = e.currentTarget.querySelector('span').textContent.toLowerCase();
        
        // Update active state
        this.navItems.forEach(item => item.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        // Toggle visibility
        if (type === 'chats') {
            this.chatItems.style.display = 'block';
            this.groupItems.style.display = 'none';
        } else if (type === 'groups') {
            this.chatItems.style.display = 'none';
            this.groupItems.style.display = 'block';
        }
    }

    setupSocketListeners() {
        this.socket.on('connect', () => {
            console.log('Connected to server');
        });

        this.socket.on('message', (message) => {
            this.receiveMessage(message);
        });

        this.socket.on('userTyping', (data) => {
            this.handleUserTyping(data);
        });
    }

    async sendMessage() {
        const content = this.messageInput.value.trim();
        console.log('Sending message:', content); // Debug log
        
        if (!content) {
            console.log('Empty message, not sending'); // Debug log
            return;
        }

        const message = {
            id: Date.now(),
            content: content,
            sender: 'currentUser',
            chatId: this.activeChat || 'default',
            timestamp: new Date(),
            translated: false
        };

        console.log('Created message object:', message); // Debug log

        try {
            // Add to UI first for immediate feedback
            this.addMessageToUI(message, true);
            
            // Clear input
            this.messageInput.value = '';
            
            // Emit to socket if connected
            if (this.socket && this.socket.connected) {
                this.socket.emit('message', message);
                console.log('Message emitted to socket'); // Debug log
            } else {
                console.log('Socket not connected, message only added to UI'); // Debug log
            }
        } catch (error) {
            console.error('Error in sendMessage:', error);
        }
    }

    receiveMessage(message) {
        if (message.chatId === this.activeChat) {
            this.addMessageToUI(message, false);
        }
        this.updateChatPreview(message);
    }

    addMessageToUI(message, isOwn) {
        // Check if we need to add a date separator
        const messageDate = new Date(message.timestamp);
        const lastMessage = this.messagesContainer.lastElementChild;
        
        if (this.shouldAddDateSeparator(messageDate, lastMessage)) {
            const dateSeparator = document.createElement('div');
            dateSeparator.className = 'date-separator';
            dateSeparator.textContent = this.formatMessageDate(messageDate);
            this.messagesContainer.appendChild(dateSeparator);
        }

        const messageElement = document.createElement('div');
        messageElement.className = `message ${isOwn ? 'own' : ''}`;
        
        messageElement.innerHTML = `
            <div class="message-content">
                ${!isOwn && message.sender !== 'currentUser' ? `<span class="message-sender">${message.sender}</span>` : ''}
                <p>
                    ${message.content}
                    <sub class="timestamp">${this.formatTime(message.timestamp)}</sub>
                    ${message.translated ? '<span class="translated-badge">Translated</span>' : ''}
                </p>
            </div>
        `;

        this.messagesContainer.appendChild(messageElement);
        this.scrollToBottom();
    }

    shouldAddDateSeparator(newMessageDate, lastMessageElement) {
        if (!lastMessageElement) return true;
        
        // If the last element is a date separator, don't add another one
        if (lastMessageElement.classList.contains('date-separator')) return false;
        
        // Get the timestamp from the last message
        const lastTimestamp = lastMessageElement.querySelector('.timestamp')?.textContent;
        if (!lastTimestamp) return true;
        
        const lastDate = new Date(lastMessageElement.dataset.timestamp || Date.now());
        
        // Compare the dates (ignoring time)
        return !this.isSameDay(newMessageDate, lastDate);
    }

    isSameDay(date1, date2) {
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    }

    formatMessageDate(date) {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (this.isSameDay(date, today)) {
            return 'Today';
        } else if (this.isSameDay(date, yesterday)) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
        }
    }

    updateChatPreview(message) {
        const preview = document.querySelector(`[data-chat-id="${message.chatId}"]`);
        if (preview) {
            const previewText = preview.querySelector('.preview-text');
            previewText.textContent = message.content;
        }
    }

    async createChatPreview(chat) {
        const chatElement = document.createElement('div');
        chatElement.className = 'chat-item';
        chatElement.setAttribute('data-chat-id', chat.id);
        
        chatElement.innerHTML = `
            <div class="chat-item-avatar">
                <img src="${chat.avatar || 'images/default-avatar.png'}" alt="${chat.name}">
                <span class="status-indicator ${chat.online ? 'online' : ''}"></span>
            </div>
            <div class="chat-item-info">
                <h4>${chat.name}</h4>
                <p class="preview-text">${chat.lastMessage || ''}</p>
            </div>
            <div class="chat-item-meta">
                <span class="timestamp">${chat.lastMessageTime || ''}</span>
                ${chat.unreadCount ? `<span class="unread-count">${chat.unreadCount}</span>` : ''}
            </div>
        `;

        chatElement.addEventListener('click', () => this.openChat(chat.id));
        this.chatItems.appendChild(chatElement);
    }

    openChat(chatId) {
        console.log('Opening chat with ID:', chatId);
        
        this.activeChat = chatId;
        this.chatArea.classList.add('active');
        
        // Get chat details
        const isGroup = chatId.startsWith('group');
        const chat = isGroup 
            ? this.sampleGroups.find(group => group.id === chatId)
            : this.sampleUsers.find(user => user.id === chatId);

        console.log('Found chat details:', chat);

        if (chat) {
            // Update chat header with user/group info
            this.updateChatHeader(chat, isGroup);
            
            // Add active class to selected chat
            document.querySelectorAll('.chat-item').forEach(item => {
                item.classList.remove('active');
                if (item.getAttribute('data-chat-id') === chatId || 
                    item.getAttribute('data-group-id') === chatId) {
                    item.classList.add('active');
                }
            });
        } else {
            console.error('Chat not found for ID:', chatId);
        }
    }

    updateChatHeader(chat, isGroup) {
        console.log('Updating chat header with:', chat);
        
        const headerInfo = document.querySelector('.chat-info');
        if (!headerInfo) {
            console.error('Chat info element not found');
            return;
        }

        headerInfo.innerHTML = `
            <div class="chat-participant-info">
                <div class="participant-avatar">
                    <img src="${chat.avatar}" alt="${chat.name}">
                    <span class="status-indicator ${chat.online ? 'online' : ''}"></span>
                </div>
                <div>
                    <h2 id="chatName">${chat.name}</h2>
                    <p id="chatStatus">
                        ${isGroup 
                            ? `<span id="participantCount">${chat.memberCount} members</span>`
                            : `<span id="participantCount">Translated from ${chat.language || 'English'} •</span><br>
                               <span id="originalMessage">Tap to see original message</span> •
                               <span id="activeStatus">${chat.online ? 'Online' : 'Offline'}</span>`
                        }
                    </p>
                </div>
            </div>
        `;
    }

    handleSearch(query) {
        const chatItems = document.querySelectorAll('.chat-item');
        query = query.toLowerCase();

        chatItems.forEach(item => {
            const name = item.querySelector('h4').textContent.toLowerCase();
            const preview = item.querySelector('.preview-text').textContent.toLowerCase();
            
            if (name.includes(query) || preview.includes(query)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    async toggleTranslation() {
        const messages = document.querySelectorAll('.message-content p');
        this.translateButton.classList.toggle('active');
        
        // In a real app, implement translation logic here
        // For example, using Google Translate API
    }

    scrollToBottom() {
        if (this.messagesContainer) {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }
    }

    formatTime(timestamp) {
        return new Date(timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    // Mock method - replace with actual API call
    async fetchChatHistory(chatId) {
        return [];
    }

    initializeSampleData() {
        // Sample users for chat list
        const sampleUsers = [
            {
                id: 'user1',
                name: 'Emma Watson',
                avatar: 'https://randomuser.me/api/portraits/women/1.jpg',
                lastMessage: 'Hey, have you seen the new translation feature?',
                lastMessageTime: '12:45 PM',
                online: true,
                unreadCount: 3
            },
            {
                id: 'user2',
                name: 'James Chen',
                avatar: 'https://randomuser.me/api/portraits/men/2.jpg',
                lastMessage: '你好！最近怎么样？',
                lastMessageTime: '11:30 AM',
                online: true,
                unreadCount: 1
            },
            {
                id: 'user3',
                name: 'Sofia Garcia',
                avatar: 'https://randomuser.me/api/portraits/women/3.jpg',
                lastMessage: '¡Hola! ¿Cómo estás?',
                lastMessageTime: '10:15 AM',
                online: false,
                unreadCount: 0
            },
            {
                id: 'user4',
                name: 'Pierre Dubois',
                avatar: 'https://randomuser.me/api/portraits/men/4.jpg',
                lastMessage: 'Bonjour! Comment ça va?',
                lastMessageTime: 'Yesterday',
                online: true,
                unreadCount: 0
            },
            {
                id: 'user5',
                name: 'Anna Kowalski',
                avatar: 'https://randomuser.me/api/portraits/women/5.jpg',
                lastMessage: 'Thanks for the help!',
                lastMessageTime: 'Yesterday',
                online: false,
                unreadCount: 0
            },
            {
                id: 'user6',
                name: 'Mohammed Ahmed',
                avatar: 'https://randomuser.me/api/portraits/men/6.jpg',
                lastMessage: 'مرحبا! كيف حالك؟',
                lastMessageTime: 'Yesterday',
                online: true,
                unreadCount: 2
            },
            {
                id: 'user7',
                name: 'Yuki Tanaka',
                avatar: 'https://randomuser.me/api/portraits/women/7.jpg',
                lastMessage: 'こんにちは！',
                lastMessageTime: 'Monday',
                online: false,
                unreadCount: 0
            },
            {
                id: 'user8',
                name: 'Alex Johnson',
                avatar: 'https://randomuser.me/api/portraits/men/8.jpg',
                lastMessage: 'See you at the meeting!',
                lastMessageTime: 'Monday',
                online: true,
                unreadCount: 0
            },
            {
                id: 'user9',
                name: 'Maria Silva',
                avatar: 'https://randomuser.me/api/portraits/women/9.jpg',
                lastMessage: 'Olá! Tudo bem?',
                lastMessageTime: 'Sunday',
                online: false,
                unreadCount: 0
            },
            {
                id: 'user10',
                name: 'Hans Mueller',
                avatar: 'https://randomuser.me/api/portraits/men/10.jpg',
                lastMessage: 'Guten Tag!',
                lastMessageTime: 'Sunday',
                online: true,
                unreadCount: 0
            }
        ];

        // Sample groups
        const sampleGroups = [
            {
                id: 'group1',
                name: 'Global Translation Team',
                avatar: 'images/1.png',
                lastMessage: 'Meeting in 30 minutes!',
                lastMessageTime: '1:30 PM',
                memberCount: 15,
                unreadCount: 5
            },
            {
                id: 'group2',
                name: 'Language Exchange',
                avatar: 'images/2.png',
                lastMessage: 'Who wants to practice Spanish?',
                lastMessageTime: '11:20 AM',
                memberCount: 28,
                unreadCount: 2
            },
            {
                id: 'group3',
                name: 'Project Alpha',
                avatar: 'images/1.png',
                lastMessage: 'Updated the deadline to next Friday',
                lastMessageTime: 'Yesterday',
                memberCount: 8,
                unreadCount: 0
            },
            {
                id: 'group4',
                name: 'Coffee & Code',
                avatar: 'images/2.png',
                lastMessage: 'Virtual meetup this weekend!',
                lastMessageTime: 'Monday',
                memberCount: 45,
                unreadCount: 12
            },
            {
                id: 'group5',
                name: 'Travel Enthusiasts',
                avatar: 'images/1.png',
                lastMessage: 'Sharing photos from Tokyo!',
                lastMessageTime: 'Sunday',
                memberCount: 112,
                unreadCount: 3
            }
        ];

        // Add method to render chats and groups
        this.renderChats(sampleUsers);
        this.renderGroups(sampleGroups);
    }

    renderChats(users) {
        const chatItems = document.querySelector('.chat-items');
        chatItems.innerHTML = ''; // Clear existing items
        
        users.forEach(user => {
            const chatItem = document.createElement('div');
            chatItem.className = 'chat-item';
            chatItem.setAttribute('data-chat-id', user.id);
            
            chatItem.innerHTML = `
                <div class="chat-item-avatar">
                    <img src="${user.avatar}" alt="${user.name}">
                    <span class="status-indicator ${user.online ? 'online' : ''}"></span>
                </div>
                <div class="chat-item-info">
                    <h4>${user.name}</h4>
                    <p class="preview-text">${user.lastMessage}</p>
                </div>
                <div class="chat-item-meta">
                    <span class="timestamp">${user.lastMessageTime}</span>
                    ${user.unreadCount ? `<span class="unread-count">${user.unreadCount}</span>` : ''}
                </div>
            `;
            
            chatItem.addEventListener('click', () => this.openChat(user.id));
            chatItems.appendChild(chatItem);
        });
    }

    renderGroups(groups) {
        const groupItems = document.createElement('div');
        groupItems.className = 'group-items';
        groupItems.style.display = 'none'; // Initially hidden
        
        groups.forEach(group => {
            const groupItem = document.createElement('div');
            groupItem.className = 'chat-item';
            groupItem.setAttribute('data-group-id', group.id);
            
            groupItem.innerHTML = `
                <div class="chat-item-avatar">
                    <img src="${group.avatar}" alt="${group.name}">
                </div>
                <div class="chat-item-info">
                    <h4>${group.name}</h4>
                    <p class="preview-text">
                        <span class="member-count">${group.memberCount} members</span> · 
                        ${group.lastMessage}
                    </p>
                </div>
                <div class="chat-item-meta">
                    <span class="timestamp">${group.lastMessageTime}</span>
                    ${group.unreadCount ? `<span class="unread-count">${group.unreadCount}</span>` : ''}
                </div>
            `;
            
            groupItem.addEventListener('click', () => this.openChat(group.id));
            groupItems.appendChild(groupItem);
        });
        
        document.querySelector('.chat-list').appendChild(groupItems);
        
        // Add navigation functionality
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(navItem => {
            navItem.addEventListener('click', (e) => {
                const type = e.currentTarget.querySelector('span').textContent.toLowerCase();
                document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => item.classList.remove('active'));
                e.currentTarget.classList.add('active');
                
                const chatItems = document.querySelector('.chat-items');
                const groupItems = document.querySelector('.group-items');
                
                if (type === 'chats') {
                    chatItems.style.display = 'block';
                    groupItems.style.display = 'none';
                } else if (type === 'groups') {
                    chatItems.style.display = 'none';
                    groupItems.style.display = 'block';
                }
            });
        });
    }

    handleBackNavigation() {
        // Clear active chat
        this.activeChat = null;
        
        // Clear messages container
        this.messagesContainer.innerHTML = '';
        
        // Hide chat area on mobile
        this.chatArea.classList.remove('active');
        
        // Remove active state from chat items
        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
        });
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new ChatApp();
});
