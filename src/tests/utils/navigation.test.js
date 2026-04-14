import { reloadPage } from '../../utils/navigation';

describe('navigation', () => {
  test('reloadPage is a function', () => {
    expect(typeof reloadPage).toBe('function');
  });
});
