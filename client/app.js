'use strict';

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const form = document.querySelector('#validation-form');
const urlsInput = document.querySelector('#urls');
const urlsError = document.querySelector('#urls-error');
const pdfInput = document.querySelector('#pdf-file');
const pdfError = document.querySelector('#pdf-error');
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

function setInputError(input, errorElement, message) {
  errorElement.textContent = message;
  errorElement.hidden = !message;
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
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

  if (invalidLines.length > 0) {
    throw new Error(`Revisa ${invalidLines.length === 1 ? 'la línea' : 'las líneas'} ${invalidLines.join(', ')}.`);
  }
  return urls;
}

function selectedPdf() {
  const file = pdfInput.files[0] || null;
  if (!file) return null;
  const hasPdfName = file.name.toLowerCase().endsWith('.pdf');
  if (file.type && file.type !== 'application/pdf' && !hasPdfName) {
    throw new Error('Selecciona un archivo PDF.');
  }
  if (!hasPdfName) throw new Error('Selecciona un archivo con extensión .pdf.');
  if (file.size > MAX_PDF_BYTES) throw new Error('Selecciona un PDF de 25 MB como máximo.');
  return file;
}

async function pdfAsBase64(file) {
  const signature = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...signature) !== '%PDF-') {
    throw new Error('El archivo seleccionado no contiene un PDF válido.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result).split(',', 2)[1]));
    reader.addEventListener('error', () => reject(new Error('No se ha podido leer el PDF.')));
    reader.readAsDataURL(file);
  });
}

