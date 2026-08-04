import { describe, it, expect } from 'vitest';
import { countryFromPlace } from '../countries';

// Every example below is a real place string taken from the hazard_events
// archive, which is why the naive "last comma-delimited token" approach
// produced a country ranking topped by "CA", "Alaska" and "Hurricane Fausto".
describe('countryFromPlace', () => {
    it('resolves USGS state names and postal codes to the United States', () => {
        expect(countryFromPlace('12km SSW of Searles Valley, CA')).toBe('United States');
        expect(countryFromPlace('54 km SE of Cantwell, Alaska')).toBe('United States');
        expect(countryFromPlace('Big Bend, Texas')).toBe('United States');
        expect(countryFromPlace('Willow Fire, Oregon')).toBe('United States');
    });

    it("resolves India's NCS state names to India", () => {
        expect(countryFromPlace('Chikkaballapur, Karnataka')).toBe('India');
        expect(countryFromPlace('North Garo Hills, Meghalaya')).toBe('India');
        expect(countryFromPlace('Aizawl, Mizoram')).toBe('India');
    });

    it('resolves Chinese autonomous regions to China', () => {
        expect(countryFromPlace('98 km NW of Xinghai, Tibet')).toBe('China');
        expect(countryFromPlace('western Xizang')).toBe('China');
    });

    // "Burma (Myanmar)" and "Myanmar" both appear; left alone they rank as two
    // separate countries splitting one country's events between them.
    it('folds alternate spellings onto one name', () => {
        expect(countryFromPlace('20 km N of Falam, Burma (Myanmar)')).toBe('Myanmar');
        expect(countryFromPlace('Myanmar')).toBe('Myanmar');
    });

    it('strips USGS directional and "region" qualifiers', () => {
        expect(countryFromPlace('India region')).toBe('India');
        expect(countryFromPlace('northern Afghanistan')).toBe('Afghanistan');
    });

    it('passes plain country names through', () => {
        expect(countryFromPlace('Nepal')).toBe('Nepal');
        expect(countryFromPlace('102 km SW of Kandahar, Afghanistan')).toBe('Afghanistan');
    });

    // severe_weather rows carry the storm's own name as `place`. There is no
    // country in the string, and the last token is the storm -- so the honest
    // answer is null, not "Fausto".
    it('returns null for storm names', () => {
        expect(countryFromPlace('Hurricane Fausto')).toBeNull();
        expect(countryFromPlace('Super Typhoon Dolphin')).toBeNull();
        expect(countryFromPlace('Tropical Storm Bertha')).toBeNull();
    });

    it('returns null for open-ocean and undersea features', () => {
        expect(countryFromPlace('Southern Mid-Atlantic Ridge')).toBeNull();
        expect(countryFromPlace('central East Pacific Rise')).toBeNull();
        expect(countryFromPlace('south of the Fiji Islands, Pacific Ocean')).toBeNull();
    });

    it('returns null rather than guessing on missing or empty input', () => {
        expect(countryFromPlace(null)).toBeNull();
        expect(countryFromPlace(undefined)).toBeNull();
        expect(countryFromPlace('')).toBeNull();
        expect(countryFromPlace('Unknown')).toBeNull();
    });
});
