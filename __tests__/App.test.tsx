/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

test('the game screen mounts with its controls', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });
  const labels = tree!.root.findAll(n => typeof n.props.accessibilityLabel === 'string').map(n => n.props.accessibilityLabel);
  expect(labels).toEqual(expect.arrayContaining(['Pause', 'Shake the jar', 'Pop the smallest fruit']));
  expect(labels.some((l: string) => l.startsWith('Jar.'))).toBe(true);
});
