/* eslint-env jest */
// Native-backed libraries are stubbed so component tests can mount the React tree in Node.
jest.mock('@shopify/react-native-skia', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Canvas: props => React.createElement(View, props),
    Picture: () => null,
    Skia: { PictureRecorder: () => ({ beginRecording: () => ({}), finishRecordingAsPicture: () => ({}) }) },
    useImage: () => null,
    useTypeface: () => null,
  };
});
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');
  const value = v => ({ value: v });
  const AnimatedView = React.forwardRef((props, ref) => React.createElement(View, { ...props, ref }));
  const anim = { duration: () => anim, springify: () => anim, damping: () => anim, stiffness: () => anim };
  const AnimatedText = React.forwardRef((props, ref) => React.createElement(require('react-native').Text, { ...props, ref }));
  const ease = () => ease;
  return {
    __esModule: true,
    default: { View: AnimatedView, Text: AnimatedText },
    Easing: { out: ease, inOut: ease, back: ease, sin: ease, cubic: ease },
    withDelay: (d, v) => v,
    withRepeat: v => v,
    withSequence: (...v) => v[v.length - 1],
    useSharedValue: value,
    useDerivedValue: fn => value(undefined && fn),
    useAnimatedStyle: () => ({}),
    useFrameCallback: () => undefined,
    withSpring: v => v,
    withTiming: v => v,
    FadeIn: anim, FadeOut: anim, SlideInDown: anim, SlideOutDown: anim, ZoomIn: anim,
  };
});
jest.mock('react-native-worklets', () => ({ scheduleOnUI: () => undefined, scheduleOnRN: (fn, ...a) => fn(...a) }));
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GestureHandlerRootView: props => React.createElement(View, props),
    GestureDetector: ({ children }) => children,
    usePanGesture: () => ({}),
  };
});
jest.mock('react-native-audio-api', () => ({ AudioContext: jest.fn() }));
jest.mock('react-native-haptic-feedback', () => ({ trigger: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
