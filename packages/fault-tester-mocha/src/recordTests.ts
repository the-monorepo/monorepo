import { subtractCoverage, Coverage } from '@fault/istanbul-util';
import Mocha from 'mocha';
import { submitTestResult } from '@fault/messages';
import { createHash } from 'crypto';

const { EVENT_TEST_FAIL, EVENT_TEST_PASS } = (Mocha.Runner as any).constants;
const COVERAGE_KEY = '__coverage__';

type PartialTestData = {
  key: string;
  file: string;
  titlePath: string[];
  duration: number;
  coverage: Coverage;
};

type SubmitHandle = (testData: PartialTestData, test: Mocha.Test, err?: any) => {};
const commonTestHandle = (submitHandle: SubmitHandle) => {
  return async (test: Mocha.Test, err) => {
    const coverage = subtractCoverage(global[COVERAGE_KEY], global.beforeTestCoverage);
    const hash =
      test!.titlePath().join('_') +
      createHash('sha1')
        .update(test!.body)
        .digest('base64');
    const duration = test.duration! * 1000;
    const file = test.file!;
    const titlePath = test.titlePath();
    await submitHandle({ key: hash, duration, file, titlePath, coverage }, test, err);
  };
};

export class IPCReporter {
  public constructor(runner) {
    runner
      .on(
        EVENT_TEST_PASS,
        commonTestHandle(async testData => {
          await submitTestResult({
            ...testData,
            passed: true,
          });
        }),
      )
      .on(
        EVENT_TEST_FAIL,
        commonTestHandle(async (testData, test, err) => {
          let stack = err.stack;
          await submitTestResult({
            ...testData,
            passed: false,
            stack,
          });
        }),
      );
  }
}
