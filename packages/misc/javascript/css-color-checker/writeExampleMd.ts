import fs from 'fs';
import { basename } from 'path';

import { TestInputs } from './tests/inputs/test-inputs.ts';
import {
  default as cssColorFormat,
  isHexColor,
  isRgbColor,
  isRgbaColor,
  isHslColor,
  isHslaColor,
  isColorName,
  isHwbColor,
  isCssColor,
} from './src/index.ts';
import { inputs } from './tests/inputs/suites.ts';

function example(isColorFunction, input: string) {
  return `${isColorFunction.name}("${input}");`;
}

function examples(isColorFunction, inputs: Set<string>, isValidSet: boolean) {
  let md = '';
  md += '```js\n';
  for (const input of inputs) {
    md += `${example(isColorFunction, input)} // ${isValidSet}\n`;
  }
  md += '```\n';
  return md;
}

function colorMatcherExamples(title, isColorFunction, inputSuite: TestInputs) {
  let md = `## ${title} colors\n`;
  md += '\n';
  md += '### Inputs that return true\n';
  md += examples(isColorFunction, inputSuite.valid, true);
  md += '\n';
  md += '### Inputs that return false\n';
  md += examples(isColorFunction, inputSuite.invalid, false);
  md += '\n';
  return md;
}
function genExampleMdString() {
  let md = '# Examples\n';
  md += '\n';
  md += `## ${cssColorFormat.name}\n`;
  md += '\n';
  md +=
    '`cssColorFormat` will return a string representing the color type for any input that returns true in the functions below and null for everything else.\n';
  md +=
    "E.g. `cssColorFormat('#FFFFFF')` returns 'hex' and `cssColorFormat('rgb(255,255,255)')` returns 'rgb', `cssColorFormat('bleh')` returns null.\n";
  md += '\n';
  // TODO: Pretty much copy pasted from tests. Should refactor for better code reuse.
  md += `## ${isCssColor.name}\n`;
  md += '\n';
  md +=
    'Exactly the same as `cssColorFormat` except, where `cssColorFormat` returns a `string`, `isCssColor` returns `true` and where `cssColorFormat` returns `null`, `isCssColor` returns `false`';
  md += '\n';

  md += colorMatcherExamples('Hex', isHexColor, inputs.hex);
  md += colorMatcherExamples('rgb(...)', isRgbColor, inputs.rgb);
  md += colorMatcherExamples('rgba(...)', isRgbaColor, inputs.rgba);
  md += colorMatcherExamples('hsl(...)', isHslColor, inputs.hsl);
  md += colorMatcherExamples('hsla(...)', isHslaColor, inputs.hsla);
  md += colorMatcherExamples('hwb(...)', isHwbColor, inputs.hwb);
  md += colorMatcherExamples('Named', isColorName, inputs.named);
  md += '---\n';
  md += `**Note:** This file was generated by ${basename(__filename)}`;
  return md;
}

fs.writeFileSync('EXAMPLES.md', genExampleMdString(), 'utf8');
