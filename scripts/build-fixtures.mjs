/**
 * 生成测试页需要、但不适合进版本库的二进制素材。
 *
 * 目前只有 test/mock/tone.wav：一段 3 秒的 440Hz 音频，用来驱动进度条与
 * timeupdate 事件。它是纯生成物，提交进仓库只会让 git 里多一份无意义的二进制，
 * 因此在 .gitignore 里排除，由 pretest 在本机重新生成。
 *
 * 用法：node scripts/build-fixtures.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const RATE = 8000;      // 采样率（8kHz，够用且体积小）
const SECONDS = 3;      // 时长
const FREQ = 440;       // 频率

/**
 * 生成 8bit 单声道 WAV（RIFF/PCM）
 * @returns {Buffer}
 */
export function buildToneWav() {
    const total = RATE * SECONDS;
    const data = Buffer.alloc(total);

    for (let i = 0; i < total; i++) {
        const t = i / RATE;
        // 首尾各 100ms 淡入淡出，避免爆音
        const fade = Math.min(1, t / 0.1, (SECONDS - t) / 0.1);
        const wave = Math.sin(2 * Math.PI * FREQ * t) * fade * 0.25;
        data[i] = Math.max(0, Math.min(255, Math.round(128 + wave * 127)));
    }

    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + total, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);          // fmt chunk 长度
    header.writeUInt16LE(1, 20);           // PCM
    header.writeUInt16LE(1, 22);           // 单声道
    header.writeUInt32LE(RATE, 24);
    header.writeUInt32LE(RATE, 28);        // 字节率 = 采样率 × 声道 × 位深/8
    header.writeUInt16LE(1, 32);           // 块对齐
    header.writeUInt16LE(8, 34);           // 位深
    header.write('data', 36);
    header.writeUInt32LE(total, 40);

    return Buffer.concat([header, data]);
}

/** 写入 test/mock/tone.wav */
export function writeToneWav() {
    const out = path.join(root, 'test/mock/tone.wav');
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, buildToneWav());
    console.log('built  test/mock/tone.wav');
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) writeToneWav();
