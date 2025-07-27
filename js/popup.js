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

    const deleteButton = document.createElement('button');
    deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
    deleteButton.addEventListener('click', (e) => {
      e.stopPropagation();
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
    });

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

newChatButton.addEventListener('click', () => {
  const chatId = `chat-${Date.now()}`;
  const chatName = `Chat ${Object.keys(chats).length + 1}`;
  chats[chatId] = { name: chatName, messages: [] };
  activeChat = chatId;
  saveChats();
  renderChats();
  renderMessages();
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
      chats[chatId] = { name: chatName, messages: [] };
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
    messageElement.textContent = message;
  }

  const copyButton = document.createElement('button');
  copyButton.innerHTML = '<i class="fas fa-copy"></i>';
  copyButton.addEventListener('click', () => {
    navigator.clipboard.writeText(message);
  });
  messageElement.appendChild(copyButton);

  if (sender === 'ai') {
    const ttsButton = document.createElement('button');
    ttsButton.innerHTML = '<i class="fas fa-volume-up"></i>';
    ttsButton.addEventListener('click', () => {
      speak(message);
    });
    messageElement.appendChild(ttsButton);
  }

  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
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

function getGroqCompletion(userMessage) {
  chrome.storage.sync.get(['apiKey', 'model'], async (result) => {
    if (!result.apiKey) {
      addMessage('Chave de API não configurada. Por favor, configure na página de opções.', 'ai');
      return;
    }

    if (!result.model) {
      addMessage('Nenhum modelo selecionado. Por favor, selecione um modelo na página de opções.', 'ai');
      return;
    }

    const apiKey = result.apiKey;
    const model = result.model;

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
          model: model,
          stream: true,
        })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      const aiMessageElement = addMessage("", 'ai', false);
      let aiMessage = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          chats[activeChat].messages.push({ content: aiMessage, sender: 'ai' });
          saveChats();
          break;
        }
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        const parsedLines = lines
          .map((line) => line.replace(/^data: /, "").trim())
          .filter((line) => line !== "" && line !== "[DONE]")
          .map((line) => JSON.parse(line));

        for (const parsedLine of parsedLines) {
          const { choices } = parsedLine;
          const { delta } = choices[0];
          const { content } = delta;
          if (content) {
            aiMessage += content;
            aiMessageElement.textContent = aiMessage;
            chatMessages.scrollTop = chatMessages.scrollHeight;
          }
        }
      }
    } catch (error) {
      console.error("Erro ao chamar a API Groq:", error.message);
      let errorMessage = "Ocorreu um erro ao se comunicar com a IA.";
      if (error.response) {
        const errorData = await error.response.json();
        errorMessage += `\nDetalhes: ${errorData.error.message}`;
      }
      addMessage(errorMessage, "ai");
    }
  });
}

async function speak(text) {
  chrome.storage.sync.get(['apiKey'], async (result) => {
    if (!result.apiKey) {
      addMessage('Chave de API não configurada. Por favor, configure na página de opções.', 'ai');
      return;
    }

    const apiKey = result.apiKey;

    try {
      const response = await fetch("https://api.groq.com/openai/v1/audio/speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "playai-tts",
          voice: "Aaliyah-PlayAI",
          input: text,
          response_format: "wav"
        })
      });

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play();
    } catch (error) {
      console.error("Erro ao chamar a API de TTS da Groq:", error);
      addMessage("Ocorreu um erro ao gerar o áudio.", "ai");
    }
  });
}

console.log("popup.js carregado");
