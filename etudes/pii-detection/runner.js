import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2';

// Global state
let nerPipeline = null;
let modelLoading = false;

// DOM Elements
const btnLoadModel = document.getElementById('btn-load-model');
const btnAnalyze = document.getElementById('btn-analyze');
const btnRedact = document.getElementById('btn-redact');
const demoInput = document.getElementById('demo-input');
const modelSpinner = document.getElementById('model-spinner');
const progressContainer = document.getElementById('progress-container');
const progressLabel = document.getElementById('progress-label');
const progressBarFill = document.getElementById('progress-bar-fill');
const outputContainer = document.getElementById('output-container');
const outputDisplay = document.getElementById('output-display');
const modelStatusBadge = document.getElementById('model-status-badge');
const statusText = document.getElementById('status-text');

// Checkbox elements
const toggles = {
  NAME: document.getElementById('toggle-name'),
  EMAIL: document.getElementById('toggle-email'),
  PHONE: document.getElementById('toggle-phone'),
  SSN: document.getElementById('toggle-ssn'),
  CARD: document.getElementById('toggle-card'),
  LOC: document.getElementById('toggle-loc'),
  ORG: document.getElementById('toggle-org')
};

// Regex patterns for structured PII
const REGEX_PATTERNS = {
  EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  PHONE: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
  SSN: /\b\d{3}-\d{2}-\d{4}\b/g,
  CARD: /\b(?:\d[ -]*?){13,16}\b/g
};

// Helper: Escape HTML to prevent XSS in output rendering
function escapeHtml(text) {
  const div = document.createElement('div');
  div.innerText = text;
  return div.innerHTML;
}

// Event Listeners
btnLoadModel.addEventListener('click', loadModel);
btnAnalyze.addEventListener('click', () => processText(false));
btnRedact.addEventListener('click', () => processText(true));

// Load the NER Model
async function loadModel() {
  if (nerPipeline || modelLoading) return;
  
  modelLoading = true;
  btnLoadModel.disabled = true;
  modelSpinner.style.display = 'inline-block';
  progressContainer.style.display = 'block';
  progressBarFill.style.width = '0%';
  progressLabel.textContent = 'Initializing download...';
  
  try {
    // Disable local model loading (force fetching from HF hub)
    env.allowLocalModels = false;
    
    // Load quantized BERT NER model
    // The model is around 43MB in quantized ONNX format
    nerPipeline = await pipeline('token-classification', 'Xenova/bert-base-NER', {
      progress_callback: (data) => {
        if (data.status === 'progress') {
          const pct = data.progress;
          progressBarFill.style.width = `${pct}%`;
          progressLabel.textContent = `Downloading model: ${pct.toFixed(1)}%`;
        } else if (data.status === 'ready') {
          progressLabel.textContent = 'Model loaded successfully!';
        }
      }
    });
    
    // Update UI status
    modelStatusBadge.className = 'status-badge ready';
    statusText.textContent = 'Model Ready';
    
    // Hide progress bar and spinner after a brief delay
    setTimeout(() => {
      progressContainer.style.display = 'none';
    }, 1500);
    
    btnLoadModel.style.display = 'none'; // Hide load button
    btnAnalyze.removeAttribute('disabled');
    btnRedact.removeAttribute('disabled');
  } catch (err) {
    console.error("Failed to load model:", err);
    progressLabel.textContent = 'Failed to load model. Please try again.';
    progressBarFill.style.backgroundColor = '#ef4444';
    btnLoadModel.disabled = false;
    modelSpinner.style.display = 'none';
  } finally {
    modelLoading = false;
  }
}

