// src/controllers/execution.controller.js
const { AppError } = require('../middleware/error');

const TIMEOUT_MS = parseInt(process.env.EXECUTION_TIMEOUT_MS || '5000', 10);

/**
 * Sandboxed JavaScript execution using Node.js's built-in `vm` module.
 *
 * Security constraints applied:
 *  - Code runs in an isolated V8 context (vm.createContext)
 *  - require() is NOT exposed — no file system, network, or child_process access
 *  - process, global are not exposed
 *  - console.log/warn/error are captured and returned as output
 *  - Hard timeout via vm.runInNewContext timeout option
 *
 * Note: For production-grade isolation use gVisor / Firecracker / Docker.
 * vm is safe for demo purposes but not for fully untrusted code.
 */
async function executeCode(req, res, next) {
  try {
    const { code, language = 'javascript' } = req.body;

    if (!code || !code.trim()) throw new AppError('Code is required.', 400);
    if (code.length > 50000) throw new AppError('Code too long (max 50 000 characters).', 400);

    if (language !== 'javascript' && language !== 'js') {
      throw new AppError(
        `Language "${language}" is not supported. Only JavaScript is available.`,
        400
      );
    }

    const result = await runInSandbox(code);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

function runInSandbox(code) {
  return new Promise((resolve) => {
    const logs = [];
    const errors = [];
    const start = Date.now();

    // Build a safe sandbox context — no dangerous globals
    const sandbox = {
      console: {
        log: (...args) => logs.push(args.map(formatValue).join(' ')),
        warn: (...args) => logs.push('[warn] ' + args.map(formatValue).join(' ')),
        error: (...args) => errors.push('[error] ' + args.map(formatValue).join(' ')),
        info: (...args) => logs.push('[info] ' + args.map(formatValue).join(' ')),
      },
      Math,
      Date,
      JSON,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      Array,
      Object,
      String,
      Number,
      Boolean,
      RegExp,
      Error,
      Promise,
      setTimeout: undefined,  // explicitly blocked
      setInterval: undefined,
      clearTimeout: undefined,
      clearInterval: undefined,
      require: undefined,     // blocked
      process: undefined,     // blocked
      global: undefined,      // blocked
      __dirname: undefined,
      __filename: undefined,
    };

    try {
      const vm = require('vm');
      vm.createContext(sandbox);

      // Wrap in async IIFE to support top-level await style patterns
      const wrappedCode = `(async () => { ${code} })()`;
      const script = new vm.Script(wrappedCode);
      const result = script.runInContext(sandbox, { timeout: TIMEOUT_MS });

      // Handle async results
      if (result && typeof result.then === 'function') {
        const timer = setTimeout(() => {
          resolve({
            stdout: logs.join('\n'),
            stderr: 'Execution timed out.',
            executionTime: Date.now() - start,
            success: false,
          });
        }, TIMEOUT_MS);

        result
          .then(() => {
            clearTimeout(timer);
            resolve({
              stdout: logs.join('\n'),
              stderr: errors.join('\n'),
              executionTime: Date.now() - start,
              success: errors.length === 0,
            });
          })
          .catch((err) => {
            clearTimeout(timer);
            resolve({
              stdout: logs.join('\n'),
              stderr: err.message || String(err),
              executionTime: Date.now() - start,
              success: false,
            });
          });
      } else {
        resolve({
          stdout: logs.join('\n'),
          stderr: errors.join('\n'),
          executionTime: Date.now() - start,
          success: errors.length === 0,
        });
      }
    } catch (err) {
      resolve({
        stdout: logs.join('\n'),
        stderr: err.message || String(err),
        executionTime: Date.now() - start,
        success: false,
      });
    }
  });
}

function formatValue(val) {
  if (typeof val === 'object' && val !== null) {
    try { return JSON.stringify(val, null, 2); } catch { return String(val); }
  }
  return String(val);
}

module.exports = { executeCode };
