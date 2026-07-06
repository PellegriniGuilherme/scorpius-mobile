import { Input } from '@/components/Input';
import { handleBrazilPhoneChange } from '@/lib/formatPhone';

interface PhoneInputProps {
  label: string;
  placeholder?: string;
  value: string;
  onChangeText: (formatted: string) => void;
  error?: string;
  testID?: string;
}

export function PhoneInput({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  testID = 'login-phone-input',
}: PhoneInputProps) {
  function handleChange(text: string) {
    const { formatted } = handleBrazilPhoneChange(text);
    onChangeText(formatted);
  }

  return (
    <Input
      label={label}
      placeholder={placeholder}
      value={value}
      onChangeText={handleChange}
      keyboardType="phone-pad"
      autoComplete="tel"
      error={error}
      testID={testID}
    />
  );
}
