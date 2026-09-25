/** Google Form used for player bug/feedback reports (see docs/roadmap.md). */
const FORM_BASE_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSd5KF11wGvfl7TmpJeYOcrufAdh5EjUgal4y2q8YGA_8jiV5Q/viewform';
const IMAGE_REFERENCE_ENTRY_ID = 'entry.1801892591';

const VERSION_ENTRY_ID = 'entry.1818810328';

/**
 * Builds the URL for opening the bug report form, always prefilling the app
 * version (see vite.config.ts's `define`) and optionally the image-reference
 * field so an "this image isn't hitting for me" report identifies which
 * asset the player meant without them typing it in.
 */
export function bugReportUrl(imageRef?: string): string {
  const params = new URLSearchParams({ [VERSION_ENTRY_ID]: __APP_VERSION__ });
  if (imageRef) params.set(IMAGE_REFERENCE_ENTRY_ID, imageRef);
  return `${FORM_BASE_URL}?${params.toString()}`;
}
