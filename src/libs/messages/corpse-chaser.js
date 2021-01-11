import EventEmitter from 'events';

import logger from '../logger';
import extension from '../extensionizer';

import { ENV_TYPE_INJET } from '../enums';
import { API_JET_INIT_STATE, API_RT_FILL_FEILDS } from '@/libs/msgapi/api-types';

/*********************************************************************
 * AircraftClass ::
 *     @Description: Zombie will attched on pages
 *     @Description: Follow the command of the corpse chaser
 * WARNINGS:
 *
 * HISTORY:
 *     @Author: lanbery@gmail.com
 *     @Created:  2020-11-09
 **********************************************************************/
class CorpseChaser extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.setMaxListeners(10);
    this.portName = opts.portName || ENV_TYPE_INJET;
    this.includeTlsChannelId = Boolean(opts.includeTlsChannelId);
    this.hostname = opts.hostname;

    // updateMatchedState update initState to feildsPage and topPage
    this.updateMatchedState = opts.updateMatchedState;
    this.filledInputFields = opts.filledInputFields;

    // this.once('startup:zombie',this.startupZombie.bind(this))
  }

  startupZombie({ hostname = '', extid = '' }) {
    logger.debug(`start listening corpse commands...${this.portName}>>>`, hostname);

    if (hostname) this.hostname = hostname;

    if (extid) {
      this.remote = extension.runtime.connect(extid, {
        name: this.portName,
        includeTlsChannelId: this.includeTlsChannelId,
      });
    } else {
      this.remote = extension.runtime.connect({
        name: this.portName,
        includeTlsChannelId: this.includeTlsChannelId,
      });
    }

    this.remote.onMessage.addListener(this.remoteCommandsListener.bind(this));

    if (hostname) {
      // send hostname
      this.remote.postMessage({
        apiType: 'updateLoginHostname',
        hostname,
      });
    }
  }

  postMessage(apiType, data) {
    if (!this.remote || typeof apiType !== 'string') return;
    try {
      const message = {
        apiType,
        reqData: data,
      };
      this.remote.postMessage(message);
    } catch (error) {
      logger.warn(`${this.portName} postMessage failed`, error.message);
    }
  }

  remoteCommandsListener(message) {
    logger.debug(`CorpseChaser Received corpse commands : ${this.portName}>>>`, message);

    if (message && message.name && message.data) {
      const { apiType, respData } = message.data;
      logger.debug(`CorpseChaser Received corpse commands : ${apiType}>>>`, respData);

      switch (apiType) {
        case API_JET_INIT_STATE:
          this.updateMatchedState && this.updateMatchedState(respData);
          break;
        case API_RT_FILL_FEILDS:
          this.filledInputFields && this.filledInputFields(respData);
          break;
        default:
          break;
      }
    }
  }
}

export default CorpseChaser;
