import { UNKONW_ERROR } from './error-codes';

function BPError(message, code) {
  this.message = message || 'unknow error.';
  this.name = 'BPError';

  this.code = code || UNKONW_ERROR;

  Error.captureStackTrace(this, BPError);
}

BPError.prototype = new BPError();
BPError.prototype.constructor = BPError;

BPError.prototype.getError = function () {
  return {
    code: this.code,
    message: this.message,
  };
};

export default BPError;
