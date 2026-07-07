import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { StatisticsPage } from './StatisticsPage';
import { createChronaApiMock } from '../../test/chronaApiMock';

test('analyzes repository and keeps storage metrics', async () => {
  const { api } = createChronaApiMock();
  render(<StatisticsPage api={api} repositoryPath="/tmp/repo" onOperationChange={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: /analyze repository/i }));
  expect(await screen.findByText('Dedup saved')).toBeInTheDocument();
  expect(screen.queryByText(/workspace section/i)).not.toBeInTheDocument();
});
