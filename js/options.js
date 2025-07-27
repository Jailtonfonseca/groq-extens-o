const apiKeyInput = document.getElementById('api-key');
const modelSelect = document.getElementById('model-select');
const darkModeToggle = document.getElementById('dark-mode');
const saveButton = document.getElementById('save-button');

// Carrega as configurações salvas quando a página é aberta
chrome.storage.sync.get(['apiKey', 'model', 'darkMode'], (result) => {
  if (result.apiKey) {
    apiKeyInput.value = result.apiKey;
  }
  if (result.model) {
    modelSelect.value = result.model;
  }
  if (result.darkMode) {
    darkModeToggle.checked = result.darkMode;
  }
});

// Salva as configurações quando o botão de salvar é clicado
saveButton.addEventListener('click', () => {
  const apiKey = apiKeyInput.value;
  const model = modelSelect.value;
  const darkMode = darkModeToggle.checked;
  chrome.storage.sync.set({ apiKey, model, darkMode }, () => {
    alert('Configurações salvas com sucesso!');
  });
});
