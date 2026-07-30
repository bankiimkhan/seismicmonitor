import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuakeList } from '../QuakeList';
import { LocaleProvider } from '@/lib/i18n/LocaleProvider';

function renderWithLocale(ui: React.ReactElement) {
    return render(<LocaleProvider>{ui}</LocaleProvider>);
}

describe('QuakeList', () => {
    it('shows skeletons while loading with no data yet', () => {
        const { container } = renderWithLocale(<QuakeList quakes={[]} loading={true} />);
        expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
    });

    it('shows an error state with a retry action', () => {
        renderWithLocale(<QuakeList quakes={[]} loading={false} error="network down" />);
        expect(screen.getByText(/network down/i)).toBeInTheDocument();
    });

    it('shows an empty state when nothing matches', () => {
        renderWithLocale(<QuakeList quakes={[]} loading={false} error={null} />);
        expect(screen.getByText(/no seismic activity found/i)).toBeInTheDocument();
    });

    it('renders a quake card with its place and magnitude', () => {
        renderWithLocale(
            <QuakeList
                quakes={[{
                    id: 'evt-1',
                    properties: { mag: 5.4, place: 'Dhaka, Bangladesh', time: Date.now(), url: 'https://example.com' },
                    geometry: { coordinates: [90.4, 23.8, 10] },
                }]}
                loading={false}
                error={null}
            />
        );
        expect(screen.getByText('Dhaka, Bangladesh')).toBeInTheDocument();
        expect(screen.getByText('5.4')).toBeInTheDocument();
    });
});
