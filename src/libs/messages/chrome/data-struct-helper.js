import BizError from '@lib/biz-error';
import { INTERNAL_ERROR, UNKONW_ERROR } from '@lib/biz-error/error-codes';
import logger from '@lib/logger';

export const buildResponseMessage = async (apiType, data) => {
  if (typeof apiType !== 'string') throw new BizError('ApiType type error', INTERNAL_ERROR);
  return {
    apiType,
    data,
  };
};

export const buildErrorResponseMessage = async (apiType, err) => {
  logger.debug('BizError>>>>>>', err);

  if (typeof apiType !== 'string') throw new BizError('ApiType type error', INTERNAL_ERROR);
  let exData = {
    code: UNKONW_ERROR,
    message: 'unknow error.',
  };

  if (typeof err === 'object' && err.code) {
    exData.code = err.code;
    exData.message = err.message;
  } else if (typeof err === 'string') {
    exData.code = INTERNAL_ERROR;
    exData.message = err.toString();
  } else {
    exData.code = INTERNAL_ERROR;
    exData.message = err.message || err.toString() || 'unknow error.';
  }

  return {
    apiType,
    error: exData,
  };
};
