import { dStar } from '../src/index';

describe('dstar', () => {
  it('0/10 passes 0/10 fails', () => {
    expect(dStar({ passed: 0, failed: 0 }, { passed: 10, failed: 10 })).to.equal(10);
  });
  it('0/0 pass 1/1 fails', () => {
    expect(dStar({ passed: 0, failed: 1 }, { passed: 0, failed: 1 })).to.equal(
      null
    );
  });
  it('1/1 pass 1/2 fail', () => {
    expect(dStar({ passed: 1, failed: 1 }, { passed: 1, failed: 2 })).to.equal(0.5);
  });
});
