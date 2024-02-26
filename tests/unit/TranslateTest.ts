/* eslint-disable @typescript-eslint/naming-convention */
import * as translations from '@src/languages/translations';
import type {TranslationFlatObject, TranslationPaths} from '@src/languages/types';
import CONFIG from '../../src/CONFIG';
import CONST from '../../src/CONST';
import * as Localize from '../../src/libs/Localize';

const originalTranslations = {...translations};

// @ts-expect-error - We are modifying the translations object for testing purposes
translations.default = {
    [CONST.LOCALES.EN]: translations.flattenObject({
        testKey1: 'English',
        testKey2: 'Test Word 2',
        testKey3: 'Test Word 3',
        testKeyGroup: {
            testFunction: ({testVariable}) => `With variable ${testVariable}`,
        },
    }),
    [CONST.LOCALES.ES]: translations.flattenObject({
        testKey1: 'Spanish',
        testKey2: 'Spanish Word 2',
    }),
    [CONST.LOCALES.ES_ES]: translations.flattenObject({testKey1: 'Spanish ES'}),
};

describe('translate', () => {
    it('Test present key in full locale', () => {
        expect(Localize.translate(CONST.LOCALES.ES_ES, 'testKey1' as TranslationPaths)).toBe('Spanish ES');
    });

    it('Test when key is not found in full locale, but present in language', () => {
        expect(Localize.translate(CONST.LOCALES.ES_ES, 'testKey2' as TranslationPaths)).toBe('Spanish Word 2');
        expect(Localize.translate(CONST.LOCALES.ES, 'testKey2' as TranslationPaths)).toBe('Spanish Word 2');
    });

    it('Test when key is not found in full locale and language, but present in default', () => {
        expect(Localize.translate(CONST.LOCALES.ES_ES, 'testKey3' as TranslationPaths)).toBe('Test Word 3');
    });

    test('Test when key is not found in default', () => {
        expect(() => Localize.translate(CONST.LOCALES.ES_ES, 'testKey4' as TranslationPaths)).toThrow(Error);
    });

    test('Test when key is not found in default (Production Mode)', () => {
        const ORIGINAL_IS_IN_PRODUCTION = CONFIG.IS_IN_PRODUCTION;
        // @ts-expect-error - We are modifying the CONFIG object for testing purposes
        CONFIG.IS_IN_PRODUCTION = true;
        expect(Localize.translate(CONST.LOCALES.ES_ES, 'testKey4' as TranslationPaths)).toBe('testKey4');
        // @ts-expect-error - We are modifying the CONFIG object for testing purposes
        CONFIG.IS_IN_PRODUCTION = ORIGINAL_IS_IN_PRODUCTION;
    });

    it('Test when translation value is a function', () => {
        const expectedValue = 'With variable Test Variable';
        const testVariable = 'Test Variable';
        // @ts-expect-error - We are modifying the translations object for testing purposes
        expect(Localize.translate(CONST.LOCALES.EN, 'testKeyGroup.testFunction' as TranslationPaths, {testVariable})).toBe(expectedValue);
    });
});

describe('Translation Keys', () => {
    function traverseKeyPath(source: TranslationFlatObject, path?: string, keyPaths?: string[]): string[] {
        const pathArray = keyPaths ?? [];
        const keyPath = path ? `${path}.` : '';
        Object.keys(source).forEach((key) => {
            if (typeof source[key as keyof TranslationFlatObject] === 'object' && typeof source[key as keyof TranslationFlatObject] !== 'function') {
                // @ts-expect-error - We are modifying the translations object for testing purposes
                traverseKeyPath(source[key], keyPath + key, pathArray);
            } else {
                pathArray.push(keyPath + key);
            }
        });

        return pathArray;
    }
    function arrayDifference(array1: string[], array2: string[]): string[] {
        return [array1, array2].reduce((a, b) => a.filter((c) => !b.includes(c)));
    }
    const excludeLanguages: Array<'en' | 'es-ES'> = [CONST.LOCALES.EN, CONST.LOCALES.ES_ES];
    const languages = Object.keys(originalTranslations.default).filter((ln) => !(excludeLanguages as string[]).includes(ln));
    const mainLanguage = originalTranslations.default.en;
    const mainLanguageKeys = traverseKeyPath(mainLanguage);

    languages.forEach((ln) => {
        const languageKeys = traverseKeyPath(originalTranslations.default[ln as keyof typeof originalTranslations.default]);

        it(`Does ${ln} locale have all the keys`, () => {
            const hasAllKeys = arrayDifference(mainLanguageKeys, languageKeys);
            if (hasAllKeys.length) {
                console.debug(`🏹 [ ${hasAllKeys.join(', ')} ] are missing from ${ln}.js`);
                Error(`🏹 [ ${hasAllKeys.join(', ')} ] are missing from ${ln}.js`);
            }
            expect(hasAllKeys).toEqual([]);
        });

        it(`Does ${ln} locale have unused keys`, () => {
            const hasAllKeys = arrayDifference(languageKeys, mainLanguageKeys);
            if (hasAllKeys.length) {
                console.debug(`🏹 [ ${hasAllKeys.join(', ')} ] are unused keys in ${ln}.js`);
                Error(`🏹 [ ${hasAllKeys.join(', ')} ] are unused keys in ${ln}.js`);
            }
            expect(hasAllKeys).toEqual([]);
        });
    });
});

describe('flattenObject', () => {
    it('It should work correctly', () => {
        const func = ({content}: {content: string}) => `This is the content: ${content}`;
        const simpleObject = {
            common: {
                yes: 'Yes',
                no: 'No',
            },
            complex: {
                activity: {
                    none: 'No Activity',
                    some: 'Some Activity',
                },
                report: {
                    title: {
                        expense: 'Expense',
                        task: 'Task',
                    },
                    description: {
                        none: 'No description',
                    },
                    content: func,
                    messages: ['Hello', 'Hi', 'Sup!'],
                },
            },
        };

        const result = translations.flattenObject(simpleObject);
        expect(result).toStrictEqual({
            'common.yes': 'Yes',
            'common.no': 'No',
            'complex.activity.none': 'No Activity',
            'complex.activity.some': 'Some Activity',
            'complex.report.title.expense': 'Expense',
            'complex.report.title.task': 'Task',
            'complex.report.description.none': 'No description',
            'complex.report.content': func,
            'complex.report.messages': ['Hello', 'Hi', 'Sup!'],
        });
    });
});
