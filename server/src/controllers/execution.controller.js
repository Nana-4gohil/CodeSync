// src/controllers/execution.controller.js
const { AppError } = require('../middleware/error');
const { execFile, exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');

const TIMEOUT_MS = parseInt(process.env.EXECUTION_TIMEOUT_MS || '10000', 10);

// ── Language → runner config ───────────────────────────────────────────────────
// Each entry defines how to run source code for that language.
// `ext`      : temp file extension
// `cmd`      : function(filePath) → [binary, [...args]]
// `compile`  : (optional) function(filePath, outPath) → [binary, [...args]]
//              If present, compilation happens first; execution uses outPath.
const RUNNERS = {
  javascript: null,            // handled by inline vm sandbox (no shell-out)
  js:         null,
  typescript: {
    ext: '.ts',
    // ts-node executes TypeScript directly if installed, otherwise fall back
    cmd: (f) => ['npx', ['--yes', 'ts-node', '--skip-project', f]],
  },
  python: {
    ext: '.py',
    cmd: (f) => ['python3', [f]],
  },
  python3: {
    ext: '.py',
    cmd: (f) => ['python3', [f]],
  },
  go: {
    ext: '.go',
    cmd: (f) => ['go', ['run', f]],
  },
  rust: {
    ext: '.rs',
    // compile to a temp binary, then run it
    compile: (src, out) => ['rustc', [src, '-o', out]],
    cmd: (_, out) => [out, []],
  },
  java: {
    ext: '.java',
    compile: (src, dir) => ['javac', ['-d', dir, src]],
    // Main class name must match public class; we use "Main" by convention
    cmd: (_, dir) => ['java', ['-cp', dir, 'Main']],
  },
  cpp: {
    ext: '.cpp',
    compile: (src, out) => ['g++', [src, '-o', out]],
    cmd: (_, out) => [out, []],
  },
  c: {
    ext: '.c',
    compile: (src, out) => ['gcc', [src, '-o', out]],
    cmd: (_, out) => [out, []],
  },
  csharp: {
    ext: '.cs',
    cmd: (f) => ['dotnet-script', [f]],
  },
  php: {
    ext: '.php',
    cmd: (f) => ['php', [f]],
  },
  ruby: {
    ext: '.rb',
    cmd: (f) => ['ruby', [f]],
  },
  swift: {
    ext: '.swift',
    cmd: (f) => ['swift', [f]],
  },
  kotlin: {
    ext: '.kts',
    cmd: (f) => ['kotlinc', ['-script', f]],
  },
  bash:  { ext: '.sh',  cmd: (f) => ['bash',  [f]] },
  shell: { ext: '.sh',  cmd: (f) => ['bash',  [f]] },
};

// ── Main handler ──────────────────────────────────────────────────────────────
async function executeCode(req, res, next) {
  try {
    const { code, language = 'javascript' } = req.body;
    if (!code || !code.trim()) throw new AppError('Code is required.', 400);
    if (code.length > 50000) throw new AppError('Code too long (max 50 000 chars).', 400);

    const lang = language.toLowerCase();

    let result;
    if (lang === 'javascript' || lang === 'js') {
      result = await runInVmSandbox(code);
    } else {
      const runner = RUNNERS[lang];
      if (!runner) {
        throw new AppError(
          `Language "${language}" is not supported. ` +
          `Supported: JavaScript, TypeScript, Python, Go, Rust, Java, C, C++, PHP, Ruby, Swift, Kotlin, Shell.`,
          400
        );
      }
      result = await runInProcess(code, lang, runner);
    }

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// ── Child-process runner ──────────────────────────────────────────────────────
function runInProcess(code, lang, runner) {
  return new Promise((resolve) => {
    const start = Date.now();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codesync-'));
    const srcFile = path.join(tmpDir, `code${runner.ext}`);
    fs.writeFileSync(srcFile, code, 'utf8');

    function cleanup() {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    }

    function done(stdout, stderr, exitCode) {
      cleanup();
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        executionTime: Date.now() - start,
        success: exitCode === 0 && !stderr.trim(),
      });
    }

    // Languages that need compilation first
    if (runner.compile) {
      const outPath = lang === 'java' ? tmpDir : path.join(tmpDir, 'out');
      const [compBin, compArgs] = runner.compile(srcFile, outPath);

      runProc(compBin, compArgs, TIMEOUT_MS, (compOut, compErr, compCode) => {
        if (compCode !== 0) {
          return done('', compErr || compOut, compCode);
        }
        // Compilation ok — now execute
        const [runBin, runArgs] = runner.cmd(srcFile, outPath);
        runProc(runBin, runArgs, TIMEOUT_MS, (out, err, code) => done(out, err, code));
      });
    } else {
      const [bin, args] = runner.cmd(srcFile);
      runProc(bin, args, TIMEOUT_MS, (out, err, code) => done(out, err, code));
    }
  });
}

// ── Low-level process spawner ─────────────────────────────────────────────────
function runProc(bin, args, timeoutMs, cb) {
  let stdout = '';
  let stderr = '';
  let timedOut = false;

  const child = execFile(bin, args, { timeout: timeoutMs }, (err, out, err2) => {
    if (timedOut) return;
    stdout = out || '';
    stderr = err2 || '';
    if (err && err.code === 'ETIMEDOUT') {
      timedOut = true;
      stderr = `Execution timed out after ${timeoutMs}ms`;
      return cb(stdout, stderr, 1);
    }
    cb(stdout, stderr, err ? (err.code ?? 1) : 0);
  });

  // Guard: kill after timeout
  const kill = setTimeout(() => {
    timedOut = true;
    try { child.kill('SIGKILL'); } catch {}
    cb('', `Execution timed out after ${timeoutMs}ms`, 1);
  }, timeoutMs + 500);

  child.on('close', () => clearTimeout(kill));
}

// ── JavaScript VM sandbox (unchanged) ─────────────────────────────────────────
function runInVmSandbox(code) {
  return new Promise((resolve) => {
    const logs = [];
    const errors = [];
    const start = Date.now();

    const sandbox = {
      console: {
        log:   (...a) => logs.push(a.map(fmt).join(' ')),
        warn:  (...a) => logs.push('[warn] ' + a.map(fmt).join(' ')),
        error: (...a) => errors.push('[error] ' + a.map(fmt).join(' ')),
        info:  (...a) => logs.push('[info] ' + a.map(fmt).join(' ')),
      },
      Math, Date, JSON, parseInt, parseFloat, isNaN, isFinite,
      Array, Object, String, Number, Boolean, RegExp, Error, Promise,
      setTimeout: undefined, setInterval: undefined,
      clearTimeout: undefined, clearInterval: undefined,
      require: undefined, process: undefined, global: undefined,
      __dirname: undefined, __filename: undefined,
    };

    try {
      vm.createContext(sandbox);
      const wrappedCode = `(async () => { ${code} })()`;
      const script = new vm.Script(wrappedCode);
      const result = script.runInContext(sandbox, { timeout: TIMEOUT_MS });

      if (result && typeof result.then === 'function') {
        const timer = setTimeout(() => resolve({
          stdout: logs.join('\n'), stderr: 'Execution timed out.',
          executionTime: Date.now() - start, success: false,
        }), TIMEOUT_MS);

        result
          .then(() => { clearTimeout(timer); resolve({ stdout: logs.join('\n'), stderr: errors.join('\n'), executionTime: Date.now() - start, success: errors.length === 0 }); })
          .catch((e) => { clearTimeout(timer); resolve({ stdout: logs.join('\n'), stderr: e.message || String(e), executionTime: Date.now() - start, success: false }); });
      } else {
        resolve({ stdout: logs.join('\n'), stderr: errors.join('\n'), executionTime: Date.now() - start, success: errors.length === 0 });
      }
    } catch (e) {
      resolve({ stdout: logs.join('\n'), stderr: e.message || String(e), executionTime: Date.now() - start, success: false });
    }
  });
}

function fmt(val) {
  if (typeof val === 'object' && val !== null) {
    try { return JSON.stringify(val, null, 2); } catch {}
  }
  return String(val);
}

module.exports = { executeCode };
