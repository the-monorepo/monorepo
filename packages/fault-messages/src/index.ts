import {
  AssertionFailureData,
  IPC,
  AssertionFailureResult,
  PassingTestData,
  FailingTestData,
  TestResult,
  FileFinishedData,
  FileFinishedResult,
  RunTestData,
  RunTestPayload,
  StopWorkerData,
  StopWorkerResult,
} from '@fault/types';
import { promisify } from 'util';
import { Coverage } from '@fault/istanbul-util';
import { ChildProcess } from 'child_process';

const promiseSend: (param: any) => Promise<unknown> =
  process.send !== undefined ? promisify(process.send!.bind(process)) : undefined!;
export const submitAssertionResult = (data: AssertionFailureData) => {
  const result: AssertionFailureResult = {
    ...data,
    type: IPC.ASSERTION,
  };

  return promiseSend!(result);
};

export const submitTestResult = async (data: PassingTestData | FailingTestData) => {
  const result: TestResult = {
    ...data,
    type: IPC.TEST,
  };

  return await promiseSend!(result);
};

export const submitFileResult = (data: FileFinishedData) => {
  const result: FileFinishedResult = {
    ...data,
    type: IPC.FILE_FINISHED,
  };
  return promiseSend(result);
};

const promiseWorkerSend = (worker: ChildProcess, data: any) => {
  return new Promise((resolve, reject) => {
    worker.send(data, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};
export const runTest = (worker: ChildProcess, data: RunTestData) => {
  const result: RunTestPayload = {
    type: IPC.RUN_TEST,
    ...data,
  };
  return promiseWorkerSend(worker, result);
};

export const stopWorker = (worker: ChildProcess, data: StopWorkerData) => {
  const result: StopWorkerResult = {
    type: IPC.STOP_WORKER,
    ...data,
  };
  return promiseWorkerSend(worker, result);
};