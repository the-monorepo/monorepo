import { createContext, summarizers } from 'istanbul-lib-report';
import { create } from 'istanbul-reports';
import { createCoverageMap } from 'istanbul-lib-coverage';
import { PartialTestHookOptions } from '@fault/addon-hook-schema';
import { TesterResults } from '@fault/types';
export const report = ({ testResults }, contextOptions) => {
  const totalCoverage = createCoverageMap({});
  for (const { coverage } of testResults.values()) {
    totalCoverage.merge(coverage);
  }
  const context = createContext(contextOptions);

  const tree = summarizers.pkg(totalCoverage);
  ['json', 'lcov', 'text'].forEach(reporter =>
    tree.visit(create(reporter as any, {}), context),
  );
};

export const createPlugin = contextOptions => {
  const plugin: PartialTestHookOptions = {
    on: {
      complete: (testerResults: TesterResults) => {
        report(testerResults, contextOptions);
      },
    },
  };
  return plugin;
};
export const defaultPlugin = createPlugin(undefined);

export default defaultPlugin;
