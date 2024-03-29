import EventEmitter from 'events';

import logger from '../logger';
import extension from '../extensionizer';

/*********************************************************************
 * AircraftClass ::
 *     @Description:
 *     @Description:
 * WARNINGS:
 *
 * HISTORY:
 *     @Author: lanbery@gmail.com
 *     @Created:  2020-11-06
 **********************************************************************/

const DEFAULT_LIVED_CHANNEL_NAME = 'livedManager';

import { ENV_TYPE_POPUP } from '../enums';
import { API_RT_INIT_STATE, API_RT_FIELDS_VALT_CHANGED } from '../msgapi/api-types';

class LivedManager extends EventEmitter {
  /**
   *
   * @param {object} opts
   * @property {object} store [vuex store: must has dispatch key: initState]
   * @property {string} portName [the portName:must in enums,see module (libs/enums) ]
   * @property {boolean} includeTlsChannelId [Whether the TLS channel ID will be passed into onConnectExternal]
   */
  constructor(opts = {}) {
    super();
    this.setMaxListeners(20);
    this.store = opts.store || null;
    this._extid = extension.runtime.id;
    this.portName = opts.portName || ENV_TYPE_POPUP;

    /** Keep the order below */
    this.on('update:initState', this.receivedInitStateHandle.bind(this));

    this.remotePort = extension.runtime.connect({
      name: this.portName,
      includeTlsChannelId: opts.includeTlsChannelId || false,
    });

    this.remotePort.onMessage.addListener(this.remoteMessageListener.bind(this));
  }

  /**
   *
   * @param {object} initState
   */
  async receivedInitStateHandle(initState) {}

  async remoteMessageListener(message, sender, sendResponse) {
    logger.debug(
      `LivedManager:${this.portName}- remoteMessageListener>>>`,
      JSON.stringify(message),
      sendResponse
    );

    const { name, data } = message;

    if (name.startsWith('BPLeech')) {
      const apiType = data.apiType;
      if (apiType) {
        switch (apiType) {
          case API_RT_FIELDS_VALT_CHANGED:
            if (this.store) {
              this.store.dispatch('updateValtState', data.valtState);
            }
            break;
          default:
            break;
        }
      } else {
        if (this.store) {
          await this.store.dispatch('initState', data);
        }
      }
    }
  }

  /**
   *
   * @param {*} message
   * @param {*} sendResponse
   */
  async sendMessage(message, sendResponse) {
    if (!this.remotePort) {
      throw 'the remote port Connection not established.';
    }
  }
}

export default LivedManager;
