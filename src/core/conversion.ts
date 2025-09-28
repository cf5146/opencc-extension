import { createConversionService } from '../application/conversion/index.js';
import type { ConversionService } from '../application/conversion/index.js';
import { SUPPORTED_LOCALES } from '../domain/conversion/locales.js';
import type { LocaleCode } from '../domain/conversion/locales.js';

export type OpenCCLocale = LocaleCode;

export { SUPPORTED_LOCALES };

const service: ConversionService = createConversionService();

export function resetConversionCache() {
  service.resetCaches();
}

export function convertTextNode(from: OpenCCLocale, to: OpenCCLocale, textNode: Text): boolean {
  return service.convertTextNode(textNode, from, to);
}

export function convertAllNewTextNodes(
  from: OpenCCLocale,
  to: OpenCCLocale,
  root: HTMLElement | DocumentFragment | null = document.body,
) {
  if (!root) return 0;
  return service.convertDocument(from, to, root);
}

export function convertTitle(from: OpenCCLocale, to: OpenCCLocale) {
  service.convertTitle(from, to);
}

export function convertSelection(from: OpenCCLocale, to: OpenCCLocale, selection: Selection | null) {
  return service.convertSelection(selection, from, to);
}

export function convertPlainText(text: string, from: OpenCCLocale, to: OpenCCLocale) {
  return service.convertText(text, from, to);
}

export function hasConverted(node: Node, from: OpenCCLocale, to: OpenCCLocale) {
  return service.hasConverted(node, from, to);
}

export const conversionService = service;
