import { rawOpenCCData } from './raw-data.js';
import { createConverterBuilder, createConverterFactory, createCustomConverter } from './converter.js';

export { rawOpenCCData };
export { createConverterBuilder, createConverterFactory, createCustomConverter };
export type {
	ConverterLocale,
	ConverterOptions,
	DictionaryEntry,
	DictionaryGroup,
	OpenCCLocale,
} from './types.js';
export type { ConverterFunction } from './converter.js';

export const Converter = createConverterBuilder(rawOpenCCData);
