describe('MechanicRegistry', () => {
  let registerMechanic, createMechanic, getRegisteredTypes;

  beforeEach(() => {
    jest.isolateModules(() => {
      const mod = require('../../mechanics/MechanicRegistry');
      registerMechanic = mod.registerMechanic;
      createMechanic = mod.createMechanic;
      getRegisteredTypes = mod.getRegisteredTypes;
    });
  });

  describe('registerMechanic', () => {
    it('stores a factory that is retrievable via createMechanic', () => {
      const mockResult = { type: 'test' };
      const factory = jest.fn(() => mockResult);

      registerMechanic('test_type', factory);

      const result = createMechanic('test_type', 'world', 'group', 'config', 0.5, 'theme');
      expect(factory).toHaveBeenCalledWith('world', 'group', 'config', 0.5, 'theme');
      expect(result).toBe(mockResult);
    });

    it('emits console.error and overwrites when registering a duplicate type', () => {
      const firstFactory = jest.fn(() => 'first');
      const secondFactory = jest.fn(() => 'second');
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      registerMechanic('dup_type', firstFactory);
      registerMechanic('dup_type', secondFactory);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('dup_type'));

      const result = createMechanic('dup_type', 'w', 'g', 'c', 0, 't');
      expect(secondFactory).toHaveBeenCalled();
      expect(result).toBe('second');

      errorSpy.mockRestore();
    });
  });

  describe('createMechanic', () => {
    it('returns the factory result for a known type with correct arguments', () => {
      const mockMechanic = { update: jest.fn(), destroy: jest.fn() };
      const factory = jest.fn(() => mockMechanic);
      const world = { step: jest.fn() };
      const group = { add: jest.fn() };
      const config = { speed: 1 };
      const surfaceHeight = 0.15;
      const theme = { color: 'blue' };

      registerMechanic('known_type', factory);

      const result = createMechanic('known_type', world, group, config, surfaceHeight, theme);

      expect(factory).toHaveBeenCalledTimes(1);
      expect(factory).toHaveBeenCalledWith(world, group, config, surfaceHeight, theme);
      expect(result).toBe(mockMechanic);
    });

    it('returns null and emits console.warn for an unknown type', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      registerMechanic('existing_a', jest.fn());
      registerMechanic('existing_b', jest.fn());

      const result = createMechanic('nonexistent', 'w', 'g', 'c', 0, 't');

      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('nonexistent'));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('existing_a'));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('existing_b'));

      warnSpy.mockRestore();
    });
  });

  describe('getRegisteredTypes', () => {
    it('returns an empty array when nothing is registered', () => {
      expect(getRegisteredTypes()).toEqual([]);
    });

    it('returns exactly the set of registered type strings', () => {
      registerMechanic('alpha', jest.fn());
      registerMechanic('beta', jest.fn());
      registerMechanic('gamma', jest.fn());

      const types = getRegisteredTypes();
      expect(types).toHaveLength(3);
      expect(types).toEqual(expect.arrayContaining(['alpha', 'beta', 'gamma']));
    });
  });

  describe('registry isolation', () => {
    it('does not leak state from prior test cases', () => {
      expect(getRegisteredTypes()).toEqual([]);
    });
  });
});
