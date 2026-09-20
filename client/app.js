'use strict';

const form = document.querySelector('#validation-form');
const urlsInput = document.querySelector('#urls');
const urlsError = document.querySelector('#urls-error');
const submitButton = document.querySelector('#submit-button');
const status = document.querySelector('#status');
const requestError = document.querySelector('#request-error');
const resultsContent = document.querySelector('#results-content');
const downloadJsonButton = document.querySelector('#download-json');
const downloadHtmlButton = document.querySelector('#download-html');

let lastReport = null;

function clearResults() {
  resultsContent.replaceChildren();
  requestError.hidden = true;
  requestError.textContent = '';
  lastReport = null;
  downloadJsonButton.disabled = true;
  downloadHtmlButton.disabled = true;
}

function setFieldError(message) {
  urlsError.textContent = message;
  urlsError.hidden = !message;
  urlsInput.setAttribute('aria-invalid', message ? 'true' : 'false');
}

function normalizedUrls() {
  const lines = urlsInput.value.split(/\r?\n/);
  const urls = [];
  const invalidLines = [];

  lines.forEach((line, index) => {
    const value = line.trim();
    if (!value) return;
    try {
      const parsed = new URL(value);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
      urls.push(parsed.href);
    } catch {
      invalidLines.push(index + 1);
    }
  });

  if (urls.length === 0 && invalidLines.length === 0) {
    throw new Error('Introduce al menos una dirección web.');
  }
  if (invalidLines.length > 0) {
    throw new Error(`Revisa ${invalidLines.length === 1 ? 'la línea' : 'las líneas'} ${invalidLines.join(', ')}.`);
  }
  return urls;
}

