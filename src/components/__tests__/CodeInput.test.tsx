import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { CodeInput } from '../CodeInput';

function Harness({ onDone }: { onDone: (c: string) => void }) {
  const [code, setCode] = useState('');
  return (
    <CodeInput
      value={code}
      onChange={(c) => {
        setCode(c);
        onDone(c);
      }}
    />
  );
}

describe('<CodeInput />', () => {
  it('fills all six boxes from one pasted code and strips non-digits', async () => {
    const onDone = jest.fn();
    await render(<Harness onDone={onDone} />);
    await fireEvent.changeText(screen.getByLabelText('Verification code, 6 digits'), '48 29-13');
    expect(onDone).toHaveBeenLastCalledWith('482913');
    // The boxes are hidden from screen readers on purpose (the single code field is announced instead).
    for (const d of ['4', '8', '2', '9', '1', '3']) expect(screen.getByText(d, { includeHiddenElements: true })).toBeTruthy();
  });

  it('never keeps more than 6 digits', async () => {
    const onDone = jest.fn();
    await render(<Harness onDone={onDone} />);
    await fireEvent.changeText(screen.getByLabelText('Verification code, 6 digits'), '1234567890');
    expect(onDone).toHaveBeenLastCalledWith('123456');
  });
});
