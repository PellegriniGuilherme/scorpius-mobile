import { Image, type ImageStyle, type StyleProp } from 'react-native';

const logoSource = require('../../assets/splash-icon.png');

export interface LogoProps {
  size?: number;
  style?: StyleProp<ImageStyle>;
  testID?: string;
}

export function Logo({ size = 160, style, testID = 'scorpius-logo' }: LogoProps) {
  return (
    <Image
      testID={testID}
      source={logoSource}
      accessibilityRole="image"
      accessibilityLabel="Scorpius Move"
      style={[{ width: size, height: size, resizeMode: 'contain' }, style]}
    />
  );
}