function textElement(tagName, text, className) {
  const element = document.createElement(tagName);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

function occurrenceItem(occurrence, index) {
  const item = document.createElement('li');
  const location = [];
  item.className = 'occurrence';
  if (occurrence.page) location.push(`Página ${occurrence.page}`);
  if (occurrence.line) location.push(`línea ${occurrence.line}`);
  if (occurrence.column) location.push(`columna ${occurrence.column}`);
  item.append(textElement('p', location.join(', ') || `Aparición ${index + 1}`));
  if (occurrence.code) item.append(textElement('pre', occurrence.code));
  return item;
}

function problemItem(problem, index) {
  const item = document.createElement('li');
  const article = document.createElement('article');
  const occurrences = Array.isArray(problem.specificProblems) ? problem.specificProblems : [];
  item.className = 'problem';
  article.append(textElement('h4', problem.title || `Problema ${index + 1}`));
  if (problem.type) article.append(textElement('p', `Tipo: ${problem.type}`, 'problem-meta'));
  if (problem.description) article.append(textElement('p', problem.description));
  if (problem.help && problem.help !== problem.description) {
    article.append(textElement('p', `Ayuda: ${problem.help}`));
  }

  if (occurrences.length > 0) {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    const list = document.createElement('ol');
    summary.textContent = `${occurrences.length} ${occurrences.length === 1 ? 'aparición' : 'apariciones'}`;
    list.className = 'occurrence-list';
    occurrences.forEach((occurrence, occurrenceIndex) => {
      list.append(occurrenceItem(occurrence, occurrenceIndex));
    });
    details.append(summary, list);
    article.append(details);
  }

  item.append(article);
  return item;
}

function problemOccurrences(result) {
  return result.problems.reduce((total, problem) => {
    const occurrences = Array.isArray(problem.specificProblems) ? problem.specificProblems.length : 0;
    return total + occurrences;
  }, 0);
}

function summaryTable(report) {
  const region = document.createElement('div');
  const table = document.createElement('table');
  const caption = document.createElement('caption');
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  const body = document.createElement('tbody');

  region.className = 'summary-table-region';
  region.tabIndex = 0;
  region.setAttribute('role', 'region');
  region.setAttribute('aria-label', 'Resumen de páginas analizadas');
  caption.textContent = 'Resumen de páginas analizadas';

  ['Página', 'Dirección', 'Problemas', 'Apariciones', 'Estado'].forEach((label) => {
    const heading = document.createElement('th');
    heading.scope = 'col';
    heading.textContent = label;
    headRow.append(heading);
  });

  report.results.forEach((result, index) => {
    const row = document.createElement('tr');
    const pageHeading = document.createElement('th');
    const link = document.createElement('a');
    const urlCell = document.createElement('td');
    const problemsCell = document.createElement('td');
    const occurrencesCell = document.createElement('td');
    const stateCell = document.createElement('td');

    pageHeading.scope = 'row';
    link.href = `#resultado-pagina-${index + 1}`;
    link.textContent = `Página ${index + 1}`;
    link.className = 'result-link';
    pageHeading.append(link);
    urlCell.textContent = result.url;
    urlCell.className = 'summary-url';
    problemsCell.textContent = result.error ? '—' : String(result.problems.length);
    occurrencesCell.textContent = result.error ? '—' : String(problemOccurrences(result));
    stateCell.textContent = result.error ? 'Error' : 'Completada';
    row.append(pageHeading, urlCell, problemsCell, occurrencesCell, stateCell);
    body.append(row);
  });

  head.append(headRow);
  table.append(caption, head, body);
  region.append(table);
  return region;
}

function urlResultItem(result, index) {
  const item = document.createElement('li');
  const article = document.createElement('article');
  item.className = 'url-result';
  article.id = `resultado-pagina-${index + 1}`;
  article.tabIndex = -1;
  article.append(textElement('h3', `Página ${index + 1}`));
  article.append(textElement('p', result.url, 'validated-url'));

  if (result.error) {
    article.append(textElement('p', `No se ha podido validar: ${result.error}`, 'request-error'));
  } else if (result.problems.length === 0) {
    article.append(textElement('p', 'No se han detectado problemas.'));
  } else {
    article.append(textElement(
      'p',
      `${result.problems.length} ${result.problems.length === 1 ? 'tipo de problema encontrado' : 'tipos de problema encontrados'}.`
    ));
    const problems = document.createElement('ol');
    problems.className = 'problem-list';
    result.problems.forEach((problem, problemIndex) => problems.append(problemItem(problem, problemIndex)));
    article.append(problems);
  }

  item.append(article);
  return item;
}

function renderReport(report) {
  const failed = report.results.filter((result) => result.error).length;
  const withProblems = report.results.filter((result) => !result.error && result.problems.length > 0).length;
  status.textContent = 'Validación completada.';
  resultsContent.append(textElement(
    'p',
    `${report.results.length} ${report.results.length === 1 ? 'página procesada' : 'páginas procesadas'}; ` +
      `${withProblems} con problemas y ${failed} sin poder validar.`,
    'summary'
  ));
  resultsContent.append(summaryTable(report));
  const list = document.createElement('ol');
  list.className = 'url-result-list';
  report.results.forEach((result, index) => list.append(urlResultItem(result, index)));
  resultsContent.append(list);
}

async function validateUrl(url) {
  try {
    const response = await fetch('../api/validation-request/json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: url })
    });
    if (!response.ok) throw new Error(`La API ha respondido con el código HTTP ${response.status}.`);
    const data = await response.json();
    if (!data || !Array.isArray(data.problems)) {
      throw new Error('La respuesta de la API no tiene el formato esperado.');
    }
    return { url, problems: data.problems, error: null };
  } catch (error) {
    return { url, problems: [], error: error.message };
  }
}

function downloadFile(contents, type, filename) {
  const blobUrl = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}

