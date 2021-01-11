import extension from '../extensionizer';

import { nanoid } from 'nanoid';

import logger from '@/libs/logger';

/*********************************************************************
 * AircraftClass ::
 *     @Description:
 *     @Description:
 * WARNINGS:
 *
 * HISTORY:
 *     @Author: lanbery@gmail.com
 *     @Created:  2020-11-07
 **********************************************************************/
class WhispererController {
  constructor(opts = {}) {
    this.portName = opts.portName || nanoid();
    this.includeTlsChannelId = Boolean(opts.includeTlsChannelId);
    this.runtime = extension.runtime;
  }

  /**
   *
   * @param {*} apiType
   * @param {*} data
   */
  async sendSimpleMessage(apiType, data) {
    return new Promise((resolve, reject) => {
      try {
        this.runtime.sendMessage(
          { apiType, reqData: data },
          { includeTlsChannelId: this.includeTlsChannelId },
          (respMessage) => {
            logger.debug(
              `WhispererController:sendSimpleMessage - ${this.portName} >>>>>`,
              respMessage
            );
            if (typeof respMessage === 'object' && respMessage.error) {
              reject(respMessage.error);
            } else if (typeof respMessage === 'object' && respMessage.data) {
              resolve(respMessage.data);
            } else {
              resolve(true);
            }
          }
        );
      } catch (err) {
        logger.warn('Error>>>>', err);
        reject(err);
      }
    });
  }
}

export default WhispererController;
