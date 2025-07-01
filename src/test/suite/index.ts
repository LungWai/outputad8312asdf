import * as path from 'path';
import Mocha from 'mocha';
const glob = require('glob');

export function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 60000, // Longer timeout for VS Code extension tests
    reporter: 'spec',
    slow: 5000
  });

  const testsRoot = path.resolve(__dirname, '..');

  return new Promise((resolve, reject) => {
    // Suppress some console warnings during test execution
    const originalConsoleWarn = console.warn;
    const originalConsoleError = console.error;

    console.warn = (message: any, ...args: any[]) => {
      // Filter out known warnings that we can't control
      if (typeof message === 'string' && (
        message.includes('importAttributes') ||
        message.includes('importAssertions') ||
        message.includes('Failed to load message bundle') ||
        message.includes('ExperimentalWarning')
      )) {
        return;
      }
      originalConsoleWarn(message, ...args);
    };

    console.error = (message: any, ...args: any[]) => {
      // Filter out known errors that don't affect test execution
      if (typeof message === 'string' && (
        message.includes('Failed to load message bundle') ||
        message.includes('NoWorkspaceUriError')
      )) {
        return;
      }
      originalConsoleError(message, ...args);
    };

    glob('**/**.test.js', { cwd: testsRoot }, (err: Error | null, files: string[]) => {
      if (err) {
        console.error = originalConsoleError;
        console.warn = originalConsoleWarn;
        return reject(err);
      }

      // Add files to the test suite
      files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

      try {
        // Run the mocha test
        mocha.run(failures => {
          // Restore original console methods
          console.error = originalConsoleError;
          console.warn = originalConsoleWarn;

          if (failures > 0) {
            reject(new Error(`${failures} tests failed.`));
          } else {
            resolve();
          }
        });
      } catch (err) {
        console.error = originalConsoleError;
        console.warn = originalConsoleWarn;
        console.error(err);
        reject(err);
      }
    });
  });
}