import * as types from 'fl-addon-message-types';
import { promisify } from 'util';
interface TypeHolder<T> {
  type: T;
}
export interface AssertionData {
  passed: boolean;
  coverage: any;
}
export type AssertionResult = AssertionData & TypeHolder<typeof types.ASSERTION>;

type TestData =  {
  fullTitle: any;
  hash: string;
  duration: number;
  file: string;
  coverage: any;
}

type PassingTestData = {
  passed: true;  
} & TestData;

type FailingTestData = {
  passed: false;
  stack: any;
} & TestData;
export type TestResult = (PassingTestData | FailingTestData) & TypeHolder<typeof types.TEST>;

export interface ExecutionData {
  passed: boolean;
}
export type ExecutionResult = ExecutionData & TypeHolder<typeof types.EXECUTION>;

const promiseSend: (param: any) => Promise<unknown> = promisify(
  process.send!.bind(process),
);
export const submitAssertionResult = (data: AssertionData) => {
  const result: AssertionResult = {
    ...data,
    type: types.ASSERTION,
  };

  return promiseSend!(result);
};

export const submitTestResult = (data: PassingTestData | FailingTestData) => {
  const result: TestResult = {
    ...data,
    type: types.TEST,
  };

  return promiseSend!(result);
};

export const submitExecutionResult = (data: ExecutionData) => {
  const result: ExecutionResult = {
    ...data,
    type: types.EXECUTION,
  };

  return promiseSend!(result);
};