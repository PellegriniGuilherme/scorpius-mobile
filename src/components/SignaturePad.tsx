import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { PanResponder, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import { useTheme } from '@/theme/ThemeProvider';

interface Point {
  x: number;
  y: number;
}

export interface SignaturePadRef {
  clear: () => void;
  isEmpty: () => boolean;
  captureToCacheFile: (fileName: string) => Promise<string>;
}

interface SignaturePadProps {
  testID?: string;
  onChange?: (hasStroke: boolean) => void;
}

function pointsToPath(points: Point[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  return `M ${first.x} ${first.y} ${rest.map((p) => `L ${p.x} ${p.y}`).join(' ')}`;
}

export const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(function SignaturePad(
  { testID = 'signature-pad', onChange },
  ref,
) {
  const { colors, tokens } = useTheme();
  const containerRef = useRef<View>(null);
  const [paths, setPaths] = useState<string[]>([]);
  const [livePath, setLivePath] = useState<string | null>(null);
  const strokePoints = useRef<Point[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        const { locationX, locationY } = event.nativeEvent;
        strokePoints.current = [{ x: locationX, y: locationY }];
        setLivePath(pointsToPath(strokePoints.current));
      },
      onPanResponderMove: (event) => {
        const { locationX, locationY } = event.nativeEvent;
        strokePoints.current = [...strokePoints.current, { x: locationX, y: locationY }];
        setLivePath(pointsToPath(strokePoints.current));
      },
      onPanResponderRelease: () => {
        if (strokePoints.current.length > 1) {
          setPaths((prev) => {
            const next = [...prev, pointsToPath(strokePoints.current)];
            onChange?.(next.length > 0);
            return next;
          });
        }
        strokePoints.current = [];
        setLivePath(null);
      },
      onPanResponderTerminate: () => {
        strokePoints.current = [];
        setLivePath(null);
      },
    }),
  ).current;

  useImperativeHandle(ref, () => ({
    clear: () => {
      setPaths([]);
      setLivePath(null);
      strokePoints.current = [];
      onChange?.(false);
    },
    isEmpty: () => paths.length === 0 && !livePath,
    captureToCacheFile: async (fileName: string) => {
      if (!containerRef.current) {
        throw new Error('signature_pad_not_ready');
      }
      const uri = await captureRef(containerRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
        fileName,
      });
      return uri;
    },
  }));

  const allPaths = livePath ? [...paths, livePath] : paths;

  return (
    <View
      ref={containerRef}
      testID={testID}
      onLayout={handleLayout}
      {...panResponder.panHandlers}
      style={{
        height: 140,
        backgroundColor: colors.surfaceInset,
        borderColor: allPaths.length > 0 ? colors.statusSuccessBorder : colors.borderDefault,
        borderWidth: 2,
        borderRadius: tokens.radius.md,
        borderStyle: 'dashed',
        overflow: 'hidden',
      }}
    >
      {size.width > 0 && size.height > 0 && (
        <Svg width={size.width} height={size.height}>
          {allPaths.map((d, index) => (
            <Path
              key={`${index}-${d.slice(0, 12)}`}
              d={d}
              stroke={colors.textPrimary}
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </Svg>
      )}
    </View>
  );
});
