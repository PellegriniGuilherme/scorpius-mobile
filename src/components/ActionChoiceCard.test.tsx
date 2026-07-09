import { renderWithTheme, fireEvent, screen } from '@/../jest.test-utils';
import { ActionChoiceCard } from './ActionChoiceCard';

describe('ActionChoiceCard', () => {
  it('renders title and subtitle and calls onPress', () => {
    const onPress = jest.fn();
    renderWithTheme(
      <ActionChoiceCard
        title="Informar imprevisto"
        subtitle="A entrega continua em andamento."
        tone="info"
        onPress={onPress}
        testID="choice-occurrence"
      />,
    );

    expect(screen.getByText('Informar imprevisto')).toBeTruthy();
    expect(screen.getByText('A entrega continua em andamento.')).toBeTruthy();

    fireEvent.press(screen.getByTestId('choice-occurrence'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