// Run the PII detection pipeline
async function processText(redactMode = false) {
  const text = demoInput.value.trim();
  if (!text) return;
  
  outputContainer.style.display = 'block';
  outputDisplay.innerHTML = '<div style="color: var(--text-secondary)">Running detection...</div>';
  
  // 1. Run Regex Engine for structured PII
  const entities = [];
  
  if (toggles.EMAIL.checked) {
    detectRegex(text, REGEX_PATTERNS.EMAIL, 'EMAIL', entities);
  }
  if (toggles.PHONE.checked) {
    detectRegex(text, REGEX_PATTERNS.PHONE, 'PHONE', entities);
  }
  if (toggles.SSN.checked) {
    detectRegex(text, REGEX_PATTERNS.SSN, 'SSN', entities);
  }
  if (toggles.CARD.checked) {
    detectRegex(text, REGEX_PATTERNS.CARD, 'CARD', entities);
  }
  
  // 2. Run NER Model for unstructured PII
  if (nerPipeline) {
    try {
      // Run inference with simple aggregation to group sub-word tokens
      const nerResults = await nerPipeline(text, { aggregation_strategy: 'simple' });
      console.log("DEBUG - NER Results:", JSON.stringify(nerResults));
      
      let searchIndex = 0;
      nerResults.forEach(ent => {
        let type = null;
        
        // Handle both aggregated (entity_group) and token-level (entity) formats
        const entityLabel = ent.entity_group || ent.entity || '';
        if ((entityLabel === 'PER' || entityLabel.endsWith('PER')) && toggles.NAME.checked) type = 'NAME';
        if ((entityLabel === 'LOC' || entityLabel.endsWith('LOC')) && toggles.LOC.checked) type = 'LOC';
        if ((entityLabel === 'ORG' || entityLabel.endsWith('ORG')) && toggles.ORG.checked) type = 'ORG';
        
        if (type) {
          let start = ent.start;
          let end = ent.end;
          
          // Fallback if the tokenizer doesn't return character offsets (start/end are null or undefined)
          if (start == null || end == null) {
            const cleanWord = ent.word.replace(/^##/, '');
            let pos = -1;
            let tempSearchIndex = searchIndex;
            
            // Loop to find the occurrence that doesn't overlap with existing regex entities
            while (true) {
              pos = text.toLowerCase().indexOf(cleanWord.toLowerCase(), tempSearchIndex);
              if (pos === -1) break;
              
              const tempEnd = pos + cleanWord.length;
              if (!isInsideExistingEntity(pos, tempEnd, entities)) {
                start = pos;
                end = tempEnd;
                searchIndex = end;
                break;
              }
              tempSearchIndex = pos + 1; // Try next occurrence
            }
          }
          
          if (start != null && end != null) {
            entities.push({
              start: start,
              end: end,
              text: text.slice(start, end),
              type: type,
              source: 'NER'
            });
          }
        }
      });
    } catch (err) {
      console.error("NER inference failed:", err);
    }
  }
  
  // 3. Merge and Resolve Overlaps
  const resolvedEntities = mergeEntities(text, entities);
  
  // 4. Render Output
  if (redactMode) {
    renderRedactedText(text, resolvedEntities);
  } else {
    renderHighlightedText(text, resolvedEntities);
  }
}

// Helper: Run regex matching and push to entities array
function detectRegex(text, regex, type, entities) {
  // Reset regex index
  regex.lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    entities.push({
      start: match.index,
      end: regex.lastIndex,
      text: match[0],
      type: type,
      source: 'REGEX'
    });
  }
}

// Helper: Check if a span overlaps with any existing entity
function isInsideExistingEntity(start, end, existingEntities) {
  return existingEntities.some(ext => {
    return start < ext.end && end > ext.start;
  });
}

// Helper: Sort and merge overlapping or near-adjacent entities
function mergeEntities(text, entities) {
  // Sort by start index ascending
  entities.sort((a, b) => a.start - b.start);
  
  const merged = [];
  for (const entity of entities) {
    if (merged.length === 0) {
      merged.push(entity);
      continue;
    }
    
    const last = merged[merged.length - 1];
    
    // Check if they are the same type and separated only by whitespace or hyphens
    const areSameType = entity.type === last.type;
    const betweenText = text.slice(last.end, entity.start);
    const isNearAdjacent = areSameType && /^[\s-]*$/.test(betweenText);
    
    if (entity.start < last.end || isNearAdjacent) {
      // Overlap or near-adjacency detected!
      // Resolve: If one is Regex and the other is NER, prioritize Regex
      if (entity.source === 'REGEX' && last.source === 'NER') {
        last.end = Math.max(last.end, entity.end);
        last.text = text.slice(last.start, last.end);
        last.source = 'REGEX';
      } else if (last.source === 'REGEX' && entity.source === 'NER') {
        last.end = Math.max(last.end, entity.end);
        last.text = text.slice(last.start, last.end);
      } else {
        // Same source, or both NER: merge them
        last.end = Math.max(last.end, entity.end);
        last.text = text.slice(last.start, last.end);
      }
    } else {
      merged.push(entity);
    }
  }
  return merged;
}

// Helper: Render text with highlighted PII spans
function renderHighlightedText(text, entities) {
  let html = '';
  let cursor = 0;
  
  entities.forEach(ent => {
    html += escapeHtml(text.slice(cursor, ent.start));
    html += `<span class="pii-highlight pii-${ent.type.toLowerCase()}" data-type="${ent.type}">${escapeHtml(text.slice(ent.start, ent.end))}</span>`;
    cursor = ent.end;
  });
  
  html += escapeHtml(text.slice(cursor));
  outputDisplay.innerHTML = html;
}

// Helper: Render text with redacted PII tokens
function renderRedactedText(text, entities) {
  let html = '';
  let cursor = 0;
  
  entities.forEach(ent => {
    html += escapeHtml(text.slice(cursor, ent.start));
    html += `<span class="pii-redacted">[REDACTED_${ent.type}]</span>`;
    cursor = ent.end;
  });
  
  html += escapeHtml(text.slice(cursor));
  outputDisplay.innerHTML = html;
}

// Auto-load the model on page load
loadModel();
