import {
  getAstPath,
  forceConsequentFactory,
  leftNullifyBinaryOrLogicalOperatorFactory,
  gatherInstructions,
  instructionBlockToWriteDependencies,
  instructionToWriteNodePathDependencies,
  FORCE_CONSEQUENT,
  executeInstructions,
  getDependencyPaths,
} from '../src/index';
import { parse } from '@babel/parser';
import { NodePath } from '@babel/traverse';

const ast1 = parse('const a = Math.random(); if(a > 0.5) { console.log("consequent") } else { console.log("alternate") }; null;');
const ast2 = parse('const aFunction = b => b + 1;');

const filePath1 = 'file1';
const filePath2 = 'file2';
const astMap = new Map([[filePath1, ast1], [filePath2, ast2]]);

it('instruction factory integration', () => {
  const instructions = [...gatherInstructions([forceConsequentFactory, leftNullifyBinaryOrLogicalOperatorFactory], astMap)];
  // 1 consequent && 2 binaries
  expect(instructions).toHaveLength(3);

  const forceConsequentInstructions = instructions.filter(instruction => instruction.type === FORCE_CONSEQUENT);
  expect(forceConsequentInstructions).toHaveLength(1);

  const instruction = instructions[0];  
  const dependencies = instruction.dependencies;
  
  expect(dependencies.has(filePath1)).toBe(true);
  expect(dependencies.has(filePath2)).toBe(false);

  const fileDependencies = dependencies.get(filePath1)!;
  const writeDependencies = fileDependencies.writes;
  
  expect(writeDependencies).toEqual(expect.arrayContaining([
    expect.objectContaining({
      key: 'test'
    }),
    expect.objectContaining({
      key: 'alternate'
    })
  ]));

  const writeDependenciesFromInstructionHelperMethod = instructionToWriteNodePathDependencies(instruction);
  expect([...writeDependenciesFromInstructionHelperMethod]).toEqual(expect.arrayContaining(writeDependencies));

  const writeDependenciesFromBlockHelperMethod = instructionBlockToWriteDependencies([ instruction, instruction ]);
  expect([...writeDependenciesFromBlockHelperMethod]).toEqual(expect.arrayContaining(writeDependencies));

  const astPath = getAstPath(ast1);
  expect(astPath.isProgram()).toBe(true);

  let testPath: NodePath = null!;
  let alternatePath: NodePath = null!;
  const identifierPaths: NodePath[] = [];
  let nullPath: NodePath = null!;
  astPath.traverse({
    enter: (path) => {
      if (path.isIdentifier()) {
        identifierPaths.push(path);
      }
      if (path.key === 'alternate') {
        alternatePath = path;
      }
      if (path.isNullLiteral()) {
        nullPath = path;
      }
      if (path.key === 'test') {
        testPath = path;
      }
    }
  });

  // TODO: Could probably check the whole array not just parts of it
  const dependentPaths = getDependencyPaths(writeDependencies);
  const dependentNodes = dependentPaths.map(path => path.node);
  const expectedDependentNodes = [testPath, ...identifierPaths, alternatePath].map(path => path.node);
  expect(dependentNodes).toEqual(expect.arrayContaining(expectedDependentNodes));
  expect(dependentNodes).not.toContain(nullPath.node);

  // TODO: Should be this but isn't at the moment
  // expect(readDependencies).toHaveLength(0);

  expect(instruction.variants).toBe(undefined);
  executeInstructions(astMap, forceConsequentInstructions);

  expect(testPath.isBooleanLiteral()).toBe(false);
});