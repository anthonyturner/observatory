import { ARCHITECTURE_FILE, writeArchitecture } from './architecture-file.ts';
import { scanFromCommandLine } from './scan-command.ts';

const { map, out = ARCHITECTURE_FILE, summary, seconds } = await scanFromCommandLine('arch:scan');
await writeArchitecture(map, out);
console.log(`${summary} Scanned in ${seconds} s. Written to ${out}`);
