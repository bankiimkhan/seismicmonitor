import { describe, it, expect, vi, afterEach } from 'vitest';
import { extractAftershockForecast } from '../aftershockForecast';

const FORECAST_JSON = {
    creationTime: 1785235084730,
    expireTime: 1816772400000,
    advisoryTimeFrame: '1 Week',
    template: 'Mainshock',
    observations: [{ magnitude: 3.0, count: 2 }, { magnitude: 4.0, count: 0 }],
    model: { name: 'Reasenberg-Jones (1989, 1994) aftershock model (Bayesian Combination)' },
    forecast: [
        { label: '1 Day', timeStart: 1, timeEnd: 2, bins: [{ magnitude: 3.0, probability: 0.005, median: 0 }] },
        { label: '1 Week', timeStart: 3, timeEnd: 4, bins: [{ magnitude: 3.0, probability: 0.033, median: 0 }] },
        { label: '1 Month', timeStart: 5, timeEnd: 6, bins: [{ magnitude: 3.0, probability: 0.095, median: 0 }] },
        { label: '1 Year', timeStart: 7, timeEnd: 8, bins: [{ magnitude: 3.0, probability: 0.279, median: 0 }] },
    ],
    nextForecastTime: 1785494940000,
};

function productsWithForecast() {
    return {
        oaf: [{ contents: { 'forecast.json': { url: 'https://example.com/forecast.json' } } }],
    };
}

describe('extractAftershockForecast', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('selects the forecast window matching advisoryTimeFrame as primaryWindow', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => FORECAST_JSON,
        }));

        const result = await extractAftershockForecast(productsWithForecast());
        expect(result).not.toBeNull();
        expect(result!.primaryWindow.label).toBe('1 Week');
        expect(result!.primaryWindow.bins[0].probability).toBeCloseTo(0.033);
        expect(result!.modelName).toContain('Reasenberg-Jones');
        expect(result!.observations).toEqual(FORECAST_JSON.observations);
    });

    it('falls back to the first window if advisoryTimeFrame matches nothing', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ ...FORECAST_JSON, advisoryTimeFrame: 'Nonexistent' }),
        }));

        const result = await extractAftershockForecast(productsWithForecast());
        expect(result!.primaryWindow.label).toBe('1 Day');
    });

    it('returns null when products has no oaf entry', async () => {
        const result = await extractAftershockForecast({});
        expect(result).toBeNull();
    });

    it('returns null when products is null/undefined', async () => {
        expect(await extractAftershockForecast(null)).toBeNull();
        expect(await extractAftershockForecast(undefined)).toBeNull();
    });

    it('returns null gracefully when the forecast.json fetch fails', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
        const result = await extractAftershockForecast(productsWithForecast());
        expect(result).toBeNull();
    });

    it('returns null gracefully when fetch throws', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
        const result = await extractAftershockForecast(productsWithForecast());
        expect(result).toBeNull();
    });
});
