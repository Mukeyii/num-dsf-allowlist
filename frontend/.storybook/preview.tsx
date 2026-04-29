import type { Preview } from '@storybook/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/ } },
  },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <QueryClientProvider client={qc}>
          <Story />
        </QueryClientProvider>
      </MemoryRouter>
    ),
  ],
};

export default preview;
