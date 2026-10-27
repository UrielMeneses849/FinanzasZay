import {spawnSync} from 'node:child_process';
const command=process.platform==='win32'?'npm.cmd':'npm';
const result=spawnSync(command,['run','build:pwa'],{stdio:'inherit',env:{...process.env,ZAY_BASE_PATH:'/FinanzasZay/'}});
process.exit(result.status??1);
