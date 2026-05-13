// src/ot/ot.ts  (client-side mirror of server/src/ot/index.js)
// Character-offset–based OT operation and transform function.
// Monaco exposes `rangeOffset` and `rangeLength` on every content-change event
// so we never need to convert line/column positions to offsets manually.

export interface OTOp {
  type: 'insert' | 'delete';
  pos: number;
  text?: string; // insert only
  len?: number;  // delete only
}

/**
 * Transform `op` so it can be applied AFTER `against` has already been applied.
 * Returns null when the operation becomes a no-op (the chars it wanted to delete
 * were already deleted by `against`).
 */
export function transformOp(op: OTOp, against: OTOp, opId = '', againstId = ''): OTOp | null {
  const p1 = op.pos;
  const p2 = against.pos;

  // ── insert vs insert ───────────────────────────────────────────────────────
  if (op.type === 'insert' && against.type === 'insert') {
    const t2len = against.text!.length;
    if (p2 < p1 || (p2 === p1 && againstId < opId)) {
      return { ...op, pos: p1 + t2len };
    }
    return op;
  }

  // ── insert vs delete ───────────────────────────────────────────────────────
  if (op.type === 'insert' && against.type === 'delete') {
    const n2 = against.len!;
    if (p2 + n2 <= p1) return { ...op, pos: p1 - n2 };
    if (p2 < p1)       return { ...op, pos: p2 };
    return op;
  }

  // ── delete vs insert ───────────────────────────────────────────────────────
  if (op.type === 'delete' && against.type === 'insert') {
    const t2len = against.text!.length;
    const n1 = op.len!;
    if (p2 <= p1)         return { ...op, pos: p1 + t2len };
    if (p2 < p1 + n1)    return { ...op, len: n1 + t2len };
    return op;
  }

  // ── delete vs delete ───────────────────────────────────────────────────────
  if (op.type === 'delete' && against.type === 'delete') {
    const n1 = op.len!;
    const n2 = against.len!;
    const p1End = p1 + n1;
    const p2End = p2 + n2;

    if (p2End <= p1) return { ...op, pos: p1 - n2 };
    if (p2 >= p1End) return op;

    const overlap      = Math.min(p1End, p2End) - Math.max(p1, p2);
    const newLen       = n1 - overlap;
    if (newLen <= 0)   return null;
    const deletedBefore = Math.max(0, Math.min(p2End, p1) - p2);
    return { type: 'delete', pos: p1 - deletedBefore, len: newLen };
  }

  throw new Error(`transformOp: unknown types "${op.type}" / "${against.type}"`);
}

/**
 * Transform a vector of ops against another vector of ops (applied left to right).
 * Returns the transformed ops (nulls removed).
 */
export function transformOpsAgainst(ops: OTOp[], against: OTOp[]): OTOp[] {
  let current: Array<OTOp | null> = [...ops];
  for (const againstOp of against) {
    current = current.map((op) => (op ? transformOp(op, againstOp) : null));
  }
  return current.filter((op): op is OTOp => op !== null);
}
