document.querySelector('#run').addEventListener('click', () => {
  document.querySelector('#result').textContent = `Fixture received: ${document.querySelector('#value').value}`;
});
