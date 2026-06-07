#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = { speed: '1.0', encoding: 'mp3', voice: 'zh-CN-XiaoxiaoNeural' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--text') args.text = argv[++i];
    else if (a === '--text-file') args.textFile = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--speed') args.speed = argv[++i];
    else if (a === '--voice') args.voice = argv[++i];
    else if (a === '--encoding') args.encoding = argv[++i];
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

function getDuration(filePath) {
  try {
    const out = execFileSync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ], { encoding: 'utf8' });
    return parseFloat(out.trim());
  } catch (e) {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv);
  
  let text = args.text;
  if (!text && args.textFile) {
    text = fs.readFileSync(args.textFile, 'utf8').trim();
  }
  if (!text) throw new Error('缺 --text');
  if (!args.out) throw new Error('缺 --out');

  const outPath = path.resolve(args.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  // rate formatting for edge-tts: +10% or -10%
  let rate = "+0%";
  if (args.speed && args.speed !== '1.0') {
    const speed = parseFloat(args.speed);
    const percent = Math.round((speed - 1) * 100);
    rate = percent >= 0 ? `+${percent}%` : `${percent}%`;
  }

  // Call edge-tts
  // stderr needs to be ignored or piped to avoid interfering with the JSON output
  execFileSync('edge-tts', [
    '--text', text,
    '--voice', args.voice,
    '--rate', rate,
    '--write-media', outPath
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  const duration = getDuration(outPath);
  const stat = fs.statSync(outPath);
  
  const result = {
    path: outPath,
    bytes: stat.size,
    duration,
    text_chars: text.length,
  };
  console.log(JSON.stringify(result));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
