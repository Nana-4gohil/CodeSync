// src/ot/index.js
// ─────────────────────────────────────────────────────────────────────────────
// Operational Transformation core
//
// OTOp:
//   { type: 'insert', pos: number, text: string }
//   { type: 'delete', pos: number, len: number  }
//
// All positions are character offsets into the document string.
// Monaco exposes rangeOffset / rangeLength on every change event so
// no line→column→offset conversion is needed on the client.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transform `op` so it can be applied AFTER `against` has already been applied.
 * Returns the transformed op, or null if the op becomes a no-op (e.g. the
 * characters it wanted to delete were already deleted by `against`).
 *
 * @param {{ type: string, pos: number, text?: string, len?: number }} op
 * @param {{ type: string, pos: number, text?: string, len?: number }} against
 * @param {string} [opId]      – stable id for tiebreaking concurrent inserts at the same pos
 * @param {string} [againstId] – stable id for the `against` op
 * @returns {{ type: string, pos: number, text?: string, len?: number } | null}
 */
function transformOp(op, against, opId = '', againstId = '') {
  const p1 = op.pos;
  const p2 = against.pos;

  // ── insert vs insert ───────────────────────────────────────────────────────
  if (op.type === 'insert' && against.type === 'insert') {
    const t2len = against.text.length;
    // Tiebreak by id so both sides resolve to the same order
    if (p2 < p1 || (p2 === p1 && againstId < opId)) {
      return { ...op, pos: p1 + t2len };
    }
    return op;
  }

  // ── insert vs delete ───────────────────────────────────────────────────────
  if (op.type === 'insert' && against.type === 'delete') {
    const n2 = against.len;
    if (p2 + n2 <= p1) {
      // deletion entirely before insert → shift left
      return { ...op, pos: p1 - n2 };
    }
    if (p2 < p1) {
      // insert position was inside the deleted range → move to deletion start
      return { ...op, pos: p2 };
    }
    // deletion at or after insert → no change
    return op;
  }

  // ── delete vs insert ───────────────────────────────────────────────────────
  if (op.type === 'delete' && against.type === 'insert') {
    const t2len = against.text.length;
    const n1 = op.len;
    if (p2 <= p1) {
      // insertion before delete start → shift right
      return { ...op, pos: p1 + t2len };
    }
    if (p2 < p1 + n1) {
      // insertion inside the range to delete → expand range
      return { ...op, len: n1 + t2len };
    }
    // insertion after delete range → no change
    return op;
  }

  // ── delete vs delete ───────────────────────────────────────────────────────
  if (op.type === 'delete' && against.type === 'delete') {
    const n1 = op.len;
    const n2 = against.len;
    const p1End = p1 + n1;
    const p2End = p2 + n2;

    if (p2End <= p1) {
      // `against` is entirely before op → shift left
      return { ...op, pos: p1 - n2 };
    }
    if (p2 >= p1End) {
      // `against` is entirely after op → no change
      return op;
    }
    // overlapping — calculate how many chars op still needs to delete
    const overlapStart = Math.max(p1, p2);
    const overlapEnd   = Math.min(p1End, p2End);
    const overlap      = overlapEnd - overlapStart;
    const newLen       = n1 - overlap;
    if (newLen <= 0) return null; // completely subsumed by `against`
    // New start: shift by how much `against` deleted before p1
    const deletedBefore = Math.max(0, Math.min(p2End, p1) - p2);
    return { type: 'delete', pos: p1 - deletedBefore, len: newLen };
  }

  throw new Error(`transformOp: unknown op types "${op.type}" / "${against.type}"`);
}

/**
 * Transform a batch of ops against a history slice.
 * `history` is an array of op-arrays (each entry = one client's ops at that revision).
 * `fromRevision` is the index into history to start from.
 *
 * @param {Array} ops
 * @param {Array<Array>} history
 * @param {number} fromRevision
 * @returns {Array} transformed ops (nulls removed)
 */
function transformOpsAgainstHistory(ops, history, fromRevision) {
  let current = [...ops];
  for (let rev = fromRevision; rev < history.length; rev++) {
    const histOps = history[rev];
    const next = [];
    for (let op of current) {
      if (!op) continue;
      for (const histOp of histOps) {
        op = transformOp(op, histOp);
        if (!op) break;
      }
      if (op) next.push(op);
    }
    current = next;
  }
  return current;
}

/**
 * Apply a single OTOp to a string, returning the new string.
 * @param {string} content
 * @param {{ type: string, pos: number, text?: string, len?: number }} op
 * @returns {string}
 */
function applyOpToString(content, op) {
  if (op.type === 'insert') {
    return content.slice(0, op.pos) + op.text + content.slice(op.pos);
  }
  if (op.type === 'delete') {
    return content.slice(0, op.pos) + content.slice(op.pos + op.len);
  }
  throw new Error(`applyOpToString: unknown op type "${op.type}"`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-file in-memory state
// ─────────────────────────────────────────────────────────────────────────────

/** @type {Map<string, { content: string, revision: number, history: Array<Array> }>} */
const fileStates = new Map();

/**
 * Get (or lazily initialise) the OT state for a file.
 * `initialContent` is only used when the state is first created.
 */
function getFileState(fileId, initialContent = '') {
  if (!fileStates.has(fileId)) {
    fileStates.set(fileId, { content: initialContent, revision: 0, history: [] });
  }
  return fileStates.get(fileId);
}

/** Remove a file's in-memory state (call when no users are in the room). */
function deleteFileState(fileId) {
  fileStates.delete(fileId);
}

module.exports = {
  transformOp,
  transformOpsAgainstHistory,
  applyOpToString,
  getFileState,
  deleteFileState,
};
