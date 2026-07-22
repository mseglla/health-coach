import { importStateFile } from './storage.js';

const exportButton = document.getElementById('exportData');
if (exportButton) {
  const importButton = document.createElement('button');
  importButton.id = 'importData';
  importButton.type = 'button';
  importButton.className = 'button button--ghost';
  importButton.textContent = 'Restaurar còpia';

  const fileInput = document.createElement('input');
  fileInput.id = 'importDataFile';
  fileInput.type = 'file';
  fileInput.accept = 'application/json,.json';
  fileInput.hidden = true;

  exportButton.insertAdjacentElement('afterend', importButton);
  importButton.insertAdjacentElement('afterend', fileInput);

  importButton.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (!window.confirm('Aquesta acció substituirà les dades locals actuals. Vols continuar?')) {
      fileInput.value = '';
      return;
    }
    try {
      await importStateFile(file);
      window.alert('Còpia restaurada correctament. ATLES es tornarà a carregar.');
      window.location.reload();
    } catch (error) {
      window.alert(error?.message || 'No s’ha pogut restaurar la còpia.');
      fileInput.value = '';
    }
  });
}
