import path from 'node:path';
import readline from 'node:readline';
import { Writable } from 'node:stream';
import { hashPassword, MIN_PASSWORD_LENGTH } from '../auth.ts';

export class SetPasswordCliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SetPasswordCliError';
  }
}

export interface SetPasswordCliOptions {
  argv?: readonly string[];
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
}

function promptTwoHiddenLines(
  firstPrompt: string,
  secondPrompt: string,
  input: NodeJS.ReadableStream,
  output: NodeJS.WritableStream,
): Promise<[string, string]> {
  return new Promise<[string, string]>((resolve, reject) => {
    let muted = false;
    const mutableOutput = new Writable({
      write(chunk, encoding, callback) {
        if (!muted) {
          output.write(chunk, encoding, callback);
        } else {
          callback();
        }
      },
    });

    const rl = readline.createInterface({
      input,
      output: mutableOutput,
      terminal: true,
    });

    const answers: string[] = [];
    let finished = false;

    const askPrompt = (promptText: string) => {
      muted = false;
      output.write(promptText);
      muted = true;
    };

    rl.on('SIGINT', () => {
      finished = true;
      muted = false;
      output.write('\n');
      rl.close();
      reject(new SetPasswordCliError('Cancelled.'));
    });

    rl.on('line', (line) => {
      muted = false;
      output.write('\n');
      answers.push(line.replace(/\r$/, ''));
      if (answers.length === 1) {
        askPrompt(secondPrompt);
      } else if (answers.length === 2) {
        finished = true;
        rl.close();
        resolve([answers[0], answers[1]]);
      }
    });

    rl.on('close', () => {
      if (!finished) {
        muted = false;
        output.write('\n');
        reject(new SetPasswordCliError('Error: Password input was interrupted before completion.'));
      }
    });

    askPrompt(firstPrompt);
  });
}

export async function runSetPasswordCli(options: SetPasswordCliOptions = {}): Promise<string> {
  const argv = options.argv ?? process.argv.slice(2);
  if (argv.length > 0) {
    throw new SetPasswordCliError(
      'Error: Do not pass the password as a command-line argument (it would be saved in shell history). Run `npm run set-password` without arguments and enter it when prompted.',
    );
  }

  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stderr;

  const [firstRaw, secondRaw] = await promptTwoHiddenLines(
    `Enter new password (min ${MIN_PASSWORD_LENGTH} characters): `,
    'Confirm new password: ',
    input,
    output,
  );

  const password = firstRaw.trim();
  const confirm = secondRaw.trim();

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new SetPasswordCliError(`Error: Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  }

  if (password !== confirm) {
    throw new SetPasswordCliError('Error: Passwords do not match.');
  }

  return hashPassword(password);
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);

if (isDirectRun) {
  runSetPasswordCli()
    .then((hash) => {
      console.log(`APP_PASSWORD_HASH="${hash}"`);
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
}
