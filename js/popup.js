const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const attachFileButton = document.getElementById('attach-file-button');
const fileInput = document.getElementById('file-input');
const newChatButton = document.getElementById('new-chat');
const chatsList = document.getElementById('chats');

let activeChat = null;
let chats = {};

function renderChats() {
  chatsList.innerHTML = '';
  for (const chatId in chats) {
    const chat = chats[chatId];
    const chatElement = document.createElement('li');
    chatElement.textContent = chat.name;
    chatElement.dataset.chatId = chatId;
    if (chatId === activeChat) {
      chatElement.classList.add('active');
    }
    chatElement.addEventListener('click', () => {
      activeChat = chatId;
      renderMessages();
      renderChats();
    });

    const renameButton = document.createElement('button');
    renameButton.innerHTML = '<i class="fas fa-edit"></i>';
    renameButton.addEventListener('click', (e) => {
      e.stopPropagation();
      const newName = prompt("Digite o novo nome para o chat:", chat.name);
      if (newName !== null && newName.trim() !== "") {
        chats[chatId].name = newName.trim();
        saveChats();
        renderChats();
      }
    });

    const deleteButton = document.createElement('button');
    deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
    deleteButton.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Tem certeza de que deseja excluir o chat "${chat.name}"?`)) {
        delete chats[chatId];
        if (activeChat === chatId) {
          activeChat = null;
          if (Object.keys(chats).length > 0) {
            activeChat = Object.keys(chats)[0];
          }
          renderMessages();
        }
        saveChats();
        renderChats();
      }
    });

    chatElement.appendChild(renameButton);
    chatElement.appendChild(deleteButton);
    chatsList.appendChild(chatElement);
  }
}

function renderMessages() {
  chatMessages.innerHTML = '';
  if (activeChat && chats[activeChat]) {
    chats[activeChat].messages.forEach(message => {
      addMessage(message.content, message.sender, false);
    });
  }
}

const newChatModal = document.getElementById('new-chat-modal');
const newChatModelSelect = document.getElementById('new-chat-model-select');
const createChatButton = document.getElementById('create-chat-button');
const cancelChatButton = document.getElementById('cancel-chat-button');

newChatButton.addEventListener('click', () => {
  newChatModal.style.display = 'block';
});

cancelChatButton.addEventListener('click', () => {
  newChatModal.style.display = 'none';
});

createChatButton.addEventListener('click', () => {
  const chatId = `chat-${Date.now()}`;
  const chatName = `Chat ${Object.keys(chats).length + 1}`;
  const model = newChatModelSelect.value;
  chats[chatId] = { name: chatName, model: model, messages: [] };
  activeChat = chatId;
  saveChats();
  renderChats();
  renderMessages();
  newChatModal.style.display = 'none';
});

function saveChats() {
  chrome.storage.local.set({ chats });
}

function loadChats() {
  chrome.storage.local.get('chats', (result) => {
    if (result.chats && Object.keys(result.chats).length > 0) {
      chats = result.chats;
      activeChat = Object.keys(chats)[0];
    } else {
      // Se não houver chats, crie um
      const chatId = `chat-${Date.now()}`;
      const chatName = "Chat 1";
      chats[chatId] = { name: chatName, model: "llama-3.1-8b-instant", messages: [] };
      activeChat = chatId;
      saveChats();
    }
    renderChats();
    renderMessages();
  });
}

function applyTheme() {
  chrome.storage.sync.get('darkMode', (result) => {
    if (result.darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  });
}

loadChats();
applyTheme();

function addMessage(message, sender, save = true) {
  if (activeChat && save) {
    chats[activeChat].messages.push({ content: message, sender });
    saveChats();
  }

  const messageElement = document.createElement('div');
  messageElement.classList.add('message', `${sender}-message`);
  if (sender === 'ai' && message.startsWith("Ocorreu um erro")) {
    messageElement.classList.add('error-message');
  }

  if (typeof message === 'object') {
    const img = document.createElement('img');
    img.src = message.image_url.url;
    img.style.maxWidth = '100%';
    messageElement.appendChild(img);
  } else {
    const codeBlockRegex = /```(\w+)?\n([\s\S]+?)```/g;
    if (codeBlockRegex.test(message)) {
        let lastIndex = 0;
        let match;

        while ((match = codeBlockRegex.exec(message)) !== null) {
            // Adiciona o texto antes do bloco de código
            if (match.index > lastIndex) {
                messageElement.appendChild(document.createTextNode(message.substring(lastIndex, match.index)));
            }

            // Adiciona o bloco de código
            const codeContainer = document.createElement('div');
            codeContainer.className = 'code-container';

            const pre = document.createElement('pre');
            const code = document.createElement('code');
            const language = match[1] || 'plaintext';
            code.className = `language-${language}`;
            code.textContent = match[2];
            pre.appendChild(code);

            const codeToolbar = document.createElement('div');
            codeToolbar.className = 'code-toolbar';

            const copyButton = document.createElement('button');
            copyButton.innerHTML = '<i class="fas fa-copy"></i> Copiar';
            copyButton.addEventListener('click', () => {
                navigator.clipboard.writeText(match[2]);
            });
            codeToolbar.appendChild(copyButton);

            const executeButton = document.createElement('button');
            executeButton.innerHTML = '<i class="fas fa-play"></i> Executar';
            executeButton.addEventListener('click', () => {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    chrome.scripting.executeScript({
                        target: { tabId: tabs[0].id },
                        func: (codeToExecute) => {
                            try {
                                eval(codeToExecute);
                            } catch (e) {
                                console.error("Erro ao executar o código:", e);
                            }
                        },
                        args: [match[2]]
                    });
                });
            });
            codeToolbar.appendChild(executeButton);

            codeContainer.appendChild(pre);
            codeContainer.appendChild(codeToolbar);
            messageElement.appendChild(codeContainer);

            lastIndex = codeBlockRegex.lastIndex;
        }

        // Adiciona o texto restante após o último bloco de código
        if (lastIndex < message.length) {
            messageElement.appendChild(document.createTextNode(message.substring(lastIndex)));
        }
    } else {
        messageElement.textContent = message;
    }
  }

  if (sender !== 'ai' || !message.startsWith("Ocorreu um erro")) {
    if (typeof message !== 'object' && !/```/g.test(message)) {
      const copyButton = document.createElement('button');
      copyButton.innerHTML = '<i class="fas fa-copy"></i>';
      copyButton.addEventListener('click', () => {
        navigator.clipboard.writeText(message);
      });
      messageElement.appendChild(copyButton);
    }

    if (sender === 'ai') {
      const ttsButton = document.createElement('button');
      ttsButton.innerHTML = '<i class="fas fa-volume-up"></i>';
      ttsButton.addEventListener('click', () => {
        speak(message);
      });
      messageElement.appendChild(ttsButton);
    }
  }

  const shouldScroll = chatMessages.scrollTop + chatMessages.clientHeight >= chatMessages.scrollHeight - 20;

  chatMessages.appendChild(messageElement);

  if (shouldScroll) {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  hljs.highlightAll();
}

