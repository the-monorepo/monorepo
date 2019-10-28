import { readFile } from 'mz/fs';

export const cloneCoverage = coverage => {
  if (Array.isArray(coverage)) {
    return coverage.map(cloneCoverage);
  } else if (typeof coverage === 'object') {
    const obj = {};
    for (const [key, value] of Object.entries(coverage)) {
      obj[key] = cloneCoverage(value);
    }
    return obj;
  } else {
    return coverage;
  }
};

export const diffExpressionObjectCount = (from, amount) => {
  const diff = {};
  for (const key of Object.keys(from)) {
    diff[key] = from[key] - amount[key];
  }
  return diff;
};

export interface BCoverage {
  [s: string]: number[];
}

export const diffBranchObjectCount = (from: BCoverage, amount: BCoverage) => {
  const diff: BCoverage = {};

  for (const key of Object.keys(from)) {
    const fromBranch = from[key];
    const amountBranch = amount[key];

    const branch = new Array(fromBranch.length);
    for (let i = 0; i < branch.length; i++) {
      branch[i] = fromBranch[i] - amountBranch[i];
    }
    diff[key] = branch;
  }

  return diff;
};

const notZero = value => value !== 0;

export interface FCoverage {
  [s: string]: number;
}

export interface SCoverage {
  [s: string]: number;
}

export type TextLocation = {
  line: number;
  column: number;
};

export interface ExpressionLocation {
  start: TextLocation;
  end: TextLocation;
}
export interface StatementMap {
  [s: string]: ExpressionLocation;
}
export interface FunctionCoverage {
  name: string;
  decl: ExpressionLocation;
  loc: ExpressionLocation;
  line: number;
}
export interface FunctionMap {
  [s: string]: FunctionCoverage;
}
export interface Coverage {
  [s: string]: {
    path: string;
    statementMap: StatementMap;
    fnMap: FunctionMap;
    branchMap: any;
    s: SCoverage;
    f: FCoverage;
    b: BCoverage;
    _coverageSchema: string;
    hash: string;
  };
}
export const subtractCoverage = (from: Coverage = {}, amount: Coverage | undefined) => {
  if (amount === undefined) {
    return cloneCoverage(from);
  }
  const diff = {};
  for (const [filePath, fileCoverage] of Object.entries(from)) {
    const beforeFileCoverage = amount[filePath];
    if (beforeFileCoverage === undefined) {
      diff[filePath] = cloneCoverage(fileCoverage);
      continue;
    }

    const fileDiff = {
      path: filePath,
      statementMap: fileCoverage.statementMap,
      fnMap: fileCoverage.fnMap,
      branchMap: fileCoverage.branchMap,
      s: diffExpressionObjectCount(fileCoverage.s, beforeFileCoverage.s),
      f: diffExpressionObjectCount(fileCoverage.f, beforeFileCoverage.f),
      b: diffBranchObjectCount(fileCoverage.b, beforeFileCoverage.b),
      _coverageSchema: fileCoverage._coverageSchema,
      hash: fileCoverage.hash,
    };

    const hasChanged =
      Object.values(fileDiff.s).some(notZero) ||
      Object.values(fileDiff.f).some(notZero) ||
      Object.values(fileDiff.b).some(arr => arr.some(notZero));
    if (hasChanged) {
      diff[filePath] = fileDiff;
    }
  }
  return diff;
};

export const readCoverageFile = async (
  filePath: string = './coverage/coverage-final.json',
): Promise<Coverage> => {
  const coverageText = await readFile(filePath, 'utf8');
  const coverage = JSON.parse(coverageText);
  return coverage;
};

export const getTotalExecutedStatements = (coverage: Coverage): number => {
  let total = 0;

  for (const fileCoverage of Object.values(coverage)) {
    total += Object.values(fileCoverage.s).filter(value => value > 0).length;
  }

  return total;
};