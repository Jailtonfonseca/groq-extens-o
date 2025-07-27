const apiKeyInput = document.getElementById('api-key');
const darkModeToggle = document.getElementById('dark-mode');
const saveButton = document.getElementById('save-button');

// Carrega as configurações salvas quando a página é aberta
chrome.storage.sync.get(['apiKey', 'darkMode'], (result) => {
  if (result.apiKey) {
    apiKeyInput.value = result.apiKey;
  }
  if (result.darkMode) {
    darkModeToggle.checked = result.darkMode;
  }
});

const testKeyButton = document.getElementById('test-key-button');
const testKeyResult = document.getElementById('test-key-result');

// Salva as configurações quando o botão de salvar é clicado
saveButton.addEventListener('click', () => {
  const apiKey = apiKeyInput.value;
  const darkMode = darkModeToggle.checked;
  chrome.storage.sync.set({ apiKey, darkMode }, () => {
    testKeyButton.click();
  });
});

testKeyButton.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value;
  if (!apiKey) {
    testKeyResult.textContent = 'Por favor, insira uma chave de API.';
    return;
  }

  testKeyResult.textContent = 'Testando...';

  try {
    const response = await fetch("https://api.groq.com/openai/v1/models", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    });

    if (response.ok) {
      testKeyResult.textContent = 'Chave de API válida!';
      testKeyResult.style.color = 'green';
    } else {
      testKeyResult.textContent = 'Chave de API inválida ou ocorreu um erro.';
      testKeyResult.style.color = 'red';
    }
  } catch (error) {
    testKeyResult.textContent = 'Erro ao testar a chave de API.';
    testKeyResult.style.color = 'red';
  }
});
