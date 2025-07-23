
import { ConverterFactory, dictionary } from "opencc-js";
import STPhrases from "opencc-js/dist/dict/STPhrases.json";
import STCharacters from "opencc-js/dist/dict/STCharacters.json";
import TWVariants from "opencc-js/dist/dict/TWVariants.json";
import TWPhrases from "opencc-js/dist/dict/TWPhrases.json";
import HKVariants from "opencc-js/dist/dict/HKVariants.json";
import s2t from "opencc-js/dist/config/s2t.json";
import t2s from "opencc-js/dist/config/t2s.json";
import s2hk from "opencc-js/dist/config/s2hk.json";
import hk2s from "opencc-js/dist/config/hk2s.json";
import s2tw from "opencc-js/dist/config/s2tw.json";
import tw2s from "opencc-js/dist/config/tw2s.json";
import s2twp from "opencc-js/dist/config/s2twp.json";
import tw2sp from "opencc-js/dist/config/tw2sp.json";
import t2tw from "opencc-js/dist/config/t2tw.json";
import t2hk from "opencc-js/dist/config/t2hk.json";

const dictionaries = {
  STPhrases,
  STCharacters,
  TWVariants,
  TWPhrases,
  HKVariants,
};

const configurations = {
  s2t,
  t2s,
  s2hk,
  hk2s,
  s2tw,
  tw2s,
  s2twp,
  tw2sp,
  t2tw,
  t2hk,
};

const factory = ConverterFactory(
  (name) => {
    if (dictionaries[name]) {
      return dictionary.Buffer(dictionaries[name]);
    }
    return undefined;
  },
  (name) => {
    return configurations[name];
  }
);

export const Converter = ({ from, to }) => {
  const fromLocale = locales.includes(from) ? from : "t";
  const toLocale = locales.includes(to) ? to : "t";
  return factory({ from: fromLocale, to: toLocale });
};

export const locales = ["cn","hk","tw","twp"];
