declare module 'mammoth' {
  export interface ConversionResult {
    value: string;
    messages: Array<{
      type: string;
      message: string;
    }>;
  }

  export interface Options {
    styleMap?: string;
    includeDefaultStyleMap?: boolean;
    includeEmbeddedStyleMap?: boolean;
    ignoreEmptyParagraphs?: boolean;
    idPrefix?: string;
    transformDocument?: (document: any) => any;
    ignoreFonts?: boolean;
    ignoreHeight?: boolean;
    ignoreWidth?: boolean;
    ignoreLastRenderedPageBreak?: boolean;
    ignoreComments?: boolean;
    ignoreFootnotes?: boolean;
    ignoreEndnotes?: boolean;
    ignoreHeaders?: boolean;
    ignoreFooters?: boolean;
    ignoreImages?: boolean;
    ignoreBookmarks?: boolean;
    ignoreNumbering?: boolean;
    ignoreHyperlinks?: boolean;
    ignoreDrawing?: boolean;
    ignoreFields?: boolean;
    ignoreNotes?: boolean;
    ignoreLists?: boolean;
    ignoreTables?: boolean;
    ignoreContentControls?: boolean;
    ignoreSmartTags?: boolean;
    ignoreGlossary?: boolean;
    ignoreBibliography?: boolean;
    ignorePlaceholderText?: boolean;
    ignoreRevisions?: boolean;
    ignoreDeletedText?: boolean;
    ignoreInsertedText?: boolean;
    ignoreMoveFromText?: boolean;
    ignoreMoveToText?: boolean;
  }

  export function convertToHtml(input: ArrayBuffer | Buffer, options?: Options): Promise<ConversionResult>;
  export function convertToHtml(input: { path: string }, options?: Options): Promise<ConversionResult>;
  export function convertToHtml(input: { buffer: ArrayBuffer | Buffer }, options?: Options): Promise<ConversionResult>;
  
  export function extractRawText(input: ArrayBuffer | Buffer, options?: Options): Promise<ConversionResult>;
  export function extractRawText(input: { path: string }, options?: Options): Promise<ConversionResult>;
  export function extractRawText(input: { buffer: ArrayBuffer | Buffer }, options?: Options): Promise<ConversionResult>;
} 