import type { ServerErrorCode } from '../../src/domain/types.ts';

export class LinkImportError extends Error {
  public readonly code: ServerErrorCode;
  constructor(code: ServerErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'LinkImportError';
  }
}

/** Keep provider diagnostics on the server; expose stable, translated reasons. */
export function classifyLinkFailure(error: unknown): LinkImportError {
  if (error instanceof LinkImportError) return error;
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string } | null)?.code;
  if (code === 'YTDLP_MISSING' || code === 'YTDLP_TIMEOUT') {
    return new LinkImportError(code, message);
  }
  if (/not.{0,60}available in your country|geo.?restrict|region|\u5730\u533a|\u533a\u57df/i.test(message)) {
    return new LinkImportError('LINK_REGION_RESTRICTED', 'This content is region restricted.');
  }
  if (/confirm your age|age.?restrict/i.test(message)) {
    return new LinkImportError('LINK_AGE_RESTRICTED', 'Age verification is required.');
  }
  if (/purchase|payment|paywall|premium|members.only|\u4ed8\u8d39|\u8d2d\u4e70/i.test(message)) {
    return new LinkImportError('LINK_PAYMENT_REQUIRED', 'A purchase or membership is required.');
  }
  if (/not live|offline|not currently live/i.test(message)) {
    return new LinkImportError('LINK_NOT_LIVE', 'This channel is not currently live.');
  }
  if (/confirm.{0,30}not a bot|automated requests|unusual traffic|bot detection/i.test(message)) {
    return new LinkImportError('LINK_RATE_LIMITED', 'The source requires an anti-bot check. Try again later.');
  }
  if (/sign.?in|log.?in|cookies|private|authentication|\u767b\u5f55/i.test(message)) {
    return new LinkImportError('LINK_LOGIN_REQUIRED', 'Sign in is required by the source.');
  }
  if (/429|too many requests|rate.?limit|412|risk control/i.test(message)) {
    return new LinkImportError('LINK_RATE_LIMITED', 'The source temporarily limited requests.');
  }
  if (/unavailable|not available|not exist|deleted|removed|404|\u5565\u90fd\u6728\u6709/i.test(message)) {
    return new LinkImportError('LINK_UNAVAILABLE', 'This content is unavailable or has been removed.');
  }
  return new LinkImportError('LINK_PARSE_FAILED', 'Could not retrieve usable metadata.');
}