function textElement(tagName, text, className) {
  const element = document.createElement(tagName);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

function positiveLocation(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function meaningfulCode(value) {
  const code = String(value || '').trim();
  return code && !/^<PROBLEM-TEXT\s*\/>$/i.test(code) ? code : '';
}

function plainHelp(value) {
  const help = String(value || '');
  if (!/<[a-z][\s\S]*>/i.test(help)) return help.trim();
  const documentFragment = new DOMParser().parseFromString(help, 'text/html');
  documentFragment.querySelectorAll('br').forEach((element) => element.replaceWith('\n'));
  documentFragment.querySelectorAll('p, li').forEach((element) => element.append('\n'));
  return documentFragment.body.textContent.replace(/\n\s*\n/g, '\n\n').trim();
}

function occurrenceItem(occurrence, index) {
  const item = document.createElement('li');
  const location = [];
  const page = positiveLocation(occurrence.page);
  const line = positiveLocation(occurrence.line);
  const column = positiveLocation(occurrence.column);
  const code = meaningfulCode(occurrence.code);
  item.className = 'occurrence';
  if (page) location.push(`Página ${page}`);
  if (line) location.push(`línea ${line}`);
  if (column) location.push(`columna ${column}`);
  item.append(textElement('p', location.join(', ') || `Hallazgo ${index + 1}`));
  if (code) item.append(textElement('pre', code));
  return item;
}

function problemItem(problem, index) {
  const item = document.createElement('li');
  const article = document.createElement('article');
  const occurrences = Array.isArray(problem.specificProblems) ? problem.specificProblems : [];
  const help = plainHelp(problem.help);
  item.className = 'problem';
  article.append(textElement('h4', problem.title || `Problema ${index + 1}`));
  if (problem.type && problem.type !== 'Problema') {
    article.append(textElement('p', `Tipo: ${problem.type}`, 'problem-meta'));
  }
  if (problem.description) article.append(textElement('p', problem.description));

  if (help && help !== problem.description) {
    const helpDetails = document.createElement('details');
    const helpSummary = document.createElement('summary');
    helpSummary.textContent = 'Ver ayuda';
    helpDetails.className = 'help-details';
    helpDetails.append(helpSummary, textElement('p', help));
    article.append(helpDetails);
  }

  if (occurrences.length > 0) {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    const list = document.createElement('ol');
    summary.textContent = `${occurrences.length} ${occurrences.length === 1 ? 'hallazgo' : 'hallazgos'}`;
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

function resultFindings(result) {
  return result.problems.reduce((total, problem) => {
    const occurrences = Array.isArray(problem.specificProblems) ? problem.specificProblems.length : 0;
    return total + Math.max(1, occurrences);
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
  region.setAttribute('aria-label', 'Resumen de elementos analizados');
  caption.textContent = 'Resumen de elementos analizados';

  ['Resultado', 'Dirección o archivo', 'Tipos', 'Hallazgos', 'Estado'].forEach((label) => {
    const heading = document.createElement('th');
    heading.scope = 'col';
    heading.textContent = label;
    headRow.append(heading);
  });

  report.results.forEach((result, index) => {
    const row = document.createElement('tr');
    const resultHeading = document.createElement('th');
    const link = document.createElement('a');
    const sourceCell = document.createElement('td');
    const problemsCell = document.createElement('td');
    const findingsCell = document.createElement('td');
    const stateCell = document.createElement('td');

    resultHeading.scope = 'row';
    link.href = `#resultado-${index + 1}`;
    link.textContent = result.title;
    link.className = 'result-link';
    resultHeading.append(link);
    sourceCell.textContent = result.source;
    sourceCell.className = 'summary-source';
    problemsCell.textContent = result.error ? '—' : String(result.problems.length);
    findingsCell.textContent = result.error ? '—' : String(resultFindings(result));
    stateCell.textContent = result.error ? 'Error' : 'Completado';
    row.append(resultHeading, sourceCell, problemsCell, findingsCell, stateCell);
    body.append(row);
  });

  head.append(headRow);
  table.append(caption, head, body);
  region.append(table);
  return region;
}

function resultItem(result, index) {
  const item = document.createElement('li');
  const article = document.createElement('article');
  item.className = 'url-result';
  article.id = `resultado-${index + 1}`;
  article.tabIndex = -1;
  article.append(textElement('h3', result.title));
  article.append(textElement('p', result.source, 'validated-source'));

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
  const withoutProblems = report.results.length - failed - withProblems;
  const errorSummary = failed > 0 ? ` y ${failed} sin poder validar` : '';
  status.textContent = 'Validación completada.';
  resultsContent.append(textElement(
    'p',
    `${report.results.length} ${report.results.length === 1 ? 'elemento procesado' : 'elementos procesados'}: ` +
      `${withProblems} con problemas, ${withoutProblems} sin problemas${errorSummary}.`,
    'summary'
  ));
  resultsContent.append(summaryTable(report));
  const list = document.createElement('ol');
  list.className = 'url-result-list';
  report.results.forEach((result, index) => list.append(resultItem(result, index)));
  resultsContent.append(list);
}

async function validateContent(job) {
  try {
    const response = await fetch('../api/validation-request/json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: job.content })
    });
    if (!response.ok) throw new Error(`La API ha respondido con el código HTTP ${response.status}.`);
    const data = await response.json();
    if (!data || !Array.isArray(data.problems)) {
      throw new Error('La respuesta de la API no tiene el formato esperado.');
    }
    return { title: job.title, source: job.source, sourceType: job.sourceType, problems: data.problems, error: null };
  } catch (error) {
    return { title: job.title, source: job.source, sourceType: job.sourceType, problems: [], error: error.message };
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
  const page = positiveLocation(occurrence.page);
  const line = positiveLocation(occurrence.line);
  const column = positiveLocation(occurrence.column);
  const code = meaningfulCode(occurrence.code);
  if (page) location.push(`Página ${page}`);
  if (line) location.push(`línea ${line}`);
  if (column) location.push(`columna ${column}`);
  const codeHtml = code ? `<pre>${escapeHtml(code)}</pre>` : '';
  return `<li><p>${escapeHtml(location.join(', ') || `Hallazgo ${index + 1}`)}</p>${codeHtml}</li>`;
}

function problemHtml(problem, index) {
  const occurrences = Array.isArray(problem.specificProblems) ? problem.specificProblems : [];
  const type = problem.type && problem.type !== 'Problema' ? `<p>Tipo: ${escapeHtml(problem.type)}</p>` : '';
  const description = problem.description ? `<p>${escapeHtml(problem.description)}</p>` : '';
  const helpText = plainHelp(problem.help);
  const help = helpText && helpText !== problem.description
    ? `<details><summary>Ver ayuda</summary><p>${escapeHtml(helpText)}</p></details>` : '';
  const detail = occurrences.length > 0
    ? `<details><summary>${occurrences.length} ${occurrences.length === 1 ? 'hallazgo' : 'hallazgos'}</summary><ol>${occurrences.map(occurrenceHtml).join('')}</ol></details>`
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
  return `<li><article id="resultado-${index + 1}"><h3>${escapeHtml(result.title)}</h3><p class="source">${escapeHtml(result.source)}</p>${body}</article></li>`;
}

function htmlReport() {
  const results = lastReport.results.map(resultHtml).join('');
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Resultados del Validador OAW</title>
<style>body{max-width:70rem;margin:0 auto;padding:2rem;font:1rem/1.5 system-ui,sans-serif;color:#1f2937}h1,h2,h3,h4{line-height:1.2}.source{overflow-wrap:anywhere}li{margin-block:1rem}.error{color:#991b1b;font-weight:700}pre{padding:1rem;overflow:auto;white-space:pre-wrap;background:#f1f5f9}summary{font-weight:700;cursor:pointer}</style></head>
<body><main><h1>Resultados del Validador OAW</h1><p>Informe generado el ${escapeHtml(new Date(lastReport.generatedAt).toLocaleString('es-ES'))}.</p>
<p>La ausencia de problemas detectados no garantiza conformidad total.</p><h2>Elementos analizados</h2><ol>${results}</ol></main></body></html>`;
}

function setFormBusy(isBusy) {
  submitButton.disabled = isBusy;
  submitButton.textContent = isBusy ? 'Validando…' : 'Validar contenido';
  urlsInput.disabled = isBusy;
  pdfInput.disabled = isBusy;
  resultsContent.setAttribute('aria-busy', isBusy ? 'true' : 'false');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearResults();
  let urls;
  let pdf;

  try {
    urls = normalizedUrls();
    setInputError(urlsInput, urlsError, '');
  } catch (error) {
    setInputError(urlsInput, urlsError, error.message);
    status.textContent = 'Revisa las direcciones introducidas.';
    urlsInput.focus();
    return;
  }

  try {
    pdf = selectedPdf();
    setInputError(pdfInput, pdfError, '');
  } catch (error) {
    setInputError(pdfInput, pdfError, error.message);
    status.textContent = 'Revisa el documento seleccionado.';
    pdfInput.focus();
    return;
  }

  if (urls.length === 0 && !pdf) {
    setInputError(urlsInput, urlsError, 'Introduce al menos una URL o selecciona un PDF.');
    status.textContent = 'Introduce contenido para validar.';
    urlsInput.focus();
    return;
  }

  setFormBusy(true);
  const jobs = urls.map((url, index) => ({
    title: `Página ${index + 1}`,
    source: url,
    sourceType: 'url',
    content: url
  }));

  if (pdf) {
    status.textContent = `Preparando el PDF: ${pdf.name}`;
    try {
      jobs.push({
        title: 'Documento PDF',
        source: pdf.name,
        sourceType: 'pdf',
        content: await pdfAsBase64(pdf)
      });
    } catch (error) {
      jobs.push({
        title: 'Documento PDF',
        source: pdf.name,
        sourceType: 'pdf',
        preparationError: error.message
      });
    }
  }

  const validatedResults = [];
  for (let index = 0; index < jobs.length; index += 1) {
    const job = jobs[index];
    status.textContent = `Validando ${index + 1} de ${jobs.length}: ${job.source}`;
    if (job.preparationError) {
      validatedResults.push({
        title: job.title,
        source: job.source,
        sourceType: job.sourceType,
        problems: [],
        error: job.preparationError
      });
    } else {
      validatedResults.push(await validateContent(job));
    }
  }

  lastReport = { generatedAt: new Date().toISOString(), results: validatedResults };
  renderReport(lastReport);
  downloadJsonButton.disabled = false;
  downloadHtmlButton.disabled = false;
  setFormBusy(false);
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
  if (urlsInput.getAttribute('aria-invalid') === 'true') setInputError(urlsInput, urlsError, '');
});

pdfInput.addEventListener('change', () => {
  if (pdfInput.getAttribute('aria-invalid') === 'true') setInputError(pdfInput, pdfError, '');
});