function reportFilename(extension) {
  const timestamp = lastReport.generatedAt.replace(/[:.]/g, '-');
  return `resultados-oaw-${timestamp}.${extension}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function occurrenceHtml(occurrence, index) {
  const location = [];
  if (occurrence.page) location.push(`Página ${occurrence.page}`);
  if (occurrence.line) location.push(`línea ${occurrence.line}`);
  if (occurrence.column) location.push(`columna ${occurrence.column}`);
  const code = occurrence.code ? `<pre>${escapeHtml(occurrence.code)}</pre>` : '';
  return `<li><p>${escapeHtml(location.join(', ') || `Aparición ${index + 1}`)}</p>${code}</li>`;
}

function problemHtml(problem, index) {
  const occurrences = Array.isArray(problem.specificProblems) ? problem.specificProblems : [];
  const type = problem.type ? `<p>Tipo: ${escapeHtml(problem.type)}</p>` : '';
  const description = problem.description ? `<p>${escapeHtml(problem.description)}</p>` : '';
  const help = problem.help && problem.help !== problem.description
    ? `<p>Ayuda: ${escapeHtml(problem.help)}</p>` : '';
  const detail = occurrences.length > 0
    ? `<details><summary>${occurrences.length} ${occurrences.length === 1 ? 'aparición' : 'apariciones'}</summary><ol>${occurrences.map(occurrenceHtml).join('')}</ol></details>`
    : '';
  return `<li><article><h4>${escapeHtml(problem.title || `Problema ${index + 1}`)}</h4>${type}${description}${help}${detail}</article></li>`;
}

function resultHtml(result, index) {
  let body;
  if (result.error) {
    body = `<p class="error">No se ha podido validar: ${escapeHtml(result.error)}</p>`;
  } else if (result.problems.length === 0) {
    body = '<p>No se han detectado problemas.</p>';
  } else {
    body = `<p>${result.problems.length} ${result.problems.length === 1 ? 'tipo de problema encontrado' : 'tipos de problema encontrados'}.</p><ol>${result.problems.map(problemHtml).join('')}</ol>`;
  }
  return `<li><article><h3>Página ${index + 1}</h3><p class="url">${escapeHtml(result.url)}</p>${body}</article></li>`;
}

function htmlReport() {
  const results = lastReport.results.map(resultHtml).join('');
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Resultados del Validador OAW</title>
<style>body{max-width:70rem;margin:0 auto;padding:2rem;font:1rem/1.5 system-ui,sans-serif;color:#1f2937}h1,h2,h3,h4{line-height:1.2}.url{overflow-wrap:anywhere}li{margin-block:1rem}.error{color:#991b1b;font-weight:700}pre{padding:1rem;overflow:auto;white-space:pre-wrap;background:#f1f5f9}</style></head>
<body><main><h1>Resultados del Validador OAW</h1><p>Informe generado el ${escapeHtml(new Date(lastReport.generatedAt).toLocaleString('es-ES'))}.</p>
<p>La ausencia de problemas detectados no garantiza conformidad total.</p><h2>Páginas analizadas</h2><ol>${results}</ol></main></body></html>`;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearResults();
  let urls;
  try {
    urls = normalizedUrls();
    setFieldError('');
  } catch (error) {
    setFieldError(error.message);
    status.textContent = 'Revisa las direcciones web introducidas.';
    urlsInput.focus();
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Validando…';
  resultsContent.setAttribute('aria-busy', 'true');
  const validatedResults = [];
  for (let index = 0; index < urls.length; index += 1) {
    status.textContent = `Validando página ${index + 1} de ${urls.length}: ${urls[index]}`;
    validatedResults.push(await validateUrl(urls[index]));
  }

  lastReport = { generatedAt: new Date().toISOString(), results: validatedResults };
  renderReport(lastReport);
  downloadJsonButton.disabled = false;
  downloadHtmlButton.disabled = false;
  submitButton.disabled = false;
  submitButton.textContent = 'Validar páginas';
  resultsContent.setAttribute('aria-busy', 'false');
});

downloadJsonButton.addEventListener('click', () => {
  if (lastReport) {
    downloadFile(JSON.stringify(lastReport, null, 2), 'application/json;charset=utf-8', reportFilename('json'));
  }
});

downloadHtmlButton.addEventListener('click', () => {
  if (lastReport) downloadFile(htmlReport(), 'text/html;charset=utf-8', reportFilename('html'));
});

urlsInput.addEventListener('input', () => {
  if (urlsInput.getAttribute('aria-invalid') === 'true') setFieldError('');
});
