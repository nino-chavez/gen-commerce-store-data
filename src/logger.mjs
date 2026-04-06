const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

export function createLogger(prefix = '') {
  const tag = prefix ? `[${prefix}] ` : '';

  return {
    info: (msg) => console.log(`${COLORS.cyan}${tag}${COLORS.reset}${msg}`),
    success: (msg) => console.log(`${COLORS.green}${tag}OK${COLORS.reset} ${msg}`),
    warn: (msg) => console.log(`${COLORS.yellow}${tag}WARN${COLORS.reset} ${msg}`),
    error: (msg) => console.error(`${COLORS.red}${tag}ERR${COLORS.reset} ${msg}`),
    dim: (msg) => console.log(`${COLORS.dim}${tag}${msg}${COLORS.reset}`),
    progress: (current, total, label) => {
      const pct = Math.round((current / total) * 100);
      const bar = '='.repeat(Math.floor(pct / 5)).padEnd(20);
      process.stdout.write(`\r${COLORS.cyan}${tag}${COLORS.reset}[${bar}] ${pct}% ${label || ''}`);
      if (current === total) process.stdout.write('\n');
    },
    banner: (title) => {
      const line = '='.repeat(60);
      console.log(`\n${line}`);
      console.log(title);
      console.log(line);
    },
  };
}
