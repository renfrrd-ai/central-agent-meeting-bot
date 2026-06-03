export class ParseError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ParseError";
    this.code = code;
  }
}