sendButton.addEventListener('click', () => {
  const message = messageInput.value.trim();
  if (message) {
    addMessage(message, 'user');
    messageInput.value = '';
    getGroqCompletion(message);
  }
});

messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendButton.click();
  }
});

attachFileButton.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const imageUrl = event.target.result;
      const message = {
        type: 'image_url',
        image_url: {
          url: imageUrl,
        },
      };
      addMessage(message, 'user');
      getGroqCompletion(message);
    };
    reader.readAsDataURL(file);
  }
});

let apiKey = null;

chrome.storage.sync.get('apiKey', (result) => {
  if (result.apiKey) {
    apiKey = result.apiKey;
  }
});

function showTypingIndicator() {
  const typingIndicator = document.createElement('div');
  typingIndicator.classList.add('message', 'ai-message', 'typing-indicator');
  typingIndicator.textContent = 'Digitando...';
  chatMessages.appendChild(typingIndicator);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTypingIndicator() {
  const typingIndicator = document.querySelector('.typing-indicator');
  if (typingIndicator) {
    typingIndicator.remove();
  }
}

function getGroqCompletion(userMessage) {
  if (!navigator.onLine) {
    addMessage("Você parece estar offline. Por favor, verifique sua conexão com a internet.", "ai");
    return;
  }

  if (!apiKey) {
    addMessage('Chave de API não configurada. Por favor, configure na página de opções.', 'ai');
    return;
  }

  const model = chats[activeChat].model;
  showTypingIndicator();

  (async () => {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          messages: chats[activeChat].messages.map(m => {
            if (typeof m.content === 'string') {
              return {role: m.sender === 'user' ? 'user' : 'assistant', content: m.content};
            } else {
              return {role: m.sender === 'user' ? 'user' : 'assistant', content: [m.content]};
            }
          }),
          model: model
        })
      });

      hideTypingIndicator();

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        let errorMessage = `Erro na API: ${response.status} ${response.statusText}`;
        if (errorData && errorData.error && errorData.error.message) {
          errorMessage += `\nDetalhes: ${errorData.error.message}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const aiMessage = data.choices[0].message.content;
      addMessage(aiMessage, 'ai');
    } catch (error) {
      hideTypingIndicator();
      console.error("Erro ao chamar a API Groq:", error);
      let errorMessage = "Ocorreu um erro ao se comunicar com a IA.";
      if (error.message) {
        errorMessage += `\nDetalhes: ${error.message}`;
      }
      addMessage(errorMessage, "ai");
    }
  })();
}

const TTS_MODEL = "playai-tts";

async function speak(text) {
  if (!apiKey) {
    addMessage('Chave de API não configurada. Por favor, configure na página de opções.', 'ai');
    return;
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: TTS_MODEL,
        voice: "Aaliyah-PlayAI",
        input: text,
        response_format: "wav"
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      let errorMessage = `Erro na API de TTS: ${response.status} ${response.statusText}`;
      if (errorData && errorData.error && errorData.error.message) {
        errorMessage += `\nDetalhes: ${errorData.error.message}`;
      }
      throw new Error(errorMessage);
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audio.onerror = () => {
      console.error("Erro ao carregar o áudio.");
      addMessage("Ocorreu um erro ao carregar o áudio.", "ai");
    };
    audio.play().catch(e => {
      if (e.name === 'NotSupportedError') {
        console.error("Formato de áudio não suportado.");
        addMessage("Ocorreu um erro ao reproduzir o áudio: formato não suportado.", "ai");
      } else {
        console.error("Erro ao reproduzir o áudio:", e);
        addMessage("Ocorreu um erro ao reproduzir o áudio.", "ai");
      }
    });
  } catch (error) {
    console.error("Erro ao chamar a API de TTS da Groq:", error);
    addMessage(`Ocorreu um erro ao gerar o áudio. Detalhes: ${error.message}`, "ai");
  }
}

console.log("popup.js carregado");
