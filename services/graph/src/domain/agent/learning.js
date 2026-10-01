// Aprendizaje del agente de escritorio: los workflows (el puente consciente ↔
// subconsciente) declarados como herramientas del modelo. Port de
// Android/backend/src/learning/workflows.ts.
//
// Las «herramientas aprendidas del árbol de UI» (una secuencia de `taps` por app)
// se borraron el 2026-10-01: nunca hubo quien las captara y el store siempre las
// devolvía vacías, pero el prompt y el catálogo seguían cargando su regla. Los
// clientes conservan su soporte de `taps`, que es inofensivo.
//
// El store real de workflows es application/use-cases/AgentWorkflowStore.js
// (catálogo de Neo4j). El de aquí, en memoria, es el de los tests y el de un
// arranque sin catálogo.

const { WORKFLOW_VIA } = require('./mcpCatalog');

// Nombres de herramienta seguros para function-calling (solo [a-z0-9_]).
function sanitize(value) {
  const cleaned = `${value}`
    .trim()
    .toLowerCase()
    .split('')
    .map((c) => ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') ? c : '_'))
    .join('')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'learned_tool';
}

const MAX_STEPS_IN_DESCRIPTION = 8;

/**
 * Declara un workflow como McpTool `workflow_*` (el modelo lo invoca entero con `context`).
 * La descripción lleva la app y los primeros pasos: es lo que el modelo necesita para saber si el
 * objetivo coincide. Cuántos pasos son «subconscientes» no le dice nada y se quitó.
 */
function workflowToMcp(workflow) {
  const steps = workflow.steps || [];
  const apps = [...new Set(steps.map((step) => step.app).filter(Boolean))];
  const appNote = apps.length ? `[app: ${apps.join(', ')}] ` : '';
  const shown = steps.slice(0, MAX_STEPS_IN_DESCRIPTION).map((step) => step.action).join(' → ');
  const more = steps.length > MAX_STEPS_IN_DESCRIPTION ? ' …' : '';
  return {
    name: `workflow_${sanitize(workflow.name)}`,
    description: `${appNote}${workflow.description}${shown ? ` Pasos: ${shown}${more}.` : ''}`,
    params: [{ name: 'context', description: 'Los datos de ESTA vez (nombres, textos, cantidades) que el workflow necesita; "" si no necesita ninguno' }],
    via: WORKFLOW_VIA
  };
}

/**
 * Store de workflows en memoria (se pierde entre cold starts). Devuelve lo que
 * se le haya añadido con addWorkflow en el mismo proceso.
 */
class InMemoryAgentLearningStore {
  constructor() {
    this.wf = [];
  }

  // Los parámetros (userId, apps, surface, access) existen para que el store real
  // pueda filtrar; aquí se ignoran a propósito.
  async workflows() {
    return this.wf;
  }

  addWorkflow(workflow) {
    this.wf.push(workflow);
  }
}

module.exports = { sanitize, workflowToMcp, InMemoryAgentLearningStore };
