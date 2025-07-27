const apiKeyInput = document.getElementById('api-key');
const modelSelect = document.getElementById('model-select');
const saveButton = document.getElementById('save-button');

// Carrega as configurações salvas quando a página é aberta
chrome.storage.sync.get(['apiKey', 'model'], (result) => {
  if (result.apiKey) {
    apiKeyInput.value = result.apiKey;
  }
  if (result.model) {
    modelSelect.value = result.model;
  }
});

// Salva as configurações quando o botão de salvar é clicado
saveButton.addEventListener('click', () => {
  const apiKey = apiKeyInput.value;
  const model = modelSelect.value;
  chrome.storage.sync.set({ apiKey, model }, () => {
    alert('Configurações salvas com sucesso!');
  });
});
