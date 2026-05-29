import { isVariantCode, type VariantCode } from './constants';

export interface ConvertPageMessage {
  type: 'CONVERT_PAGE';
  origin: VariantCode;
  target: VariantCode;
  autoMode?: boolean;
}

export interface ConvertSelectionMessage {
  type: 'CONVERT_SELECTION';
  origin: VariantCode;
  target: VariantCode;
}

export interface RestorePageMessage {
  type: 'RESTORE_PAGE';
}

export interface GetPageStatusMessage {
  type: 'GET_PAGE_STATUS';
}

export interface ConvertActiveTabMessage {
  type: 'CONVERT_ACTIVE_TAB';
  origin?: VariantCode;
  target?: VariantCode;
  autoMode?: boolean;
}

export interface RestoreActiveTabMessage {
  type: 'RESTORE_ACTIVE_TAB';
}

export interface GetActiveTabStatusMessage {
  type: 'GET_ACTIVE_TAB_STATUS';
}

export interface PageStatusResponse {
  isConverted: boolean;
  origin?: VariantCode;
  target?: VariantCode;
}

export interface ConvertPageResponse extends PageStatusResponse {
  count: number;
  time: number;
}

export interface RuntimeMessageResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export type ContentMessage =
  | ConvertPageMessage
  | ConvertSelectionMessage
  | RestorePageMessage
  | GetPageStatusMessage;

export type PopupMessage =
  | ConvertActiveTabMessage
  | RestoreActiveTabMessage
  | GetActiveTabStatusMessage;

export type RuntimeMessage = ContentMessage | PopupMessage;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isContentMessage(value: unknown): value is ContentMessage {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return false;
  }

  switch (value.type) {
    case 'CONVERT_PAGE':
    case 'CONVERT_SELECTION':
      return isVariantCode(value.origin) && isVariantCode(value.target);
    case 'RESTORE_PAGE':
    case 'GET_PAGE_STATUS':
      return true;
    default:
      return false;
  }
}

export function isPopupMessage(value: unknown): value is PopupMessage {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return false;
  }

  switch (value.type) {
    case 'CONVERT_ACTIVE_TAB':
      return (
        (value.origin === undefined || isVariantCode(value.origin)) &&
        (value.target === undefined || isVariantCode(value.target))
      );
    case 'RESTORE_ACTIVE_TAB':
    case 'GET_ACTIVE_TAB_STATUS':
      return true;
    default:
      return false;
  }
}
