import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { StatisticsPage } from './StatisticsPage';
import { statisticsReport } from '../../test/chronaApiMock';

test('analyzes repository and keeps storage metrics', async () => {
  const onAnalyze = vi.fn();
  const { rerender } = render(
    <StatisticsPage
      report={null}
      progress={null}
      loading={false}
      error={null}
      onAnalyze={onAnalyze}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: /analyze repository/i }));
  expect(onAnalyze).toHaveBeenCalledOnce();

  rerender(
    <StatisticsPage
      report={statisticsReport()}
      progress={null}
      loading={false}
      error={null}
      onAnalyze={onAnalyze}
    />,
  );
  expect(screen.getByText('Dedup saved')).toBeInTheDocument();
  expect(screen.queryByText(/workspace section/i)).not.toBeInTheDocument();
});
