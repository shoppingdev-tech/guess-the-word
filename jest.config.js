module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./jest.setup.js'],
  moduleNameMapper: { '\\.(ttf)$': '<rootDir>/__mocks__/fileStub.js' },
};
